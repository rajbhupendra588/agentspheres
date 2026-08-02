import {
  createEventBus,
  createLogger,
  DEFAULT_TENANT_ID,
  optional,
  ulid,
  type EventBus,
} from "@agentsphere/common";
import { createMeshEvent, type ToolDefinition } from "@agentsphere/contracts";

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

export async function publishToolRegistered(
  tool: ToolDefinition,
  tenantId: string = DEFAULT_TENANT_ID,
): Promise<void> {
  if (!bus?.isConnected()) return;
  try {
    await bus.publish(
      createMeshEvent({
        id: ulid(),
        type: "com.agentsphere.tool.registered",
        source: SOURCE,
        tenantId,
        data: {
          tool: tool.name,
          version: tool.version,
          description: tool.description,
          tags: tool.tags,
          registeredAt: new Date().toISOString(),
        },
      }),
    );
  } catch (err) {
    log.warn("Failed to publish ToolRegistered", {
      tool: tool.name,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
