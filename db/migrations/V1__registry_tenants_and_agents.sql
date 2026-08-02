-- AgentSphere registry control-plane schema (idempotent for brownfield volumes)

CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, subject)
);

-- Brownfield: columns may predate multi-tenancy
ALTER TABLE agent_instances ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE agent_instances ADD COLUMN IF NOT EXISTS project_id TEXT;
UPDATE agent_instances SET tenant_id = 'default' WHERE tenant_id IS NULL;
ALTER TABLE agent_instances ALTER COLUMN tenant_id SET DEFAULT 'default';
ALTER TABLE agent_instances ALTER COLUMN tenant_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agent_caps ON agent_instances USING GIN (capabilities);
CREATE INDEX IF NOT EXISTS idx_agent_tenant ON agent_instances (tenant_id);
CREATE INDEX IF NOT EXISTS idx_agent_tenant_project ON agent_instances (tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_subject ON tenant_members (subject);

INSERT INTO tenants (tenant_id, display_name, status)
VALUES ('default', 'Default', 'active')
ON CONFLICT (tenant_id) DO NOTHING;
