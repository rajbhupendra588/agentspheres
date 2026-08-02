import { createLogger } from "@agentsphere/common";
import { subjects } from "@agentsphere/contracts";
import type { NatsConnection } from "nats";
import { connect } from "nats";
import type { WorkflowRun } from "./store.js";
import { config } from "./config.js";

const log = createLogger("workflow");

let natsConnection: NatsConnection | undefined;
let natsConnectPromise: Promise<NatsConnection | undefined> | undefined;

async function getNatsConnection(): Promise<NatsConnection | undefined> {
  if (!config.natsUrl) return undefined;
  if (natsConnection) return natsConnection;

  natsConnectPromise ??= connect({ servers: config.natsUrl })
    .then((nc) => {
      natsConnection = nc;
      log.info("Connected to NATS", { url: config.natsUrl });
      return nc;
    })
    .catch((err: unknown) => {
      log.warn("NATS unavailable; continuing without events", {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    });

  return natsConnectPromise;
}

export async function publishWorkflowUpdated(run: WorkflowRun): Promise<void> {
  const nc = await getNatsConnection();
  if (!nc) return;

  try {
    nc.publish(
      subjects.workflowUpdated,
      JSON.stringify({
        runId: run.runId,
        status: run.status,
        workflowType: run.workflowType,
        updatedAt: run.updatedAt,
      }),
    );
  } catch (err: unknown) {
    log.warn("Failed to publish workflow event", {
      runId: run.runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function closeNats(): Promise<void> {
  if (natsConnection) {
    await natsConnection.drain();
    natsConnection = undefined;
    natsConnectPromise = undefined;
  }
}
