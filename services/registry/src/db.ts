import type pg from "pg";
import { createLogger, runMigrations } from "@agentsphere/common";

const log = createLogger("registry");

export async function initSchema(pool: pg.Pool): Promise<void> {
  const result = await runMigrations({
    pool,
    logger: log,
    installedBy: "registry",
  });
  log.info("database migrations ready", {
    directory: result.directory,
    applied: result.applied,
    skipped: result.skipped.length,
  });
}

export async function markStaleUnhealthy(pool: pg.Pool): Promise<number> {
  const result = await pool.query(`
    UPDATE agent_instances
    SET status = 'UNHEALTHY', updated_at = NOW()
    WHERE status = 'HEALTHY'
      AND last_heartbeat < NOW() - INTERVAL '15 seconds'
  `);
  return result.rowCount ?? 0;
}

export interface ExpiredAgentRow {
  instance_id: string;
  agent_name: string;
  version: string;
  tenant_id: string;
  project_id: string | null;
  last_heartbeat: Date;
}

export async function deleteExpired(
  client: pg.Pool | pg.PoolClient,
): Promise<ExpiredAgentRow[]> {
  const result = await client.query<ExpiredAgentRow>(`
    DELETE FROM agent_instances
    WHERE last_heartbeat < NOW() - INTERVAL '45 seconds'
    RETURNING instance_id, agent_name, version, tenant_id, project_id, last_heartbeat
  `);
  return result.rows;
}
