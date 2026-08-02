import type pg from "pg";
import type {
  ToolCard,
  ToolDefinition,
  ToolDiscoverQuery,
  ToolLifecycleState,
} from "@agentsphere/contracts";
import { ulid } from "@agentsphere/common";
import { toToolCard, toolIdFor, type Tool } from "@agentsphere/tool-sdk";
import { ToolLifecycleController } from "@agentsphere/tool-sdk";

export interface RegistryUpsertResult {
  card: ToolCard;
  status: "REGISTERED" | "UPDATED";
  rowVersion: number;
}

function definitionToCard(tenantId: string, definition: ToolDefinition, id?: string): ToolCard {
  const version = definition.version ?? "1.0.0";
  const name = definition.name;
  const toolId = id ?? definition.id ?? toolIdFor(tenantId, name);
  const lifecycle: ToolLifecycleState =
    definition.lifecycle ??
    (definition.status === "DEPRECATED" ? "DEPRECATED" : "ACTIVE");
  const capabilities =
    definition.capabilities ??
    [
      {
        name,
        description: definition.description,
        inputSchema: definition.inputSchema,
        outputSchema: definition.outputSchema,
        permissions: definition.permissions,
        executionModes: ["SYNC" as const],
      },
    ];

  return {
    id: toolId,
    name,
    description: definition.description ?? name,
    version,
    owner: definition.owner ?? "unknown",
    category: definition.category ?? "CUSTOM",
    capabilities,
    authentication: definition.authentication ?? { schemes: ["NONE"], required: false },
    permissions: definition.permissions ?? [],
    configuration: definition.configuration,
    supportedProtocols: definition.supportedProtocols ?? ["INTERNAL"],
    supportedTenants: definition.supportedTenants,
    dependencies: definition.dependencies ?? [],
    rateLimits: definition.rateLimits,
    cost: definition.cost,
    documentation: definition.documentation,
    tags: definition.tags ?? [],
    regions: definition.regions ?? [],
    lifecycle,
    builtin: definition.builtin ?? false,
    endpoint: definition.endpoint,
    inputSchema: definition.inputSchema,
    outputSchema: definition.outputSchema,
    tenantId,
  };
}

function rowToCard(row: {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  owner: string;
  category: string;
  lifecycle: string;
  builtin: boolean;
  latest_version: string;
  documentation: string | null;
  endpoint: string | null;
  authentication: ToolCard["authentication"];
  rate_limits: ToolCard["rateLimits"] | null;
  cost: ToolCard["cost"] | null;
  regions: string[];
  supported_protocols: ToolCard["supportedProtocols"];
  supported_tenants: string[];
  permissions: string[];
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown> | null;
  configuration_schema: ToolCard["configuration"] | null;
  card: ToolCard;
  row_version: string | number;
  created_at: Date;
  updated_at: Date;
  tags?: string[];
  health_status?: string;
  health_message?: string | null;
  health_latency_ms?: number | null;
  health_checked_at?: Date | null;
}): ToolCard {
  const base = row.card && typeof row.card === "object" ? row.card : ({} as ToolCard);
  return {
    ...base,
    id: row.id,
    name: row.name,
    description: row.description,
    version: row.latest_version,
    owner: row.owner,
    category: row.category as ToolCard["category"],
    authentication: row.authentication ?? base.authentication,
    permissions: row.permissions ?? [],
    configuration: row.configuration_schema ?? base.configuration,
    supportedProtocols: row.supported_protocols ?? ["INTERNAL"],
    supportedTenants: row.supported_tenants?.length ? row.supported_tenants : undefined,
    rateLimits: row.rate_limits ?? undefined,
    cost: row.cost ?? undefined,
    documentation: row.documentation ?? undefined,
    tags: row.tags ?? base.tags ?? [],
    regions: row.regions ?? [],
    lifecycle: row.lifecycle as ToolLifecycleState,
    builtin: row.builtin,
    endpoint: row.endpoint ?? undefined,
    inputSchema: row.input_schema,
    outputSchema: row.output_schema ?? undefined,
    tenantId: row.tenant_id,
    rowVersion: Number(row.row_version),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    health: row.health_status
      ? {
          status: row.health_status as NonNullable<ToolCard["health"]>["status"],
          message: row.health_message ?? undefined,
          latencyMs: row.health_latency_ms ?? undefined,
          checkedAt: (row.health_checked_at ?? new Date()).toISOString(),
        }
      : base.health,
    capabilities: base.capabilities?.length
      ? base.capabilities
      : [
          {
            name: row.name,
            inputSchema: row.input_schema,
            outputSchema: row.output_schema ?? undefined,
          },
        ],
  };
}

async function replaceCapabilities(
  client: pg.PoolClient,
  card: ToolCard,
): Promise<void> {
  await client.query(`DELETE FROM tool_capabilities WHERE tool_id = $1 AND version = $2`, [
    card.id,
    card.version,
  ]);
  for (const cap of card.capabilities) {
    await client.query(
      `
      INSERT INTO tool_capabilities (
        tool_id, tenant_id, version, name, description,
        input_schema, output_schema, permissions, execution_modes
      ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9)
      `,
      [
        card.id,
        card.tenantId,
        card.version,
        cap.name,
        cap.description ?? null,
        JSON.stringify(cap.inputSchema ?? null),
        JSON.stringify(cap.outputSchema ?? null),
        cap.permissions ?? [],
        cap.executionModes ?? ["SYNC"],
      ],
    );
  }
}

async function replaceTags(client: pg.PoolClient, card: ToolCard): Promise<void> {
  await client.query(`DELETE FROM tool_tags WHERE tool_id = $1`, [card.id]);
  for (const tag of card.tags) {
    await client.query(
      `INSERT INTO tool_tags (tool_id, tenant_id, tag) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [card.id, card.tenantId, tag],
    );
  }
}

async function replaceDependencies(client: pg.PoolClient, card: ToolCard): Promise<void> {
  await client.query(`DELETE FROM tool_dependencies WHERE tool_id = $1`, [card.id]);
  for (const dep of card.dependencies) {
    await client.query(
      `
      INSERT INTO tool_dependencies (
        tool_id, tenant_id, depends_on_tool_id, depends_on_name, version_range, optional
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (tool_id, depends_on_name) DO UPDATE SET
        version_range = EXCLUDED.version_range,
        optional = EXCLUDED.optional
      `,
      [
        card.id,
        card.tenantId,
        dep.toolId ?? null,
        dep.name,
        dep.versionRange ?? null,
        dep.optional ?? false,
      ],
    );
  }
}

export async function upsertToolCard(
  pool: pg.Pool,
  input: {
    tenantId: string;
    definition: ToolDefinition;
    builtin?: boolean;
    expectedRowVersion?: number;
  },
): Promise<RegistryUpsertResult> {
  const card = definitionToCard(input.tenantId, {
    ...input.definition,
    builtin: input.builtin ?? input.definition.builtin,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query<{ id: string; row_version: string; lifecycle: string }>(
      `SELECT id, row_version, lifecycle FROM tool_registry WHERE tenant_id = $1 AND name = $2 FOR UPDATE`,
      [input.tenantId, card.name],
    );

    let status: "REGISTERED" | "UPDATED" = "REGISTERED";
    let rowVersion = 1;

    if (existing.rows[0]) {
      const prev = existing.rows[0];
      if (
        input.expectedRowVersion !== undefined &&
        Number(prev.row_version) !== input.expectedRowVersion
      ) {
        const err = new Error(
          `Optimistic lock failure: expected rowVersion ${input.expectedRowVersion}, got ${prev.row_version}`,
        );
        (err as Error & { code: string; statusCode: number }).code = "OPTIMISTIC_LOCK";
        (err as Error & { statusCode: number }).statusCode = 409;
        throw err;
      }
      card.id = prev.id;
      const nextLifecycle: ToolLifecycleState =
        card.lifecycle === "DEPRECATED" ? "DEPRECATED" : (card.lifecycle as ToolLifecycleState);
      if (prev.lifecycle !== nextLifecycle) {
        ToolLifecycleController.assertTransition(
          prev.lifecycle as ToolLifecycleState,
          nextLifecycle,
        );
      }
      card.lifecycle = nextLifecycle;
      const updated = await client.query(
        `
        UPDATE tool_registry SET
          description = $3,
          owner = $4,
          category = $5,
          lifecycle = $6,
          builtin = $7,
          latest_version = $8,
          documentation = $9,
          endpoint = $10,
          authentication = $11::jsonb,
          rate_limits = $12::jsonb,
          cost = $13::jsonb,
          regions = $14,
          supported_protocols = $15,
          supported_tenants = $16,
          permissions = $17,
          input_schema = $18::jsonb,
          output_schema = $19::jsonb,
          configuration_schema = $20::jsonb,
          card = $21::jsonb,
          row_version = row_version + 1,
          updated_at = NOW()
        WHERE id = $1 AND tenant_id = $2
        RETURNING row_version
        `,
        [
          card.id,
          input.tenantId,
          card.description,
          card.owner,
          card.category,
          card.lifecycle,
          card.builtin,
          card.version,
          card.documentation ?? null,
          card.endpoint ?? null,
          JSON.stringify(card.authentication),
          JSON.stringify(card.rateLimits ?? null),
          JSON.stringify(card.cost ?? null),
          card.regions,
          card.supportedProtocols,
          card.supportedTenants ?? [],
          card.permissions,
          JSON.stringify(card.inputSchema ?? {}),
          JSON.stringify(card.outputSchema ?? null),
          JSON.stringify(card.configuration ?? null),
          JSON.stringify(card),
        ],
      );
      rowVersion = Number(updated.rows[0]!.row_version);
      status = "UPDATED";
    } else {
      card.id = card.id || toolIdFor(input.tenantId, card.name);
      await client.query(
        `
        INSERT INTO tool_registry (
          id, tenant_id, name, description, owner, category, lifecycle, builtin,
          latest_version, documentation, endpoint, authentication, rate_limits, cost,
          regions, supported_protocols, supported_tenants, permissions,
          input_schema, output_schema, configuration_schema, card, row_version
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,
          $9,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,
          $15,$16,$17,$18,
          $19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,1
        )
        `,
        [
          card.id,
          input.tenantId,
          card.name,
          card.description,
          card.owner,
          card.category,
          card.lifecycle,
          card.builtin,
          card.version,
          card.documentation ?? null,
          card.endpoint ?? null,
          JSON.stringify(card.authentication),
          JSON.stringify(card.rateLimits ?? null),
          JSON.stringify(card.cost ?? null),
          card.regions,
          card.supportedProtocols,
          card.supportedTenants ?? [],
          card.permissions,
          JSON.stringify(card.inputSchema ?? {}),
          JSON.stringify(card.outputSchema ?? null),
          JSON.stringify(card.configuration ?? null),
          JSON.stringify(card),
        ],
      );
      rowVersion = 1;
    }

    await client.query(
      `
      INSERT INTO tool_versions (
        id, tool_id, tenant_id, version, lifecycle, is_latest, card, row_version
      ) VALUES ($1,$2,$3,$4,$5,TRUE,$6::jsonb,1)
      ON CONFLICT (tool_id, version) DO UPDATE SET
        lifecycle = EXCLUDED.lifecycle,
        is_latest = TRUE,
        card = EXCLUDED.card,
        row_version = tool_versions.row_version + 1,
        updated_at = NOW()
      `,
      [
        `tv_${ulid()}`,
        card.id,
        input.tenantId,
        card.version,
        card.lifecycle,
        JSON.stringify({ ...card, rowVersion }),
      ],
    );

    await client.query(
      `UPDATE tool_versions SET is_latest = FALSE WHERE tool_id = $1 AND version <> $2`,
      [card.id, card.version],
    );

    await replaceCapabilities(client, card);
    await replaceTags(client, card);
    await replaceDependencies(client, card);

    await client.query(
      `
      INSERT INTO tool_health (tool_id, tenant_id, version, status, message, checked_at)
      VALUES ($1,$2,$3,'UNKNOWN','Awaiting probe',NOW())
      ON CONFLICT (tool_id, tenant_id, version) DO NOTHING
      `,
      [card.id, input.tenantId, card.version],
    );

    // Dual-write legacy `tools` table for brownfield readers
    await client.query(
      `
      INSERT INTO tools (
        tenant_id, name, version, description, input_schema, output_schema,
        tags, status, builtin, definition, row_version, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10::jsonb,$11,NOW()
      )
      ON CONFLICT (tenant_id, name, version) DO UPDATE SET
        description = EXCLUDED.description,
        input_schema = EXCLUDED.input_schema,
        output_schema = EXCLUDED.output_schema,
        tags = EXCLUDED.tags,
        status = EXCLUDED.status,
        builtin = EXCLUDED.builtin,
        definition = EXCLUDED.definition,
        row_version = EXCLUDED.row_version,
        updated_at = NOW()
      `,
      [
        input.tenantId,
        card.name,
        card.version,
        card.description,
        JSON.stringify(card.inputSchema ?? {}),
        JSON.stringify(card.outputSchema ?? null),
        card.tags,
        card.lifecycle === "DEPRECATED" ? "DEPRECATED" : "ACTIVE",
        card.builtin,
        JSON.stringify(card),
        rowVersion,
      ],
    );

    await client.query("COMMIT");
    return {
      card: { ...card, rowVersion },
      status,
      rowVersion,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertFromSdkTool(
  pool: pg.Pool,
  tenantId: string,
  tool: Tool,
): Promise<RegistryUpsertResult> {
  const card = toToolCard(tool, tenantId);
  return upsertToolCard(pool, {
    tenantId,
    builtin: true,
    definition: {
      name: card.name,
      description: card.description,
      version: card.version,
      inputSchema: card.inputSchema ?? { type: "object" },
      outputSchema: card.outputSchema,
      tags: card.tags,
      owner: card.owner,
      category: card.category,
      capabilities: card.capabilities,
      authentication: card.authentication,
      permissions: card.permissions,
      configuration: card.configuration,
      supportedProtocols: card.supportedProtocols,
      dependencies: card.dependencies,
      rateLimits: card.rateLimits,
      cost: card.cost,
      documentation: card.documentation,
      regions: card.regions,
      endpoint: card.endpoint,
      builtin: true,
      lifecycle: "ACTIVE",
      status: "ACTIVE",
      id: card.id,
    },
  });
}

export async function getToolCard(
  pool: pg.Pool,
  tenantId: string,
  idOrName: string,
  version?: string,
): Promise<ToolCard | undefined> {
  const result = await pool.query(
    `
    SELECT r.*, COALESCE(array_agg(DISTINCT tg.tag) FILTER (WHERE tg.tag IS NOT NULL), '{}') AS tags,
           h.status AS health_status, h.message AS health_message,
           h.latency_ms AS health_latency_ms, h.checked_at AS health_checked_at
    FROM tool_registry r
    LEFT JOIN tool_tags tg ON tg.tool_id = r.id
    LEFT JOIN tool_health h ON h.tool_id = r.id AND h.tenant_id = r.tenant_id
      AND h.version = COALESCE($3::text, r.latest_version)
    WHERE r.tenant_id = $1
      AND (r.id = $2 OR r.name = $2)
      AND r.lifecycle NOT IN ('REMOVED')
    GROUP BY r.id, h.status, h.message, h.latency_ms, h.checked_at
    LIMIT 1
    `,
    [tenantId, idOrName, version ?? null],
  );
  if (!result.rows[0]) return undefined;
  const card = rowToCard(result.rows[0]);
  if (version) card.version = version;
  return card;
}

export async function listToolCards(
  pool: pg.Pool,
  tenantId: string,
  opts?: { includeDeprecated?: boolean },
): Promise<ToolCard[]> {
  const result = await pool.query(
    `
    SELECT r.*, COALESCE(array_agg(DISTINCT tg.tag) FILTER (WHERE tg.tag IS NOT NULL), '{}') AS tags,
           h.status AS health_status, h.message AS health_message,
           h.latency_ms AS health_latency_ms, h.checked_at AS health_checked_at
    FROM tool_registry r
    LEFT JOIN tool_tags tg ON tg.tool_id = r.id
    LEFT JOIN tool_health h ON h.tool_id = r.id AND h.tenant_id = r.tenant_id AND h.version = r.latest_version
    WHERE r.tenant_id = $1
      AND r.lifecycle <> 'REMOVED'
      AND ($2::boolean OR r.lifecycle = 'ACTIVE')
    GROUP BY r.id, h.status, h.message, h.latency_ms, h.checked_at
    ORDER BY r.name ASC
    `,
    [tenantId, opts?.includeDeprecated ?? false],
  );
  return result.rows.map(rowToCard);
}

export async function discoverTools(
  pool: pg.Pool,
  tenantId: string,
  query: ToolDiscoverQuery,
): Promise<{ tools: ToolCard[]; total: number }> {
  const params: unknown[] = [tenantId];
  const where: string[] = [`r.tenant_id = $1`, `r.lifecycle <> 'REMOVED'`];

  if (!query.includeDeprecated) {
    where.push(`r.lifecycle = 'ACTIVE'`);
  }
  if (query.category) {
    params.push(query.category);
    where.push(`r.category = $${params.length}`);
  }
  if (query.owner) {
    params.push(query.owner);
    where.push(`r.owner = $${params.length}`);
  }
  if (query.region) {
    params.push(query.region);
    where.push(`$${params.length} = ANY(r.regions)`);
  }
  if (query.version) {
    params.push(query.version);
    where.push(`r.latest_version = $${params.length}`);
  }
  if (query.capability) {
    params.push(query.capability);
    where.push(
      `EXISTS (SELECT 1 FROM tool_capabilities c WHERE c.tool_id = r.id AND c.name = $${params.length})`,
    );
  }
  if (query.tags?.length) {
    params.push(query.tags);
    where.push(
      `EXISTS (SELECT 1 FROM tool_tags t WHERE t.tool_id = r.id AND t.tag = ANY($${params.length}::text[]))`,
    );
  }
  if (query.permissions?.length) {
    params.push(query.permissions);
    where.push(`r.permissions && $${params.length}::text[]`);
  }
  if (query.health) {
    params.push(query.health);
    where.push(
      `EXISTS (SELECT 1 FROM tool_health h WHERE h.tool_id = r.id AND h.tenant_id = r.tenant_id AND h.status = $${params.length})`,
    );
  }
  if (query.maxLatencyMs) {
    params.push(query.maxLatencyMs);
    where.push(
      `EXISTS (SELECT 1 FROM tool_health h WHERE h.tool_id = r.id AND h.tenant_id = r.tenant_id AND h.latency_ms IS NOT NULL AND h.latency_ms <= $${params.length})`,
    );
  }

  const countResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM tool_registry r WHERE ${where.join(" AND ")}`,
    params,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  params.push(query.limit, query.offset);
  const result = await pool.query(
    `
    SELECT r.*, COALESCE(array_agg(DISTINCT tg.tag) FILTER (WHERE tg.tag IS NOT NULL), '{}') AS tags,
           h.status AS health_status, h.message AS health_message,
           h.latency_ms AS health_latency_ms, h.checked_at AS health_checked_at
    FROM tool_registry r
    LEFT JOIN tool_tags tg ON tg.tool_id = r.id
    LEFT JOIN tool_health h ON h.tool_id = r.id AND h.tenant_id = r.tenant_id AND h.version = r.latest_version
    WHERE ${where.join(" AND ")}
    GROUP BY r.id, h.status, h.message, h.latency_ms, h.checked_at
    ORDER BY r.name ASC
    LIMIT $${params.length - 1} OFFSET $${params.length}
    `,
    params,
  );

  return { tools: result.rows.map(rowToCard), total };
}

export async function deleteToolCard(
  pool: pg.Pool,
  tenantId: string,
  idOrName: string,
): Promise<ToolCard | undefined> {
  const existing = await getToolCard(pool, tenantId, idOrName);
  if (!existing) return undefined;
  ToolLifecycleController.assertTransition(existing.lifecycle, "REMOVED");
  await pool.query(
    `
    UPDATE tool_registry
    SET lifecycle = 'REMOVED', row_version = row_version + 1, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    `,
    [existing.id, tenantId],
  );
  await pool.query(
    `UPDATE tools SET status = 'DEPRECATED', updated_at = NOW() WHERE tenant_id = $1 AND name = $2`,
    [tenantId, existing.name],
  );
  return { ...existing, lifecycle: "REMOVED" };
}

export async function deprecateToolCard(
  pool: pg.Pool,
  tenantId: string,
  name: string,
  version: string,
): Promise<ToolCard | undefined> {
  const existing = await getToolCard(pool, tenantId, name, version);
  if (!existing || existing.lifecycle !== "ACTIVE") return undefined;
  await pool.query(
    `
    UPDATE tool_registry
    SET lifecycle = 'DEPRECATED', row_version = row_version + 1, updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    `,
    [existing.id, tenantId],
  );
  await pool.query(
    `
    UPDATE tool_versions
    SET lifecycle = 'DEPRECATED', deprecated_at = NOW(), row_version = row_version + 1, updated_at = NOW()
    WHERE tool_id = $1 AND version = $2
    `,
    [existing.id, version],
  );
  await pool.query(
    `UPDATE tools SET status = 'DEPRECATED', updated_at = NOW() WHERE tenant_id = $1 AND name = $2 AND version = $3`,
    [tenantId, name, version],
  );
  return { ...existing, lifecycle: "DEPRECATED" };
}
