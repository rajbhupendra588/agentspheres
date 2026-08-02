-- Durable memory tier (Postgres)

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

ALTER TABLE memory_records ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE memory_records ADD COLUMN IF NOT EXISTS project_id TEXT;

ALTER TABLE memory_records DROP CONSTRAINT IF EXISTS memory_records_scope_key_session_id_agent_name_workspace_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS memory_records_tenant_scope_key_idx
  ON memory_records (
    tenant_id,
    scope,
    key,
    (COALESCE(session_id, '')),
    (COALESCE(agent_name, '')),
    (COALESCE(workspace_id, ''))
  );

CREATE INDEX IF NOT EXISTS idx_memory_tenant ON memory_records (tenant_id);
CREATE INDEX IF NOT EXISTS idx_memory_tenant_project ON memory_records (tenant_id, project_id);
