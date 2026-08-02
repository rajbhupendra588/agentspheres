import type pg from "pg";
import { DEFAULT_TENANT_ID } from "@agentsphere/contracts";
import { createLogger } from "@agentsphere/common";
import type { Tool } from "@agentsphere/tool-sdk";
import { BUILTIN_TOOLS } from "./builtins/index.js";
import { upsertFromSdkTool, writeAudit } from "./db/index.js";
import { publishToolRegistered } from "./events.js";

const log = createLogger("tool-engine");

/** Tenants already ensured in-process (avoids re-upsert storms on every list). */
const ensuredTenants = new Set<string>();

async function listActiveTenantIds(pool: pg.Pool): Promise<string[]> {
  try {
    const result = await pool.query<{ tenant_id: string }>(
      `
      SELECT tenant_id FROM tenants
      WHERE status = 'active'
      ORDER BY tenant_id
      `,
    );
    const ids = result.rows.map((r) => r.tenant_id);
    if (!ids.includes(DEFAULT_TENANT_ID)) ids.unshift(DEFAULT_TENANT_ID);
    return ids;
  } catch (err) {
    log.warn("could not list tenants for builtin seed; falling back to default", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [DEFAULT_TENANT_ID];
  }
}

async function seedTenantBuiltins(
  pool: pg.Pool,
  tenantId: string,
  tools: Tool[] = BUILTIN_TOOLS,
): Promise<number> {
  let registered = 0;
  for (const builtin of tools) {
    const result = await upsertFromSdkTool(pool, tenantId, builtin);
    if (result.status === "REGISTERED") {
      registered += 1;
      await publishToolRegistered(result.card, tenantId);
      await writeAudit(pool, {
        tenantId,
        toolId: result.card.id,
        toolName: result.card.name,
        action: "REGISTER",
        actor: "system",
        result: "SUCCESS",
        details: { builtin: true, status: result.status },
      });
    }
  }
  ensuredTenants.add(tenantId);
  return registered;
}

/** Seed platform builtins into every active tenant (startup). */
export async function seedBuiltinsForAllTenants(pool: pg.Pool): Promise<void> {
  const tenants = await listActiveTenantIds(pool);
  for (const tenantId of tenants) {
    const registered = await seedTenantBuiltins(pool, tenantId);
    log.info("builtins seeded for tenant", {
      tenantId,
      builtins: BUILTIN_TOOLS.length,
      newlyRegistered: registered,
    });
  }
}

/**
 * Ensure the caller's tenant has platform builtins.
 * Idempotent — safe on every list/discover for new tenants created after boot.
 */
export async function ensureBuiltinsForTenant(
  pool: pg.Pool,
  tenantId: string,
): Promise<void> {
  if (ensuredTenants.has(tenantId)) return;

  const existing = await pool.query<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM tool_registry
    WHERE tenant_id = $1 AND builtin = TRUE AND lifecycle = 'ACTIVE'
    `,
    [tenantId],
  );
  const count = Number(existing.rows[0]?.count ?? 0);
  if (count >= BUILTIN_TOOLS.length) {
    ensuredTenants.add(tenantId);
    return;
  }

  const registered = await seedTenantBuiltins(pool, tenantId);
  log.info("lazy-seeded builtins for tenant", {
    tenantId,
    previously: count,
    newlyRegistered: registered,
    builtins: BUILTIN_TOOLS.length,
  });
}

export async function listSeededTenantIds(pool: pg.Pool): Promise<string[]> {
  const result = await pool.query<{ tenant_id: string }>(
    `
    SELECT DISTINCT tenant_id FROM tool_registry
    WHERE builtin = TRUE AND lifecycle = 'ACTIVE'
    ORDER BY tenant_id
    `,
  );
  return result.rows.map((r) => r.tenant_id);
}
