import type pg from "pg";
import type {
  ToolAuditRecord,
  ToolConfigurationUpsert,
  ToolHealth,
  ToolMetricsSnapshot,
  ToolPermissionGrant,
} from "@agentsphere/contracts";
import { ulid } from "@agentsphere/common";
import { toolEngineConfig } from "../config.js";

export async function upsertConfiguration(
  pool: pg.Pool,
  input: {
    toolId: string;
    tenantId: string;
    version?: string;
    body: ToolConfigurationUpsert;
  },
): Promise<{ values: Record<string, unknown>; secretKeys: string[]; rowVersion: number }> {
  const secretsRef = Object.fromEntries(
    Object.keys(input.body.secrets ?? {}).map((k) => [k, `secret://${k}`]),
  );
  const result = await pool.query<{ row_version: string }>(
    `
    INSERT INTO tool_configuration (tool_id, tenant_id, version, values, secrets_ref, row_version)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,1)
    ON CONFLICT (tool_id, tenant_id, version) DO UPDATE SET
      values = EXCLUDED.values,
      secrets_ref = tool_configuration.secrets_ref || EXCLUDED.secrets_ref,
      row_version = tool_configuration.row_version + 1,
      updated_at = NOW()
    RETURNING row_version
    `,
    [
      input.toolId,
      input.tenantId,
      input.version ?? "*",
      JSON.stringify(input.body.values),
      JSON.stringify(secretsRef),
    ],
  );
  return {
    values: input.body.values,
    secretKeys: Object.keys(input.body.secrets ?? {}),
    rowVersion: Number(result.rows[0]!.row_version),
  };
}

export async function getConfiguration(
  pool: pg.Pool,
  toolId: string,
  tenantId: string,
  version?: string,
): Promise<{ values: Record<string, unknown>; secretsRef: Record<string, string> }> {
  const result = await pool.query<{ values: Record<string, unknown>; secrets_ref: Record<string, string> }>(
    `
    SELECT values, secrets_ref FROM tool_configuration
    WHERE tool_id = $1 AND tenant_id = $2 AND version IN ($3, '*')
    ORDER BY CASE WHEN version = $3 THEN 0 ELSE 1 END
    LIMIT 1
    `,
    [toolId, tenantId, version ?? "*"],
  );
  return {
    values: result.rows[0]?.values ?? {},
    secretsRef: result.rows[0]?.secrets_ref ?? {},
  };
}

export async function grantPermission(
  pool: pg.Pool,
  toolId: string,
  tenantId: string,
  grant: ToolPermissionGrant,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO tool_permissions (
      tool_id, tenant_id, principal, principal_type, permission, effect, attributes
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
    ON CONFLICT (tool_id, tenant_id, principal, permission, effect) DO UPDATE SET
      attributes = EXCLUDED.attributes
    `,
    [
      toolId,
      tenantId,
      grant.principal,
      grant.principalType,
      grant.permission,
      grant.effect,
      JSON.stringify(grant.attributes ?? {}),
    ],
  );
}

export async function listPermissions(
  pool: pg.Pool,
  toolId: string,
  tenantId: string,
): Promise<ToolPermissionGrant[]> {
  const result = await pool.query(
    `
    SELECT principal, principal_type, permission, effect, attributes
    FROM tool_permissions
    WHERE tool_id = $1 AND tenant_id = $2
    ORDER BY principal, permission
    `,
    [toolId, tenantId],
  );
  return result.rows.map((r) => ({
    principal: r.principal as string,
    principalType: r.principal_type as ToolPermissionGrant["principalType"],
    permission: r.permission as string,
    effect: r.effect as ToolPermissionGrant["effect"],
    attributes: r.attributes as Record<string, unknown>,
  }));
}

export async function evaluatePermissions(
  pool: pg.Pool,
  input: {
    toolId: string;
    tenantId: string;
    principals: string[];
    required: string[];
  },
): Promise<{ allowed: boolean; denied: string[] }> {
  if (input.required.length === 0) return { allowed: true, denied: [] };
  const result = await pool.query<{ permission: string; effect: string }>(
    `
    SELECT permission, effect FROM tool_permissions
    WHERE tool_id = $1 AND tenant_id = $2 AND principal = ANY($3::text[])
    `,
    [input.toolId, input.tenantId, input.principals],
  );

  // If no grants exist, allow (default-open for builtins); DENY always wins.
  if (result.rows.length === 0) return { allowed: true, denied: [] };

  const denied = new Set(
    result.rows.filter((r) => r.effect === "DENY").map((r) => r.permission),
  );
  const allowed = new Set(
    result.rows.filter((r) => r.effect === "ALLOW").map((r) => r.permission),
  );

  const missing: string[] = [];
  for (const perm of input.required) {
    if (denied.has(perm) || denied.has("*")) {
      missing.push(perm);
      continue;
    }
    if (!allowed.has(perm) && !allowed.has("*")) {
      missing.push(perm);
    }
  }
  return { allowed: missing.length === 0, denied: missing };
}

export async function writeAudit(
  pool: pg.Pool,
  record: Omit<ToolAuditRecord, "id" | "createdAt"> & { id?: string },
): Promise<ToolAuditRecord> {
  const id = record.id ?? ulid();
  const createdAt = new Date().toISOString();
  await pool.query(
    `
    INSERT INTO tool_audit (
      id, tenant_id, tool_id, tool_name, action, actor,
      correlation_id, execution_id, result, details, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)
    `,
    [
      id,
      record.tenantId,
      record.toolId,
      record.toolName,
      record.action,
      record.actor ?? null,
      record.correlationId ?? null,
      record.executionId ?? null,
      record.result ?? null,
      JSON.stringify(record.details ?? {}),
      createdAt,
    ],
  );
  return { ...record, id, createdAt };
}

export async function listAudit(
  pool: pg.Pool,
  tenantId: string,
  opts?: { toolId?: string; limit?: number },
): Promise<ToolAuditRecord[]> {
  const result = await pool.query(
    `
    SELECT * FROM tool_audit
    WHERE tenant_id = $1 AND ($2::text IS NULL OR tool_id = $2)
    ORDER BY created_at DESC
    LIMIT $3
    `,
    [tenantId, opts?.toolId ?? null, opts?.limit ?? 100],
  );
  return result.rows.map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    toolId: (r.tool_id as string) ?? "",
    toolName: r.tool_name as string,
    action: r.action as string,
    actor: (r.actor as string | null) ?? undefined,
    correlationId: (r.correlation_id as string | null) ?? undefined,
    executionId: (r.execution_id as string | null) ?? undefined,
    result: r.result as ToolAuditRecord["result"],
    details: r.details as Record<string, unknown>,
    createdAt: (r.created_at as Date).toISOString(),
  }));
}

export async function upsertHealth(
  pool: pg.Pool,
  toolId: string,
  tenantId: string,
  version: string,
  health: ToolHealth,
): Promise<void> {
  await pool.query(
    `
    INSERT INTO tool_health (tool_id, tenant_id, version, status, latency_ms, message, details, checked_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)
    ON CONFLICT (tool_id, tenant_id, version) DO UPDATE SET
      status = EXCLUDED.status,
      latency_ms = EXCLUDED.latency_ms,
      message = EXCLUDED.message,
      details = EXCLUDED.details,
      checked_at = EXCLUDED.checked_at
    `,
    [
      toolId,
      tenantId,
      version,
      health.status,
      health.latencyMs ?? null,
      health.message ?? null,
      JSON.stringify(health.details ?? {}),
      health.checkedAt,
    ],
  );
}

export async function listHealth(
  pool: pg.Pool,
  tenantId: string,
): Promise<Array<{ toolId: string; name: string; version: string; health: ToolHealth }>> {
  const result = await pool.query(
    `
    SELECT r.id, r.name, h.version, h.status, h.latency_ms, h.message, h.details, h.checked_at
    FROM tool_health h
    JOIN tool_registry r ON r.id = h.tool_id
    WHERE h.tenant_id = $1 AND r.lifecycle = 'ACTIVE'
    ORDER BY r.name
    `,
    [tenantId],
  );
  return result.rows.map((r) => ({
    toolId: r.id as string,
    name: r.name as string,
    version: r.version as string,
    health: {
      status: r.status as ToolHealth["status"],
      latencyMs: (r.latency_ms as number | null) ?? undefined,
      message: (r.message as string | null) ?? undefined,
      details: r.details as Record<string, unknown>,
      checkedAt: (r.checked_at as Date).toISOString(),
    },
  }));
}

export async function recordMetrics(
  pool: pg.Pool,
  input: {
    toolId: string;
    tenantId: string;
    version: string;
    success: boolean;
    cancelled?: boolean;
    latencyMs: number;
  },
): Promise<void> {
  const windowMs = toolEngineConfig.metricsWindowMs;
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const windowEnd = new Date(windowStart.getTime() + windowMs);

  await pool.query(
    `
    INSERT INTO tool_metrics (
      tool_id, tenant_id, version, window_start, window_end,
      executions_total, executions_success, executions_failed, executions_cancelled,
      latency_sum_ms, latency_count, last_executed_at
    ) VALUES (
      $1,$2,$3,$4,$5,
      1,
      CASE WHEN $6 THEN 1 ELSE 0 END,
      CASE WHEN $6 OR $7 THEN 0 ELSE 1 END,
      CASE WHEN $7 THEN 1 ELSE 0 END,
      $8, 1, NOW()
    )
    ON CONFLICT (tool_id, tenant_id, version, window_start) DO UPDATE SET
      executions_total = tool_metrics.executions_total + 1,
      executions_success = tool_metrics.executions_success + CASE WHEN $6 THEN 1 ELSE 0 END,
      executions_failed = tool_metrics.executions_failed + CASE WHEN $6 OR $7 THEN 0 ELSE 1 END,
      executions_cancelled = tool_metrics.executions_cancelled + CASE WHEN $7 THEN 1 ELSE 0 END,
      latency_sum_ms = tool_metrics.latency_sum_ms + $8,
      latency_count = tool_metrics.latency_count + 1,
      last_executed_at = NOW()
    `,
    [
      input.toolId,
      input.tenantId,
      input.version,
      windowStart.toISOString(),
      windowEnd.toISOString(),
      input.success,
      input.cancelled ?? false,
      input.latencyMs,
    ],
  );
}

export async function listMetrics(
  pool: pg.Pool,
  tenantId: string,
): Promise<Array<{ toolId: string; name: string; version: string; metrics: ToolMetricsSnapshot }>> {
  const result = await pool.query(
    `
    SELECT DISTINCT ON (m.tool_id)
      m.tool_id, r.name, m.version,
      m.executions_total, m.executions_success, m.executions_failed, m.executions_cancelled,
      m.latency_sum_ms, m.latency_count, m.latency_p95_ms, m.latency_p99_ms,
      m.last_executed_at, m.window_start, m.window_end
    FROM tool_metrics m
    JOIN tool_registry r ON r.id = m.tool_id
    WHERE m.tenant_id = $1
    ORDER BY m.tool_id, m.window_start DESC
    `,
    [tenantId],
  );

  return result.rows.map((r) => {
    const total = Number(r.executions_total);
    const success = Number(r.executions_success);
    const failed = Number(r.executions_failed);
    const cancelled = Number(r.executions_cancelled);
    const latencyCount = Number(r.latency_count);
    const latencySum = Number(r.latency_sum_ms);
    return {
      toolId: r.tool_id as string,
      name: r.name as string,
      version: r.version as string,
      metrics: {
        executionsTotal: total,
        executionsSuccess: success,
        executionsFailed: failed,
        executionsCancelled: cancelled,
        avgLatencyMs: latencyCount > 0 ? latencySum / latencyCount : undefined,
        p95LatencyMs: (r.latency_p95_ms as number | null) ?? undefined,
        p99LatencyMs: (r.latency_p99_ms as number | null) ?? undefined,
        errorRate: total > 0 ? failed / total : undefined,
        lastExecutedAt: r.last_executed_at
          ? (r.last_executed_at as Date).toISOString()
          : undefined,
        windowStart: (r.window_start as Date).toISOString(),
        windowEnd: (r.window_end as Date).toISOString(),
      },
    };
  });
}
