import {
  createEventBus,
  createLogger,
  ulid,
  type EventBus,
} from "@agentsphere/common";
import { createMeshEvent } from "@agentsphere/contracts";
import type { WorkflowRun } from "./store.js";
import { config } from "./config.js";

const log = createLogger("workflow");
const SOURCE = "agentsphere/workflow";

let bus: EventBus | undefined;
let busConnectPromise: Promise<EventBus | undefined> | undefined;

async function getBus(): Promise<EventBus | undefined> {
  if (!config.natsUrl) return undefined;
  if (bus) return bus;

  busConnectPromise ??= createEventBus({
    natsUrl: config.natsUrl,
    source: SOURCE,
    logger: log,
    required: false,
  })
    .then((b) => {
      bus = b;
      return b;
    })
    .catch((err: unknown) => {
      log.warn("NATS unavailable; continuing without events", {
        error: err instanceof Error ? err.message : String(err),
      });
      return undefined;
    });

  return busConnectPromise;
}

export async function publishWorkflowStarted(
  run: WorkflowRun,
  tenantId: string,
  projectId?: string,
): Promise<void> {
  const eventBus = await getBus();
  if (!eventBus?.isConnected()) return;

  try {
    await eventBus.publish(
      createMeshEvent({
        id: ulid(),
        type: "com.agentsphere.workflow.started",
        source: SOURCE,
        tenantId,
        projectId,
        data: {
          runId: run.runId,
          workflowType: run.workflowType,
          topic: run.topic,
          startedAt: run.createdAt,
        },
      }),
    );
  } catch (err: unknown) {
    log.warn("Failed to publish workflow.started", {
      runId: run.runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function publishWorkflowCompleted(
  run: WorkflowRun,
  tenantId: string,
  projectId?: string,
): Promise<void> {
  const eventBus = await getBus();
  if (!eventBus?.isConnected()) return;

  const status = run.status === "SUCCEEDED" ? "SUCCEEDED" : "FAILED";

  try {
    await eventBus.publish(
      createMeshEvent({
        id: ulid(),
        type: "com.agentsphere.workflow.completed",
        source: SOURCE,
        tenantId,
        projectId,
        data: {
          runId: run.runId,
          workflowType: run.workflowType,
          status,
          topic: run.topic,
          completedAt: run.updatedAt,
        },
      }),
    );
  } catch (err: unknown) {
    log.warn("Failed to publish workflow.completed", {
      runId: run.runId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** @deprecated Prefer publishWorkflowStarted / publishWorkflowCompleted. */
export async function publishWorkflowUpdated(run: WorkflowRun): Promise<void> {
  log.info("workflow.updated (legacy path)", {
    runId: run.runId,
    status: run.status,
  });
}

export async function closeNats(): Promise<void> {
  if (bus) {
    await bus.close();
    bus = undefined;
    busConnectPromise = undefined;
  }
}
