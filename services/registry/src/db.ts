import type pg from "pg";

const INIT_SQL = `
CREATE TABLE IF NOT EXISTS agent_instances (
  instance_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  version TEXT NOT NULL,
  owner TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  project_id TEXT,
  base_url TEXT NOT NULL,
  capabilities TEXT[] NOT NULL,
  labels JSONB NOT NULL DEFAULT '{}',
  weight INT NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'HEALTHY',
  card JSONB NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_caps ON agent_instances USING GIN (capabilities);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_subject ON tenant_members (subject);
`;

const MIGRATE_SQL = `
ALTER TABLE agent_instances ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE agent_instances ADD COLUMN IF NOT EXISTS project_id TEXT;
UPDATE agent_instances SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE agent_instances ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE agent_instances ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_tenant ON agent_instances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_tenant_project ON agent_instances (tenant_id, project_id);

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, subject)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_subject ON tenant_members (subject);

INSERT INTO tenants (tenant_id, display_name, status)
VALUES ('default', 'Default', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
`;

export async function initSchema(pool: pg.Pool): Promise<void> {
  await pool.query(INIT_SQL);
  await pool.query(MIGRATE_SQL);
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

export async function deleteExpired(pool: pg.Pool): Promise<number> {
  const result = await pool.query(`
    DELETE FROM agent_instances
    WHERE last_heartbeat < NOW() - INTERVAL '45 seconds'
  `);
  return result.rowCount ?? 0;
}
