import {
  createEventBus,
  createLogger,
  optional,
  ulid,
  type EventBus,
} from "@agentsphere/common";
import { createMeshEvent, type ToolCard } from "@agentsphere/contracts";

const log = createLogger("tool-engine");
const SOURCE = "agentsphere/tool-engine";

let bus: EventBus | undefined;

export async function initToolEvents(): Promise<void> {
  const natsUrl = optional("AS_NATS_URL", "");
  if (!natsUrl) return;
  bus = await createEventBus({
    natsUrl,
    source: SOURCE,
    logger: log,
    required: false,
  });
}

export async function closeToolEvents(): Promise<void> {
  if (bus) {
    await bus.close();
    bus = undefined;
  }
}

async function publish(
  type: Parameters<typeof createMeshEvent>[0]["type"],
  tenantId: string,
  data: unknown,
  correlationId?: string,
): Promise<void> {
  if (!bus?.isConnected()) return;
  try {
    await bus.publish(
      createMeshEvent({
        id: ulid(),
        type,
        source: SOURCE,
        tenantId,
        data,
        correlationId,
      }),
    );
  } catch (err) {
    log.warn("Failed to publish tool event", {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function publishToolRegistered(card: ToolCard, tenantId: string): Promise<void> {
  await publish("com.agentsphere.tool.registered", tenantId, {
    toolId: card.id,
    tool: card.name,
    version: card.version,
    description: card.description,
    category: card.category,
    tags: card.tags,
    registeredAt: new Date().toISOString(),
  });
}

export async function publishToolUpdated(card: ToolCard, tenantId: string): Promise<void> {
  await publish("com.agentsphere.tool.updated", tenantId, {
    toolId: card.id,
    tool: card.name,
    version: card.version,
    rowVersion: card.rowVersion ?? 1,
    updatedAt: new Date().toISOString(),
  });
}

export async function publishToolDeleted(card: ToolCard, tenantId: string): Promise<void> {
  await publish("com.agentsphere.tool.deleted", tenantId, {
    toolId: card.id,
    tool: card.name,
    version: card.version,
    deletedAt: new Date().toISOString(),
  });
}

export async function publishToolDeprecated(card: ToolCard, tenantId: string): Promise<void> {
  await publish("com.agentsphere.tool.deprecated", tenantId, {
    toolId: card.id,
    tool: card.name,
    version: card.version,
    deprecatedAt: new Date().toISOString(),
  });
}

export async function publishToolConfigured(
  card: ToolCard,
  tenantId: string,
  keys: string[],
): Promise<void> {
  await publish("com.agentsphere.tool.configured", tenantId, {
    toolId: card.id,
    tool: card.name,
    version: card.version,
    configuredAt: new Date().toISOString(),
    keys,
  });
}

export async function publishToolExecuted(input: {
  executionId: string;
  toolId: string;
  tool: string;
  version?: string;
  capability?: string;
  latencyMs: number;
  agentName?: string;
  tenantId: string;
}): Promise<void> {
  await publish(
    "com.agentsphere.tool.executed",
    input.tenantId,
    {
      executionId: input.executionId,
      toolId: input.toolId,
      tool: input.tool,
      version: input.version,
      capability: input.capability,
      latencyMs: input.latencyMs,
      agentName: input.agentName,
      executedAt: new Date().toISOString(),
    },
    input.executionId,
  );
}

export async function publishToolFailed(input: {
  executionId: string;
  toolId?: string;
  tool: string;
  version?: string;
  code: string;
  message: string;
  latencyMs: number;
  attempts?: number;
  tenantId: string;
}): Promise<void> {
  await publish(
    "com.agentsphere.tool.failed",
    input.tenantId,
    {
      executionId: input.executionId,
      toolId: input.toolId,
      tool: input.tool,
      version: input.version,
      code: input.code,
      message: input.message,
      latencyMs: input.latencyMs,
      attempts: input.attempts,
      failedAt: new Date().toISOString(),
    },
    input.executionId,
  );
}

export async function publishToolHealthy(input: {
  toolId: string;
  tool: string;
  version: string;
  tenantId: string;
  message?: string;
}): Promise<void> {
  await publish("com.agentsphere.tool.healthy", input.tenantId, {
    toolId: input.toolId,
    tool: input.tool,
    version: input.version,
    status: "HEALTHY",
    message: input.message,
    checkedAt: new Date().toISOString(),
  });
}

export async function publishToolUnhealthy(input: {
  toolId: string;
  tool: string;
  version: string;
  tenantId: string;
  message?: string;
}): Promise<void> {
  await publish("com.agentsphere.tool.unhealthy", input.tenantId, {
    toolId: input.toolId,
    tool: input.tool,
    version: input.version,
    status: "UNHEALTHY",
    message: input.message,
    checkedAt: new Date().toISOString(),
  });
}
