import {
  createEventBus,
  createLogger,
  optional,
  ulid,
  type EventBus,
} from "@agentsphere/common";
import type { MeshEvent } from "@agentsphere/contracts";
import type { Redis } from "ioredis";
import { invalidateDiscoveryCache } from "./cache.js";

const log = createLogger("discovery");
const SOURCE = "agentsphere/discovery";

const INVALIDATING_TYPES = new Set([
  "com.agentsphere.agent.registered",
  "com.agentsphere.agent.updated",
  "com.agentsphere.agent.offline",
  "com.agentsphere.agent.deregistered",
  "com.agentsphere.agent.heartbeat",
]);

let bus: EventBus | undefined;
let stopConsumer: (() => Promise<void>) | undefined;

interface AgentEventData {
  capabilities?: string[];
  version?: string;
  projectId?: string;
  status?: string;
}

function asData(event: MeshEvent): AgentEventData {
  if (typeof event.data === "object" && event.data !== null) {
    return event.data as AgentEventData;
  }
  return {};
}

export async function startCacheInvalidation(redis: Redis | undefined): Promise<void> {
  if (!redis) {
    log.info("Cache invalidation skipped — Redis unavailable");
    return;
  }

  const natsUrl = optional("AS_NATS_URL", "");
  if (!natsUrl) {
    log.info("Cache invalidation skipped — AS_NATS_URL unset");
    return;
  }

  bus = await createEventBus({
    natsUrl,
    source: SOURCE,
    logger: log,
    required: false,
  });

  if (!bus.isConnected()) {
    log.warn("Cache invalidation inactive — event bus not connected");
    return;
  }

  const durable =
    optional("AS_DISCOVERY_DURABLE", "") ||
    `discovery-cache-${process.env.HOSTNAME ?? "local"}-${process.pid}-${ulid().slice(-8)}`;

  stopConsumer = await bus.subscribe({
    durable,
    filter: "agentsphere.agent.>",
    deliverPolicy: "new",
    handler: async (event) => {
      await handleRegistryEvent(redis, event);
    },
  });

  log.info("Discovery cache invalidation consumer active", { durable });
}

async function handleRegistryEvent(redis: Redis, event: MeshEvent): Promise<void> {
  if (!INVALIDATING_TYPES.has(event.type)) {
    return;
  }

  const data = asData(event);
  const tenantId = event.tenantid;
  const projectId = event.projectid ?? data.projectId;

  // Heartbeats are high volume — only invalidate when leaving HEALTHY.
  if (event.type === "com.agentsphere.agent.heartbeat") {
    if (!data.status || data.status === "HEALTHY") {
      return;
    }
    await invalidateDiscoveryCache(redis, {
      tenantId,
      projectId,
      mode: "tenant",
    });
    return;
  }

  if (
    event.type === "com.agentsphere.agent.registered" ||
    event.type === "com.agentsphere.agent.updated"
  ) {
    await invalidateDiscoveryCache(redis, {
      tenantId,
      projectId,
      capabilities: data.capabilities,
      version: data.version,
      mode: "targeted",
    });
    return;
  }

  // offline / deregistered — agent may no longer be in the result set
  await invalidateDiscoveryCache(redis, {
    tenantId,
    projectId,
    mode: "tenant",
  });
}

export async function stopCacheInvalidation(): Promise<void> {
  if (stopConsumer) {
    await stopConsumer();
    stopConsumer = undefined;
  }
  if (bus) {
    await bus.close();
    bus = undefined;
  }
}
