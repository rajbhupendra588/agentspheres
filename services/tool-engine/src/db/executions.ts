import type pg from "pg";
import type { ToolExecutionMode } from "@agentsphere/contracts";

export interface ExecutionRow {
  id: string;
  tenant_id: string;
  tool_id: string;
  tool_name: string;
  version: string;
  capability: string | null;
  mode: string;
  status: string;
  agent_name: string | null;
  correlation_id: string | null;
  idempotency_key: string | null;
  input: unknown;
  output: unknown;
  error_code: string | null;
  error_message: string | null;
  attempts: number;
  timeout_ms: number | null;
  started_at: Date;
  finished_at: Date | null;
  latency_ms: number | null;
  cancelled_at: Date | null;
  cancel_reason: string | null;
  row_version: string;
}

export async function findIdempotentExecution(
  pool: pg.Pool,
  tenantId: string,
  toolName: string,
  idempotencyKey: string,
): Promise<ExecutionRow | undefined> {
  const result = await pool.query<ExecutionRow>(
    `
    SELECT * FROM tool_executions
    WHERE tenant_id = $1 AND tool_name = $2 AND idempotency_key = $3
    `,
    [tenantId, toolName, idempotencyKey],
  );
  return result.rows[0];
}

export async function createExecution(
  pool: pg.Pool,
  input: {
    id: string;
    tenantId: string;
    toolId: string;
    toolName: string;
    version: string;
    capability?: string;
    mode: ToolExecutionMode;
    agentName?: string;
    correlationId?: string;
    idempotencyKey?: string;
    payload: unknown;
    timeoutMs?: number;
  },
): Promise<ExecutionRow> {
  const result = await pool.query<ExecutionRow>(
    `
    INSERT INTO tool_executions (
      id, tenant_id, tool_id, tool_name, version, capability, mode, status,
      agent_name, correlation_id, idempotency_key, input, timeout_ms
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,'RUNNING',$8,$9,$10,$11::jsonb,$12
    )
    RETURNING *
    `,
    [
      input.id,
      input.tenantId,
      input.toolId,
      input.toolName,
      input.version,
      input.capability ?? null,
      input.mode,
      input.agentName ?? null,
      input.correlationId ?? null,
      input.idempotencyKey ?? null,
      JSON.stringify(input.payload ?? null),
      input.timeoutMs ?? null,
    ],
  );
  return result.rows[0]!;
}

export async function completeExecution(
  pool: pg.Pool,
  input: {
    id: string;
    tenantId: string;
    status: "SUCCEEDED" | "FAILED" | "CANCELLED";
    output?: unknown;
    errorCode?: string;
    errorMessage?: string;
    attempts: number;
    latencyMs: number;
    expectedRowVersion?: number;
  },
): Promise<void> {
  const result = await pool.query(
    `
    UPDATE tool_executions SET
      status = $3,
      output = $4::jsonb,
      error_code = $5,
      error_message = $6,
      attempts = $7,
      latency_ms = $8,
      finished_at = NOW(),
      cancelled_at = CASE WHEN $3 = 'CANCELLED' THEN NOW() ELSE cancelled_at END,
      row_version = row_version + 1
    WHERE id = $1 AND tenant_id = $2
      AND ($9::bigint IS NULL OR row_version = $9)
      AND status IN ('RUNNING', 'ACCEPTED')
    `,
    [
      input.id,
      input.tenantId,
      input.status,
      JSON.stringify(input.output ?? null),
      input.errorCode ?? null,
      input.errorMessage ?? null,
      input.attempts,
      input.latencyMs,
      input.expectedRowVersion ?? null,
    ],
  );
  if ((result.rowCount ?? 0) === 0) {
    const err = new Error("Execution update lost (concurrent completion or stale row_version)");
    (err as Error & { code: string; statusCode: number }).code = "LOST_UPDATE";
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }
}

export async function cancelExecution(
  pool: pg.Pool,
  tenantId: string,
  executionId: string,
  reason?: string,
): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE tool_executions SET
      status = 'CANCELLED',
      cancel_reason = $3,
      cancelled_at = NOW(),
      finished_at = NOW(),
      row_version = row_version + 1
    WHERE id = $1 AND tenant_id = $2 AND status IN ('RUNNING', 'ACCEPTED')
    `,
    [executionId, tenantId, reason ?? null],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listExecutions(
  pool: pg.Pool,
  tenantId: string,
  opts?: { toolName?: string; limit?: number },
): Promise<ExecutionRow[]> {
  const result = await pool.query<ExecutionRow>(
    `
    SELECT * FROM tool_executions
    WHERE tenant_id = $1
      AND ($2::text IS NULL OR tool_name = $2)
    ORDER BY started_at DESC
    LIMIT $3
    `,
    [tenantId, opts?.toolName ?? null, opts?.limit ?? 100],
  );
  return result.rows;
}
