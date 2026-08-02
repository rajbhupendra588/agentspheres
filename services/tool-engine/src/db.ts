import type pg from "pg";
import type { ToolDefinition, ToolStatus } from "@agentsphere/contracts";
import { createLogger, runMigrations } from "@agentsphere/common";

const log = createLogger("tool-engine");

export interface ToolRow {
  tenant_id: string;
  name: string;
  version: string;
  description: string | null;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown> | null;
  tags: string[];
  status: ToolStatus;
  builtin: boolean;
  definition: ToolDefinition;
  row_version: string;
  created_at: Date;
  updated_at: Date;
  inserted?: boolean;
}

export async function initToolSchema(pool: pg.Pool): Promise<void> {
  const result = await runMigrations({
    pool,
    logger: log,
    installedBy: "tool-engine",
  });
  log.info("database migrations ready", {
    directory: result.directory,
    applied: result.applied,
    skipped: result.skipped.length,
  });
}

export function rowToDefinition(row: ToolRow): ToolDefinition {
  return {
    name: row.name,
    version: row.version,
    description: row.description ?? undefined,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema ?? undefined,
    tags: row.tags ?? [],
    tenantId: row.tenant_id,
    status: row.status,
    builtin: row.builtin,
  };
}

export async function upsertTool(
  pool: pg.Pool,
  input: {
    tenantId: string;
    definition: ToolDefinition;
    builtin?: boolean;
    status?: ToolStatus;
  },
): Promise<{ definition: ToolDefinition; status: "REGISTERED" | "UPDATED"; rowVersion: number }> {
  const version = input.definition.version ?? "1.0.0";
  const status = input.status ?? input.definition.status ?? "ACTIVE";
  const tags = input.definition.tags ?? [];
  const persisted: ToolDefinition = {
    ...input.definition,
    version,
    tenantId: input.tenantId,
    status,
    builtin: input.builtin ?? false,
    tags,
  };

  const result = await pool.query<ToolRow & { inserted: boolean }>(
    `
    INSERT INTO tools (
      tenant_id, name, version, description, input_schema, output_schema,
      tags, status, builtin, definition, row_version, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5::jsonb, $6::jsonb,
      $7, $8, $9, $10::jsonb, 1, NOW()
    )
    ON CONFLICT (tenant_id, name, version) DO UPDATE SET
      description = EXCLUDED.description,
      input_schema = EXCLUDED.input_schema,
      output_schema = EXCLUDED.output_schema,
      tags = EXCLUDED.tags,
      status = EXCLUDED.status,
      builtin = EXCLUDED.builtin,
      definition = EXCLUDED.definition,
      row_version = tools.row_version + 1,
      updated_at = NOW()
    RETURNING *, (xmax = 0) AS inserted
    `,
    [
      input.tenantId,
      persisted.name,
      version,
      persisted.description ?? null,
      JSON.stringify(persisted.inputSchema),
      persisted.outputSchema ? JSON.stringify(persisted.outputSchema) : null,
      tags,
      status,
      input.builtin ?? false,
      JSON.stringify(persisted),
    ],
  );

  const row = result.rows[0]!;
  return {
    definition: rowToDefinition(row),
    status: row.inserted ? "REGISTERED" : "UPDATED",
    rowVersion: Number(row.row_version),
  };
}

export async function listTools(
  pool: pg.Pool,
  tenantId: string,
  opts?: { includeDeprecated?: boolean },
): Promise<ToolDefinition[]> {
  const result = await pool.query<ToolRow>(
    `
    SELECT *
    FROM tools
    WHERE tenant_id = $1
      AND ($2::boolean OR status = 'ACTIVE')
    ORDER BY name ASC, version ASC
    `,
    [tenantId, opts?.includeDeprecated ?? false],
  );
  return result.rows.map(rowToDefinition);
}

export async function getTool(
  pool: pg.Pool,
  tenantId: string,
  name: string,
  version?: string,
): Promise<ToolRow | undefined> {
  if (version) {
    const result = await pool.query<ToolRow>(
      `
      SELECT * FROM tools
      WHERE tenant_id = $1 AND name = $2 AND version = $3 AND status = 'ACTIVE'
      `,
      [tenantId, name, version],
    );
    return result.rows[0];
  }

  const result = await pool.query<ToolRow>(
    `
    SELECT * FROM tools
    WHERE tenant_id = $1 AND name = $2 AND status = 'ACTIVE'
    ORDER BY updated_at DESC
    LIMIT 1
    `,
    [tenantId, name],
  );
  return result.rows[0];
}

export async function deprecateTool(
  pool: pg.Pool,
  tenantId: string,
  name: string,
  version: string,
): Promise<boolean> {
  const result = await pool.query(
    `
    UPDATE tools
    SET status = 'DEPRECATED', row_version = row_version + 1, updated_at = NOW()
    WHERE tenant_id = $1 AND name = $2 AND version = $3 AND status = 'ACTIVE'
    `,
    [tenantId, name, version],
  );
  return (result.rowCount ?? 0) > 0;
}
