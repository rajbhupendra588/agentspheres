import Fastify from "fastify";
import { connect, type NatsConnection } from "nats";
import {
  CreateTenantRequestSchema,
  DeregisterAgentRequestSchema,
  HeartbeatRequestSchema,
  InviteTenantMemberRequestSchema,
  PORTS,
  RegisterAgentRequestSchema,
  RegisterAgentResponseSchema,
  TenantIdSchema,
  TenantMemberSchema,
  TenantRecordSchema,
  subjects,
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
import { deleteExpired, initSchema, markStaleUnhealthy } from "./db.js";

const log = createLogger("registry");
const pool = createPgPool(required("AS_DATABASE_URL"));

let nats: NatsConnection | undefined;

async function connectNats(): Promise<void> {
  const url = optional("AS_NATS_URL", "");
  if (!url) {
    return;
  }

  try {
    nats = await connect({ servers: url });
    log.info("connected to NATS", { url });
  } catch (err) {
    log.warn("NATS connection failed; continuing without event publishing", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function publish(subject: string, payload: unknown): void {
  if (!nats) {
    return;
  }
  nats.publish(subject, JSON.stringify(payload));
}

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.setErrorHandler((err, _request, reply) => {
  const { statusCode, body } = toErrorBody(err);
  reply.status(statusCode).send(body);
});

app.post("/v1/register", async (request, reply) => {
  const body = RegisterAgentRequestSchema.parse(request.body);
  const { card, baseUrl, weight } = body;
  const instanceId = body.instanceId ?? ulid();
  const labels = card.metadata.labels ?? {};
  const tenantId = card.metadata.tenantId;
  const projectId = card.metadata.projectId ?? resolveProjectId(request.headers);
  const requestTenant = resolveTenantId(request.headers, null, tenantId);

  if (requestTenant !== tenantId) {
    reply.status(403);
    return {
      error: {
        code: "TENANT_MISMATCH",
        message: `Agent card tenantId (${tenantId}) does not match request tenant (${requestTenant})`,
      },
    };
  }

  const tenantRow = await pool.query<{ status: string }>(
    `SELECT status FROM tenants WHERE tenant_id = $1`,
    [tenantId],
  );
  if (!tenantRow.rowCount) {
    reply.status(404);
    return {
      error: {
        code: "TENANT_NOT_FOUND",
        message: `Tenant "${tenantId}" does not exist. Create it before registering agents.`,
      },
    };
  }
  if (tenantRow.rows[0]?.status !== "active") {
    reply.status(403);
    return {
      error: {
        code: "TENANT_SUSPENDED",
        message: `Tenant "${tenantId}" is not active`,
      },
    };
  }

  const existing = await pool.query(
    "SELECT instance_id, tenant_id FROM agent_instances WHERE instance_id = $1",
    [instanceId],
  );
  const isUpdate = existing.rowCount !== null && existing.rowCount > 0;

  if (isUpdate && existing.rows[0]?.tenant_id !== tenantId) {
    reply.status(403);
    return {
      error: {
        code: "TENANT_FORBIDDEN",
        message: "Cannot update an agent instance owned by another tenant",
      },
    };
  }

  await pool.query(
    `
    INSERT INTO agent_instances (
      instance_id, agent_name, version, owner, tenant_id, project_id, base_url,
      capabilities, labels, weight, status, card,
      last_heartbeat, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'HEALTHY', $11, NOW(), NOW())
    ON CONFLICT (instance_id) DO UPDATE SET
      agent_name = EXCLUDED.agent_name,
      version = EXCLUDED.version,
      owner = EXCLUDED.owner,
      tenant_id = EXCLUDED.tenant_id,
      project_id = EXCLUDED.project_id,
      base_url = EXCLUDED.base_url,
      capabilities = EXCLUDED.capabilities,
      labels = EXCLUDED.labels,
      weight = EXCLUDED.weight,
      status = 'HEALTHY',
      card = EXCLUDED.card,
      last_heartbeat = NOW(),
      updated_at = NOW()
    `,
    [
      instanceId,
      card.metadata.name,
      card.metadata.version,
      card.metadata.owner,
      tenantId,
      projectId ?? null,
      baseUrl,
      card.spec.capabilities,
      JSON.stringify(labels),
      weight ?? 100,
      JSON.stringify(card),
    ],
  );

  const registeredAt = new Date().toISOString();
  const response = RegisterAgentResponseSchema.parse({
    instanceId,
    agentName: card.metadata.name,
    version: card.metadata.version,
    status: isUpdate ? "UPDATED" : "REGISTERED",
    registeredAt,
  });

  publish(subjects.agentRegistered, {
    instanceId,
    agentName: card.metadata.name,
    version: card.metadata.version,
    tenantId,
    projectId,
    baseUrl,
    capabilities: card.spec.capabilities,
    registeredAt,
  });

  reply.status(isUpdate ? 200 : 201);
  return response;
});

app.post("/v1/heartbeat", async (request, reply) => {
  const body = HeartbeatRequestSchema.parse(request.body);
  const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();
  const status = body.status ?? "HEALTHY";

  const result = await pool.query(
    `
    UPDATE agent_instances
    SET last_heartbeat = $2, status = $3, updated_at = NOW()
    WHERE instance_id = $1
    RETURNING instance_id
    `,
    [body.instanceId, timestamp, status],
  );

  if (result.rowCount === 0) {
    reply.status(404);
    return {
      error: {
        code: "NOT_FOUND",
        message: `Agent instance not found: ${body.instanceId}`,
      },
    };
  }

  publish(subjects.agentHeartbeat, {
    instanceId: body.instanceId,
    timestamp: timestamp.toISOString(),
    status,
  });

  return { ok: true };
});

app.post("/v1/deregister", async (request, reply) => {
  const body = DeregisterAgentRequestSchema.parse(request.body);

  const result = await pool.query(
    "DELETE FROM agent_instances WHERE instance_id = $1 RETURNING agent_name, version",
    [body.instanceId],
  );

  if (result.rowCount === 0) {
    reply.status(404);
    return {
      error: {
        code: "NOT_FOUND",
        message: `Agent instance not found: ${body.instanceId}`,
      },
    };
  }

  const row = result.rows[0] as { agent_name: string; version: string };

  publish(subjects.agentDeregistered, {
    instanceId: body.instanceId,
    agentName: row.agent_name,
    version: row.version,
    reason: body.reason,
    deregisteredAt: new Date().toISOString(),
  });

  return { ok: true };
});

app.get("/v1/tenants", async () => {
  const result = await pool.query<{
    tenant_id: string;
    display_name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    agent_count: string;
    member_count: string;
  }>(
    `
    SELECT
      t.tenant_id,
      t.display_name,
      t.status,
      t.created_at,
      t.updated_at,
      COALESCE(a.agent_count, 0)::text AS agent_count,
      COALESCE(m.member_count, 0)::text AS member_count
    FROM tenants t
    LEFT JOIN (
      SELECT tenant_id, COUNT(*)::int AS agent_count
      FROM agent_instances
      GROUP BY tenant_id
    ) a ON a.tenant_id = t.tenant_id
    LEFT JOIN (
      SELECT tenant_id, COUNT(*)::int AS member_count
      FROM tenant_members
      GROUP BY tenant_id
    ) m ON m.tenant_id = t.tenant_id
    ORDER BY t.tenant_id
    `,
  );

  const tenants = result.rows.map((row) =>
    TenantRecordSchema.parse({
      tenantId: row.tenant_id,
      displayName: row.display_name,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      agentCount: Number(row.agent_count),
      memberCount: Number(row.member_count),
    }),
  );

  return {
    tenants,
    // backward-compatible id list for switchers
    tenantIds: tenants.map((t) => t.tenantId),
    count: tenants.length,
  };
});

app.post("/v1/tenants", async (request, reply) => {
  const body = CreateTenantRequestSchema.parse(request.body);
  const displayName = body.displayName?.trim() || body.tenantId;

  const existing = await pool.query(`SELECT tenant_id FROM tenants WHERE tenant_id = $1`, [
    body.tenantId,
  ]);
  if (existing.rowCount) {
    reply.status(409);
    return {
      error: {
        code: "TENANT_EXISTS",
        message: `Tenant already exists: ${body.tenantId}`,
      },
    };
  }

  const result = await pool.query<{
    tenant_id: string;
    display_name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    INSERT INTO tenants (tenant_id, display_name, status)
    VALUES ($1, $2, 'active')
    RETURNING tenant_id, display_name, status, created_at, updated_at
    `,
    [body.tenantId, displayName],
  );

  const row = result.rows[0]!;
  reply.status(201);
  return TenantRecordSchema.parse({
    tenantId: row.tenant_id,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    agentCount: 0,
    memberCount: 0,
  });
});

app.get("/v1/tenants/:tenantId", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  TenantIdSchema.parse(tenantId);

  const result = await pool.query<{
    tenant_id: string;
    display_name: string;
    status: string;
    created_at: Date;
    updated_at: Date;
    agent_count: string;
    member_count: string;
  }>(
    `
    SELECT
      t.tenant_id,
      t.display_name,
      t.status,
      t.created_at,
      t.updated_at,
      (SELECT COUNT(*)::int FROM agent_instances a WHERE a.tenant_id = t.tenant_id)::text AS agent_count,
      (SELECT COUNT(*)::int FROM tenant_members m WHERE m.tenant_id = t.tenant_id)::text AS member_count
    FROM tenants t
    WHERE t.tenant_id = $1
    `,
    [tenantId],
  );

  if (!result.rowCount) {
    reply.status(404);
    return {
      error: { code: "TENANT_NOT_FOUND", message: `Tenant not found: ${tenantId}` },
    };
  }

  const row = result.rows[0]!;
  return TenantRecordSchema.parse({
    tenantId: row.tenant_id,
    displayName: row.display_name,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    agentCount: Number(row.agent_count),
    memberCount: Number(row.member_count),
  });
});

app.get("/v1/tenants/:tenantId/members", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  TenantIdSchema.parse(tenantId);

  const tenant = await pool.query(`SELECT tenant_id FROM tenants WHERE tenant_id = $1`, [tenantId]);
  if (!tenant.rowCount) {
    reply.status(404);
    return {
      error: { code: "TENANT_NOT_FOUND", message: `Tenant not found: ${tenantId}` },
    };
  }

  const result = await pool.query<{
    tenant_id: string;
    subject: string;
    role: string;
    created_at: Date;
  }>(
    `
    SELECT tenant_id, subject, role, created_at
    FROM tenant_members
    WHERE tenant_id = $1
    ORDER BY subject
    `,
    [tenantId],
  );

  return {
    tenantId,
    members: result.rows.map((row) =>
      TenantMemberSchema.parse({
        tenantId: row.tenant_id,
        subject: row.subject,
        role: row.role,
        createdAt: row.created_at.toISOString(),
      }),
    ),
    count: result.rows.length,
  };
});

app.post("/v1/tenants/:tenantId/members", async (request, reply) => {
  const { tenantId } = request.params as { tenantId: string };
  TenantIdSchema.parse(tenantId);
  const body = InviteTenantMemberRequestSchema.parse(request.body);
  const role = body.role ?? "viewer";

  const tenant = await pool.query(`SELECT status FROM tenants WHERE tenant_id = $1`, [tenantId]);
  if (!tenant.rowCount) {
    reply.status(404);
    return {
      error: { code: "TENANT_NOT_FOUND", message: `Tenant not found: ${tenantId}` },
    };
  }

  const result = await pool.query<{
    tenant_id: string;
    subject: string;
    role: string;
    created_at: Date;
  }>(
    `
    INSERT INTO tenant_members (tenant_id, subject, role)
    VALUES ($1, $2, $3)
    ON CONFLICT (tenant_id, subject) DO UPDATE SET role = EXCLUDED.role
    RETURNING tenant_id, subject, role, created_at
    `,
    [tenantId, body.subject, role],
  );

  const row = result.rows[0]!;
  reply.status(201);
  return TenantMemberSchema.parse({
    tenantId: row.tenant_id,
    subject: row.subject,
    role: row.role,
    createdAt: row.created_at.toISOString(),
  });
});

app.get("/v1/agents", async (request) => {
  const tenantId = resolveTenantId(request.headers);
  const projectId = resolveProjectId(request.headers);
  const result = await pool.query(
    `
    SELECT
      instance_id, agent_name, version, owner, tenant_id, project_id, base_url,
      capabilities, labels, weight, status, card,
      last_heartbeat, created_at, updated_at
    FROM agent_instances
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR project_id IS NOT DISTINCT FROM $2)
    ORDER BY agent_name, instance_id
    `,
    [tenantId, projectId ?? null],
  );

  return {
    tenantId,
    projectId,
    agents: result.rows.map((row) => rowToAgent(row as AgentRow)),
    count: result.rows.length,
  };
});

app.get("/v1/agents/:instanceId", async (request, reply) => {
  const { instanceId } = request.params as { instanceId: string };
  const tenantId = resolveTenantId(request.headers);

  const result = await pool.query(
    `
    SELECT
      instance_id, agent_name, version, owner, tenant_id, project_id, base_url,
      capabilities, labels, weight, status, card,
      last_heartbeat, created_at, updated_at
    FROM agent_instances
    WHERE instance_id = $1 AND tenant_id = $2
    `,
    [instanceId, tenantId],
  );

  if (result.rowCount === 0) {
    reply.status(404);
    return {
      error: {
        code: "NOT_FOUND",
        message: `Agent instance not found in tenant ${tenantId}: ${instanceId}`,
      },
    };
  }

  return rowToAgent(result.rows[0] as AgentRow);
});

interface AgentRow {
  instance_id: string;
  agent_name: string;
  version: string;
  owner: string;
  tenant_id: string;
  project_id: string | null;
  base_url: string;
  capabilities: string[];
  labels: Record<string, string>;
  weight: number;
  status: string;
  card: unknown;
  last_heartbeat: Date;
  created_at: Date;
  updated_at: Date;
}

function rowToAgent(row: AgentRow) {
  return {
    instanceId: row.instance_id,
    agentName: row.agent_name,
    version: row.version,
    owner: row.owner,
    tenantId: row.tenant_id,
    projectId: row.project_id ?? undefined,
    baseUrl: row.base_url,
    capabilities: row.capabilities,
    labels: row.labels ?? {},
    weight: row.weight,
    status: row.status,
    card: row.card,
    lastHeartbeat: row.last_heartbeat.toISOString(),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const SWEEP_INTERVAL_MS = 10_000;

function startHealthSweep(): ReturnType<typeof setInterval> {
  const timer = setInterval(() => {
    void (async () => {
      try {
        const unhealthy = await markStaleUnhealthy(pool);
        const deleted = await deleteExpired(pool);
        if (unhealthy > 0 || deleted > 0) {
          log.info("health sweep completed", { unhealthy, deleted });
        }
      } catch (err) {
        log.error("health sweep failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    })();
  }, SWEEP_INTERVAL_MS);
  timer.unref?.();
  return timer;
}

const port = Number(process.env.PORT ?? PORTS.registry);

async function main(): Promise<void> {
  await initSchema(pool);
  await connectNats();
  startHealthSweep();

  await app.listen({ port, host: "0.0.0.0" });
  log.info("registry service listening", { port });
}

main().catch((err) => {
  log.error("failed to start registry service", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  log.info("received shutdown signal", { signal });
  await app.close();
  await pool.end();
  if (nats) {
    await nats.drain();
  }
  process.exit(0);
}
