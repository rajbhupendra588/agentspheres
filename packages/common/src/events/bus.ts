import {
  JETSTREAM_STREAM,
  JETSTREAM_SUBJECTS,
  MeshEventSchema,
  subjectForEventType,
  type MeshEvent,
} from "@agentsphere/contracts";
import {
  AckPolicy,
  DeliverPolicy,
  DiscardPolicy,
  RetentionPolicy,
  StorageType,
  headers as natsHeaders,
  type JetStreamClient,
  type JetStreamManager,
  type NatsConnection,
  connect,
  StringCodec,
} from "nats";
import { createLogger, type Logger } from "../logger.js";

const sc = StringCodec();

const STREAM_MAX_AGE_NS = 7 * 24 * 60 * 60 * 1_000_000_000; // 7 days
const STREAM_MAX_BYTES = 512 * 1024 * 1024; // 512 MiB soft cap for local/dev
const DEDUP_WINDOW_NS = 120_000_000_000; // 2 minutes
const ACK_WAIT_NS = 30_000_000_000; // 30s

export interface EventBusOptions {
  natsUrl: string;
  source: string;
  logger?: Logger;
  /** When true, connect failures throw. Default false (degrade gracefully). */
  required?: boolean;
}

export interface SubscribeOptions {
  /** Durable consumer name (unique per logical consumer group). */
  durable: string;
  /** NATS filter subject; defaults to agentsphere.> */
  filter?: string;
  /**
   * DeliverPolicy for new consumers. Default: All.
   * Use New for live fan-out (SSE) so restarts do not replay history.
   */
  deliverPolicy?: "all" | "new";
  handler: (
    event: MeshEvent,
    meta: { subject: string; deliveryCount: number },
  ) => Promise<void>;
}

export interface EventBus {
  readonly source: string;
  isConnected(): boolean;
  publish(event: MeshEvent): Promise<void>;
  subscribe(options: SubscribeOptions): Promise<() => Promise<void>>;
  close(): Promise<void>;
}

async function ensureStream(jsm: JetStreamManager, log: Logger): Promise<void> {
  try {
    await jsm.streams.info(JETSTREAM_STREAM);
    return;
  } catch {
    // create below
  }

  await jsm.streams.add({
    name: JETSTREAM_STREAM,
    subjects: [JETSTREAM_SUBJECTS],
    retention: RetentionPolicy.Limits,
    max_age: STREAM_MAX_AGE_NS,
    max_bytes: STREAM_MAX_BYTES,
    storage: StorageType.File,
    discard: DiscardPolicy.Old,
    num_replicas: 1,
    duplicate_window: DEDUP_WINDOW_NS,
  });

  log.info("JetStream stream created", {
    stream: JETSTREAM_STREAM,
    subjects: JETSTREAM_SUBJECTS,
  });
}

/**
 * Creates a JetStream-backed mesh event bus.
 * Publishes use Msg-Id = event.id for idempotent delivery within the dedup window.
 */
export async function createEventBus(options: EventBusOptions): Promise<EventBus> {
  const log = options.logger ?? createLogger(`events:${options.source}`);
  let nc: NatsConnection | undefined;
  let js: JetStreamClient | undefined;
  const subscriptions: Array<{ stop: () => Promise<void> }> = [];

  try {
    nc = await connect({
      servers: options.natsUrl,
      name: `agentsphere-${options.source}`,
      maxReconnectAttempts: -1,
      reconnectTimeWait: 1_000,
    });
    const jsm = await nc.jetstreamManager();
    await ensureStream(jsm, log);
    js = nc.jetstream();
    log.info("Event bus connected", { url: options.natsUrl, source: options.source });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (options.required) {
      throw err;
    }
    log.warn("Event bus unavailable; continuing without publishing", { error: message });
  }

  return {
    source: options.source,

    isConnected(): boolean {
      return Boolean(nc && !nc.isClosed() && js);
    },

    async publish(event: MeshEvent): Promise<void> {
      if (!js || !nc || nc.isClosed()) {
        log.warn("Dropping event — bus not connected", {
          type: event.type,
          id: event.id,
          tenantId: event.tenantid,
        });
        return;
      }

      const parsed = MeshEventSchema.parse(event);
      const subject = subjectForEventType(parsed.type);
      const hdrs = natsHeaders();
      hdrs.set("Nats-Msg-Id", parsed.id);
      hdrs.set("ce-type", parsed.type);
      hdrs.set("ce-id", parsed.id);
      hdrs.set("ce-source", parsed.source);
      hdrs.set("ce-tenantid", parsed.tenantid);
      if (parsed.projectid) hdrs.set("ce-projectid", parsed.projectid);
      if (parsed.correlationid) hdrs.set("ce-correlationid", parsed.correlationid);
      if (parsed.requestid) hdrs.set("ce-requestid", parsed.requestid);

      await js.publish(subject, sc.encode(JSON.stringify(parsed)), { headers: hdrs });
      log.info("event published", {
        type: parsed.type,
        subject,
        id: parsed.id,
        tenantId: parsed.tenantid,
      });
    },

    async subscribe(subOptions: SubscribeOptions): Promise<() => Promise<void>> {
      if (!nc || nc.isClosed()) {
        log.warn("Cannot subscribe — bus not connected", { durable: subOptions.durable });
        return async () => undefined;
      }

      const filter = subOptions.filter ?? JETSTREAM_SUBJECTS;
      const jsm = await nc.jetstreamManager();
      try {
        await jsm.consumers.info(JETSTREAM_STREAM, subOptions.durable);
      } catch {
        await jsm.consumers.add(JETSTREAM_STREAM, {
          durable_name: subOptions.durable,
          ack_policy: AckPolicy.Explicit,
          deliver_policy:
            subOptions.deliverPolicy === "new"
              ? DeliverPolicy.New
              : DeliverPolicy.All,
          filter_subject: filter,
          max_deliver: 10,
          ack_wait: ACK_WAIT_NS,
        });
        log.info("JetStream consumer created", {
          stream: JETSTREAM_STREAM,
          durable: subOptions.durable,
          filter,
        });
      }

      const jetstream = nc.jetstream();
      const consumer = await jetstream.consumers.get(JETSTREAM_STREAM, subOptions.durable);
      const messages = await consumer.consume();

      let stopped = false;
      const loop = (async () => {
        for await (const msg of messages) {
          if (stopped) break;
          try {
            const raw = sc.decode(msg.data);
            const event = MeshEventSchema.parse(JSON.parse(raw));
            await subOptions.handler(event, {
              subject: msg.subject,
              deliveryCount: msg.info.deliveryCount,
            });
            msg.ack();
          } catch (err) {
            log.error("Event handler failed; nak for redelivery", {
              subject: msg.subject,
              error: err instanceof Error ? err.message : String(err),
            });
            msg.nak();
          }
        }
      })().catch((err: unknown) => {
        if (!stopped) {
          log.error("Consumer loop terminated", {
            durable: subOptions.durable,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      });

      const stop = async () => {
        stopped = true;
        messages.stop();
        await loop;
      };

      subscriptions.push({ stop });
      return stop;
    },

    async close(): Promise<void> {
      for (const sub of subscriptions) {
        await sub.stop().catch(() => undefined);
      }
      subscriptions.length = 0;
      if (nc && !nc.isClosed()) {
        await nc.drain();
      }
      nc = undefined;
      js = undefined;
    },
  };
}
