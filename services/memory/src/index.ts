import Fastify from "fastify";
import { Redis } from "ioredis";
import { z } from "zod";
import {
  MemoryGetRequestSchema,
  MemoryRecordSchema,
  MemoryScopeSchema,
  MemorySetRequestSchema,
  PORTS,
  type MemoryRecord,
  type MemoryScope,
  type TenantId,
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
  ulid,
} from "@agentsphere/common";

const log = createLogger("memory");
const port = Number(optional("PORT", String(PORTS.memory)));
const redisUrl = optional("AS_REDIS_URL", "redis://localhost:6379");
const databaseUrl = required("AS_DATABASE_URL");

const MemorySearchRequestSchema = z.object({
  query: z.string().min(1),
  scope: MemoryScopeSchema.optional(),
  tenantId: z.string().optional(),
  projectId: z.string().optional(),
  workspaceId: z.string().optional(),
  limit: z.number().int().positive().optional(),
});

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS memory_records (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  project_id TEXT,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  scope TEXT NOT NULL,
  session_id TEXT,
  agent_name TEXT,
  workspace_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

const MIGRATION_SQL = `
ALTER TABLE memory_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE memory_records ADD COLUMN IF NOT EXISTS project_id TEXT;
ALTER TABLE memory_records DROP CONSTRAINT IF EXISTS memory_records_scope_key_session_id_agent_name_workspace_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS memory_records_tenant_scope_key_idx
  ON memory_records (tenant_id, scope, key, (COALESCE(session_id,'')), (COALESCE(agent_name,'')), (COALESCE(workspace_id,'')));
`;

const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

const pool = createPgPool(databaseUrl);

type PgMemoryRow = {
  tenant_id: string;
  project_id: string | null;
  key: string;
  value: unknown;
  scope: MemoryScope;
  session_id: string | null;
  agent_name: string | null;
  workspace_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function tenantMismatchError(headerTenant: TenantId, bodyTenant: TenantId): Error {
  return Object.assign(
    new Error(`Body tenantId (${bodyTenant}) does not match request tenant (${headerTenant})`),
    { statusCode: 403, code: "TENANT_MISMATCH" },
  );
}

function resolveRequestTenant(
  headers: Record<string, unknown>,
  bodyTenantId?: string,
): TenantId {
  const headerTenant = resolveTenantId(headers, null);
  if (bodyTenantId !== undefined && bodyTenantId !== headerTenant) {
    throw tenantMismatchError(headerTenant, resolveTenantId(headers, bodyTenantId));
  }
  return headerTenant;
}

function sessionRedisKey(tenantId: string, sessionId: string, key: string): string {
  return `mem:session:${tenantId}:${sessionId}:${key}`;
}

function scopeDimensions(scope: MemoryScope, record: {
  sessionId?: string;
  agentName?: string;
  workspaceId?: string;
}): void {
  if (scope === "session" && !record.sessionId) {
    throw Object.assign(new Error("sessionId is required for session scope"), {
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  }
  if (scope === "agent" && !record.agentName) {
    throw Object.assign(new Error("agentName is required for agent scope"), {
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  }
  if (scope === "workspace" && !record.workspaceId) {
    throw Object.assign(new Error("workspaceId is required for workspace scope"), {
      statusCode: 400,
      code: "VALIDATION_ERROR",
    });
  }
}

function rowToMemoryRecord(row: PgMemoryRow): MemoryRecord {
  return MemoryRecordSchema.parse({
    key: row.key,
    value: row.value,
    scope: row.scope,
    tenantId: row.tenant_id,
    projectId: row.project_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    agentName: row.agent_name ?? undefined,
    workspaceId: row.workspace_id ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  });
}

async function getSessionRecord(
  tenantId: string,
  sessionId: string,
  key: string,
): Promise<MemoryRecord | null> {
  const raw = await redis.get(sessionRedisKey(tenantId, sessionId, key));
  if (!raw) {
    return null;
  }
  const record = MemoryRecordSchema.parse(JSON.parse(raw));
  if (record.tenantId !== tenantId) {
    return null;
  }
  return record;
}

async function setSessionRecord(record: MemoryRecord): Promise<MemoryRecord> {
  const now = new Date().toISOString();
  const stored = MemoryRecordSchema.parse({
    ...record,
    scope: "session",
    createdAt: record.createdAt ?? now,
    updatedAt: now,
  });

  const redisKey = sessionRedisKey(stored.tenantId, stored.sessionId!, stored.key);
  if (stored.ttlSeconds) {
    await redis.set(redisKey, JSON.stringify(stored), "EX", stored.ttlSeconds);
  } else {
    await redis.set(redisKey, JSON.stringify(stored));
  }

  return stored;
}

async function getPgRecord(query: {
  tenantId: string;
  key: string;
  scope: MemoryScope;
  sessionId?: string;
  agentName?: string;
  workspaceId?: string;
}): Promise<MemoryRecord | null> {
  const result = await pool.query<PgMemoryRow>(
    `SELECT tenant_id, project_id, key, value, scope, session_id, agent_name, workspace_id, created_at, updated_at
     FROM memory_records
     WHERE tenant_id = $1 AND scope = $2 AND key = $3
       AND session_id IS NOT DISTINCT FROM $4
       AND agent_name IS NOT DISTINCT FROM $5
       AND workspace_id IS NOT DISTINCT FROM $6
     LIMIT 1`,
    [
      query.tenantId,
      query.scope,
      query.key,
      query.sessionId ?? null,
      query.agentName ?? null,
      query.workspaceId ?? null,
    ],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return rowToMemoryRecord(row);
}

async function setPgRecord(record: MemoryRecord): Promise<MemoryRecord> {
  const updateResult = await pool.query<PgMemoryRow>(
    `UPDATE memory_records
     SET value = $7::jsonb, project_id = $8, updated_at = NOW()
     WHERE tenant_id = $1 AND scope = $2 AND key = $3
       AND session_id IS NOT DISTINCT FROM $4
       AND agent_name IS NOT DISTINCT FROM $5
       AND workspace_id IS NOT DISTINCT FROM $6
     RETURNING tenant_id, project_id, key, value, scope, session_id, agent_name, workspace_id, created_at, updated_at`,
    [
      record.tenantId,
      record.scope,
      record.key,
      record.sessionId ?? null,
      record.agentName ?? null,
      record.workspaceId ?? null,
      JSON.stringify(record.value),
      record.projectId ?? null,
    ],
  );

  if (updateResult.rowCount && updateResult.rowCount > 0) {
    return rowToMemoryRecord(updateResult.rows[0]!);
  }

  const insertResult = await pool.query<PgMemoryRow>(
    `INSERT INTO memory_records (id, tenant_id, project_id, key, value, scope, session_id, agent_name, workspace_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9)
     RETURNING tenant_id, project_id, key, value, scope, session_id, agent_name, workspace_id, created_at, updated_at`,
    [
      ulid(),
      record.tenantId,
      record.projectId ?? null,
      record.key,
      JSON.stringify(record.value),
      record.scope,
      record.sessionId ?? null,
      record.agentName ?? null,
      record.workspaceId ?? null,
    ],
  );

  return rowToMemoryRecord(insertResult.rows[0]!);
}

async function searchSessionRecords(
  tenantId: string,
  query: string,
  limit: number,
): Promise<MemoryRecord[]> {
  const pattern = `mem:session:${tenantId}:*`;
  const keys = await redis.keys(pattern);
  const records: MemoryRecord[] = [];
  const needle = query.toLowerCase();

  for (const redisKey of keys) {
    if (records.length >= limit) {
      break;
    }

    const raw = await redis.get(redisKey);
    if (!raw) {
      continue;
    }

    try {
      const record = MemoryRecordSchema.parse(JSON.parse(raw));
      if (record.tenantId !== tenantId) {
        continue;
      }
      const haystack = `${record.key} ${JSON.stringify(record.value)}`.toLowerCase();
      if (haystack.includes(needle)) {
        records.push(record);
      }
    } catch {
      continue;
    }
  }

  return records;
}

async function searchPgRecords(
  tenantId: string,
  query: string,
  scope: MemoryScope | undefined,
  workspaceId: string | undefined,
  limit: number,
): Promise<MemoryRecord[]> {
  const params: unknown[] = [tenantId, `%${query}%`];
  let sql = `
    SELECT tenant_id, project_id, key, value, scope, session_id, agent_name, workspace_id, created_at, updated_at
    FROM memory_records
    WHERE tenant_id = $1 AND (key ILIKE $2 OR value::text ILIKE $2)
  `;

  if (scope) {
    params.push(scope);
    sql += ` AND scope = $${params.length}`;
  }
  if (workspaceId) {
    params.push(workspaceId);
    sql += ` AND workspace_id = $${params.length}`;
  }

  params.push(limit);
  sql += ` ORDER BY updated_at DESC LIMIT $${params.length}`;

  const result = await pool.query<PgMemoryRow>(sql, params);
  return result.rows.map(rowToMemoryRecord);
}

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.put("/v1/memory", async (request, reply) => {
  try {
    const body = MemorySetRequestSchema.parse(request.body);
    const tenantId = resolveRequestTenant(request.headers, body.tenantId);
    const projectId = resolveProjectId(request.headers, body.projectId);
    scopeDimensions(body.scope, body);

    const recordInput = MemoryRecordSchema.parse({
      ...body,
      tenantId,
      projectId,
    });

    const record =
      body.scope === "session"
        ? await setSessionRecord(recordInput)
        : await setPgRecord(recordInput);

    return record;
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

app.post("/v1/memory/get", async (request, reply) => {
  try {
    const query = MemoryGetRequestSchema.parse(request.body);
    const tenantId = resolveRequestTenant(request.headers, query.tenantId);
    scopeDimensions(query.scope, query);

    const record =
      query.scope === "session"
        ? await getSessionRecord(tenantId, query.sessionId!, query.key)
        : await getPgRecord({ ...query, tenantId });

    if (!record) {
      reply.status(404);
      return {
        error: {
          code: "NOT_FOUND",
          message: `Memory record not found for key: ${query.key}`,
        },
      };
    }

    return { record };
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

app.post("/v1/memory/search", async (request, reply) => {
  try {
    const body = MemorySearchRequestSchema.parse(request.body);
    const tenantId = resolveRequestTenant(request.headers, body.tenantId);
    const limit = body.limit ?? 20;
    const records: MemoryRecord[] = [];

    if (!body.scope || body.scope === "session") {
      records.push(...(await searchSessionRecords(tenantId, body.query, limit)));
    }

    if (!body.scope || body.scope !== "session") {
      const pgRecords = await searchPgRecords(
        tenantId,
        body.query,
        body.scope,
        body.workspaceId,
        limit,
      );
      records.push(...pgRecords);
    }

    const deduped = new Map<string, MemoryRecord>();
    for (const record of records) {
      const id = [
        record.tenantId,
        record.scope,
        record.key,
        record.sessionId ?? "",
        record.agentName ?? "",
        record.workspaceId ?? "",
      ].join(":");
      deduped.set(id, record);
    }

    return {
      records: [...deduped.values()].slice(0, limit),
      count: Math.min(deduped.size, limit),
      query: body.query,
    };
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

async function main(): Promise<void> {
  await pool.query(INIT_SQL);
  await pool.query(MIGRATION_SQL);
  await redis.connect();

  await app.listen({ port, host: "0.0.0.0" });
  log.info("memory listening", { port, redisUrl });
}

main().catch((err) => {
  log.error("memory failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  log.info("received shutdown signal", { signal });
  await app.close();
  await redis.quit();
  await pool.end();
  process.exit(0);
}
