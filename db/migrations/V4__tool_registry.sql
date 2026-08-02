-- Independent tool registry (not embedded in agents)

CREATE TABLE IF NOT EXISTS tools (
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  description TEXT,
  input_schema JSONB NOT NULL,
  output_schema JSONB,
  tags TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  definition JSONB NOT NULL,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, name, version)
);

CREATE INDEX IF NOT EXISTS idx_tools_tenant_status
  ON tools (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tools_tenant_name
  ON tools (tenant_id, name);

CREATE INDEX IF NOT EXISTS idx_tools_tags
  ON tools USING GIN (tags);
