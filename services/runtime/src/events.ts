import {
  createEventBus,
  createLogger,
  optional,
  ulid,
  type EventBus,
} from "@agentsphere/common";
import { createMeshEvent, type MeshEventType } from "@agentsphere/contracts";

const log = createLogger("runtime");
const SOURCE = "agentsphere/runtime";

let bus: EventBus | undefined;

export async function initRuntimeEvents(): Promise<void> {
  const natsUrl = optional("AS_NATS_URL", "");
  if (!natsUrl) return;
  bus = await createEventBus({
    natsUrl,
    source: SOURCE,
    logger: log,
    required: false,
  });
}

export async function closeRuntimeEvents(): Promise<void> {
  if (bus) {
    await bus.close();
    bus = undefined;
  }
}

async function publish(
  type: MeshEventType,
  tenantId: string,
  data: unknown,
  opts?: {
    projectId?: string;
    correlationId?: string;
    agentId?: string;
  },
): Promise<void> {
  if (!bus?.isConnected()) return;
  const event = createMeshEvent({
    id: ulid(),
    type,
    source: SOURCE,
    tenantId,
    projectId: opts?.projectId,
    correlationId: opts?.correlationId,
    agentId: opts?.agentId,
    data,
  });
  try {
    await bus.publish(event);
  } catch (err) {
    log.warn("Failed to publish runtime event", {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function publishTaskStarted(input: {
  taskId: string;
  capability: string;
  tenantId: string;
  projectId?: string;
  correlationId?: string;
  instanceId?: string;
  agentName?: string;
}): Promise<void> {
  await publish(
    "com.agentsphere.task.started",
    input.tenantId,
    {
      taskId: input.taskId,
      capability: input.capability,
      instanceId: input.instanceId,
      agentName: input.agentName,
      startedAt: new Date().toISOString(),
    },
    {
      projectId: input.projectId,
      correlationId: input.correlationId,
      agentId: input.instanceId,
    },
  );
}

export async function publishTaskCompleted(input: {
  taskId: string;
  capability: string;
  tenantId: string;
  projectId?: string;
  correlationId?: string;
  instanceId: string;
  agentName: string;
  latencyMs: number;
}): Promise<void> {
  await publish(
    "com.agentsphere.task.completed",
    input.tenantId,
    {
      taskId: input.taskId,
      capability: input.capability,
      instanceId: input.instanceId,
      agentName: input.agentName,
      latencyMs: input.latencyMs,
      completedAt: new Date().toISOString(),
    },
    {
      projectId: input.projectId,
      correlationId: input.correlationId,
      agentId: input.instanceId,
    },
  );
}

export async function publishTaskFailed(input: {
  taskId: string;
  capability: string;
  tenantId: string;
  projectId?: string;
  correlationId?: string;
  instanceId?: string;
  agentName?: string;
  code: string;
  message: string;
  latencyMs: number;
}): Promise<void> {
  await publish(
    "com.agentsphere.task.failed",
    input.tenantId,
    {
      taskId: input.taskId,
      capability: input.capability,
      instanceId: input.instanceId,
      agentName: input.agentName,
      code: input.code,
      message: input.message,
      latencyMs: input.latencyMs,
      failedAt: new Date().toISOString(),
    },
    {
      projectId: input.projectId,
      correlationId: input.correlationId,
      agentId: input.instanceId,
    },
  );
}

export async function publishRoutingFailed(input: {
  capability: string;
  tenantId: string;
  projectId?: string;
  correlationId?: string;
  code: string;
  message: string;
}): Promise<void> {
  await publish(
    "com.agentsphere.routing.failed",
    input.tenantId,
    {
      capability: input.capability,
      code: input.code,
      message: input.message,
      failedAt: new Date().toISOString(),
    },
    {
      projectId: input.projectId,
      correlationId: input.correlationId,
    },
  );
}
