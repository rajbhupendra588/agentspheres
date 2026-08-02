import {
  createMeshEvent,
  subjectForEventType,
  type CreateMeshEventInput,
  type MeshEvent,
  type MeshEventType,
} from "@agentsphere/contracts";
import type pg from "pg";
import type { EventBus } from "./bus.js";
import { createLogger, type Logger } from "../logger.js";
import { ulid } from "../id.js";

/**
 * @deprecated Prefer `runMigrations()` (V2__event_outbox.sql).
 * Kept as a safety net for tests / partial boots that skip the migrator.
 */
export async function ensureOutboxSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished
  ON event_outbox (created_at ASC)
  WHERE published_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_event_outbox_tenant
  ON event_outbox (tenant_id, created_at DESC);
`);
}

export interface OutboxEnqueueInput {
  type: MeshEventType;
  source: string;
  tenantId: string;
  data: unknown;
  projectId?: string;
  correlationId?: string;
  requestId?: string;
  agentId?: string;
  /** Stable id for idempotency; generated if omitted. */
  id?: string;
}

/**
 * Enqueues a CloudEvents mesh event into the transactional outbox.
 * Call inside the same DB transaction as the domain write.
 */
export async function enqueueOutboxEvent(
  client: pg.PoolClient | pg.Pool,
  input: OutboxEnqueueInput,
): Promise<MeshEvent> {
  const id = input.id ?? ulid();
  const eventInput: CreateMeshEventInput = {
    id,
    type: input.type,
    source: input.source,
    tenantId: input.tenantId,
    projectId: input.projectId,
    correlationId: input.correlationId,
    requestId: input.requestId,
    agentId: input.agentId,
    data: input.data,
  };
  const event = createMeshEvent(eventInput);
  const subject = subjectForEventType(event.type);

  await client.query(
    `
    INSERT INTO event_outbox (
      id, tenant_id, project_id, subject, event_type, payload
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (id) DO NOTHING
    `,
    [
      event.id,
      event.tenantid,
      event.projectid ?? null,
      subject,
      event.type,
      JSON.stringify(event),
    ],
  );

  return event;
}

export interface OutboxRelayOptions {
  pool: pg.Pool;
  bus: EventBus;
  batchSize?: number;
  intervalMs?: number;
  logger?: Logger;
}

/**
 * Polls unpublished outbox rows and publishes them to JetStream.
 * Uses SKIP LOCKED so multiple registry replicas can relay safely.
 * Marks rows published only after a successful bus publish (at-least-once).
 */
export function startOutboxRelay(options: OutboxRelayOptions): () => void {
  const log = options.logger ?? createLogger("outbox-relay");
  const batchSize = options.batchSize ?? 50;
  const intervalMs = options.intervalMs ?? 500;
  let stopped = false;
  let running = false;

  const tick = async (): Promise<void> => {
    if (stopped || running) return;
    if (!options.bus.isConnected()) return;
    running = true;

    const client = await options.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<{
        id: string;
        payload: MeshEvent | string;
      }>(
        `
        SELECT id, payload
        FROM event_outbox
        WHERE published_at IS NULL
        ORDER BY created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
        `,
        [batchSize],
      );

      for (const row of result.rows) {
        try {
          const event =
            typeof row.payload === "string"
              ? (JSON.parse(row.payload) as MeshEvent)
              : row.payload;
          await options.bus.publish(event);
          await client.query(
            `
            UPDATE event_outbox
            SET published_at = NOW(), last_error = NULL
            WHERE id = $1
            `,
            [row.id],
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await client.query(
            `
            UPDATE event_outbox
            SET attempts = attempts + 1, last_error = $2
            WHERE id = $1
            `,
            [row.id, message.slice(0, 2000)],
          );
          log.warn("Outbox publish failed", { id: row.id, error: message });
        }
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      log.error("Outbox relay tick failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      client.release();
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref?.();
  void tick();

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
