import {
  createEventBus,
  createLogger,
  type EventBus,
} from "@agentsphere/common";
import { toEventProjection, type MeshEvent } from "@agentsphere/contracts";
import { broadcast } from "./clients.js";
import { config } from "./config.js";

const log = createLogger("notification");
const SOURCE = "agentsphere/notification";

let bus: EventBus | undefined;
let stopConsumer: (() => Promise<void>) | undefined;

export async function startEventBridge(): Promise<void> {
  if (!config.natsUrl) {
    log.warn("AS_NATS_URL unset; SSE will only receive HTTP /v1/publish events");
    return;
  }

  bus = await createEventBus({
    natsUrl: config.natsUrl,
    source: SOURCE,
    logger: log,
    required: false,
  });

  if (!bus.isConnected()) {
    log.warn("Event bus not connected; JetStream bridge inactive");
    return;
  }

  stopConsumer = await bus.subscribe({
    durable: config.consumerDurable,
    filter: "agentsphere.>",
    deliverPolicy: "new",
    handler: async (event: MeshEvent) => {
      const projection = toEventProjection(event);
      const delivered = broadcast(projection);
      log.info("bridged mesh event to SSE", {
        type: event.type,
        id: event.id,
        tenantId: event.tenantid,
        delivered,
      });
    },
  });

  log.info("JetStream → SSE bridge active", {
    durable: config.consumerDurable,
  });
}

export async function stopEventBridge(): Promise<void> {
  if (stopConsumer) {
    await stopConsumer();
    stopConsumer = undefined;
  }
  if (bus) {
    await bus.close();
    bus = undefined;
  }
}
