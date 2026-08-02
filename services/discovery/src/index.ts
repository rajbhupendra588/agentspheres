import Fastify from "fastify";
import { Redis } from "ioredis";
import {
  DiscoveryQuerySchema,
  DiscoveryResultSchema,
  PORTS,
  type DiscoveryInstance,
  type DiscoveryQuery,
  type DiscoveryResult,
} from "@agentsphere/contracts";
import {
  createLogger,
  createPgPool,
  healthRoutes,
  optional,
  required,
  resolveProjectId,
  resolveTenantId,
  toErrorBody,
} from "@agentsphere/common";
import {
  buildDiscoveryCacheKey,
  DISCOVERY_CACHE_TTL_SECONDS,
} from "./cache.js";
import { startCacheInvalidation, stopCacheInvalidation } from "./invalidate.js";
import { weightedRoundRobinOrder } from "./round-robin.js";

const log = createLogger("discovery");
const pool = createPgPool(required("AS_DATABASE_URL"));

let redis: Redis | undefined;

async function connectRedis(): Promise<void> {
  const url = optional("AS_REDIS_URL", "");
  if (!url) {
    return;
  }

  try {
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5_000,
    });
    await redis.ping();
    log.info("connected to Redis", { url });
  } catch (err) {
    log.warn("Redis connection failed; continuing without cache", {
      error: err instanceof Error ? err.message : String(err),
    });
    redis = undefined;
  }
}

interface AgentRow {
  instance_id: string;
  agent_name: string;
  version: string;
  base_url: string;
  capabilities: string[];
  weight: number;
  status: string;
  labels: Record<string, string>;
  owner: string;
  tenant_id: string;
  project_id: string | null;
}

function rowToInstance(row: AgentRow): DiscoveryInstance {
  return {
    instanceId: row.instance_id,
    agentName: row.agent_name,
    version: row.version,
    baseUrl: row.base_url,
    capabilities: row.capabilities,
    weight: row.weight,
    status: row.status as DiscoveryInstance["status"],
    tenantId: row.tenant_id,
    projectId: row.project_id ?? undefined,
  };
}

function matchesLabels(row: AgentRow, labels?: Record<string, string>): boolean {
  if (!labels || Object.keys(labels).length === 0) {
    return true;
  }
  const rowLabels = row.labels ?? {};
  return Object.entries(labels).every(([key, value]) => rowLabels[key] === value);
}

async function fetchHealthyInstances(
  query: DiscoveryQuery & { tenant: string },
): Promise<DiscoveryInstance[]> {
  const result = await pool.query<AgentRow>(
    `
    SELECT
      instance_id, agent_name, version, base_url,
      capabilities, weight, status, labels, owner, tenant_id, project_id
    FROM agent_instances
    WHERE status = 'HEALTHY'
      AND tenant_id = $1
      AND $2 = ANY(capabilities)
      AND ($3::text IS NULL OR version = $3)
      AND ($4::text IS NULL OR project_id IS NOT DISTINCT FROM $4)
    `,
    [query.tenant, query.capability, query.version ?? null, query.projectId ?? null],
  );

  return result.rows
    .filter((row) => matchesLabels(row, query.labels))
    .map(rowToInstance);
}

async function discover(
  query: DiscoveryQuery,
  tenantId: string,
  projectId?: string,
): Promise<DiscoveryResult> {
  const effective: DiscoveryQuery & { tenant: string } = {
    ...query,
    tenant: tenantId,
    projectId: projectId ?? query.projectId,
  };

  const cacheKey = buildDiscoveryCacheKey({
    tenantId: effective.tenant,
    projectId: effective.projectId,
    capability: effective.capability,
    version: effective.version,
  });

  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return DiscoveryResultSchema.parse(JSON.parse(cached));
      }
    } catch (err) {
      log.warn("Redis cache read failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const instances = await fetchHealthyInstances(effective);
  const ordered = weightedRoundRobinOrder(instances, effective.capability);
  const limit = effective.limit ?? ordered.length;
  const selected = ordered.slice(0, limit);

  const result = DiscoveryResultSchema.parse({
    capability: effective.capability,
    instances: selected,
    resolvedAt: new Date().toISOString(),
  });

  if (redis) {
    try {
      await redis.set(cacheKey, JSON.stringify(result), "EX", DISCOVERY_CACHE_TTL_SECONDS);
    } catch (err) {
      log.warn("Redis cache write failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

function parseGetQuery(
  query: Record<string, string | string[] | undefined>,
): DiscoveryQuery {
  const raw = query;
  const limitRaw = raw.limit;

  const capability = typeof raw.capability === "string" ? raw.capability : raw.capability?.[0];
  const version = typeof raw.version === "string" ? raw.version : raw.version?.[0];
  const tenant = typeof raw.tenant === "string" ? raw.tenant : raw.tenant?.[0];
  const projectId = typeof raw.projectId === "string" ? raw.projectId : raw.projectId?.[0];
  const limitValue = typeof limitRaw === "string" ? limitRaw : limitRaw?.[0];

  return DiscoveryQuerySchema.parse({
    capability,
    version: version || undefined,
    tenant: tenant || undefined,
    projectId: projectId || undefined,
    limit: limitValue !== undefined ? Number(limitValue) : undefined,
  });
}

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.setErrorHandler((err, _request, reply) => {
  const { statusCode, body } = toErrorBody(err);
  reply.status(statusCode).send(body);
});

app.get("/v1/discover", async (request) => {
  const query = parseGetQuery(request.query as Record<string, string | string[] | undefined>);
  const tenantId = resolveTenantId(request.headers, query.tenant);
  const projectId = resolveProjectId(request.headers, query.projectId);
  return discover(query, tenantId, projectId);
});

app.post("/v1/discover", async (request) => {
  const query = DiscoveryQuerySchema.parse(request.body);
  const tenantId = resolveTenantId(request.headers, query.tenant);
  const projectId = resolveProjectId(request.headers, query.projectId);
  return discover(query, tenantId, projectId);
});

const port = Number(process.env.PORT ?? PORTS.discovery);

async function main(): Promise<void> {
  await connectRedis();
  await startCacheInvalidation(redis);
  await app.listen({ port, host: "0.0.0.0" });
  log.info("discovery service listening", { port });
}

main().catch((err) => {
  log.error("failed to start discovery service", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  log.info("received shutdown signal", { signal });
  await stopCacheInvalidation();
  await app.close();
  await pool.end();
  if (redis) {
    redis.disconnect();
  }
  process.exit(0);
}
