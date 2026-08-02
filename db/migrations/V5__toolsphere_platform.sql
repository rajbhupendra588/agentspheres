-- ToolSphere normalized platform schema
-- Evolves V4 `tools` into a full registry with versions, capabilities,
-- configuration, permissions, metrics, health, audit, and dependencies.

CREATE TABLE IF NOT EXISTS tool_registry (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'system',
  category TEXT NOT NULL DEFAULT 'CUSTOM',
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE',
  builtin BOOLEAN NOT NULL DEFAULT FALSE,
  latest_version TEXT NOT NULL DEFAULT '1.0.0',
  documentation TEXT,
  endpoint TEXT,
  authentication JSONB NOT NULL DEFAULT '{"schemes":["NONE"],"required":false}'::jsonb,
  rate_limits JSONB,
  cost JSONB,
  regions TEXT[] NOT NULL DEFAULT '{}',
  supported_protocols TEXT[] NOT NULL DEFAULT '{INTERNAL}',
  supported_tenants TEXT[] NOT NULL DEFAULT '{}',
  permissions TEXT[] NOT NULL DEFAULT '{}',
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB,
  configuration_schema JSONB,
  card JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_tool_registry_tenant_lifecycle
  ON tool_registry (tenant_id, lifecycle);
CREATE INDEX IF NOT EXISTS idx_tool_registry_tenant_category
  ON tool_registry (tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_tool_registry_tenant_owner
  ON tool_registry (tenant_id, owner);
CREATE INDEX IF NOT EXISTS idx_tool_registry_regions
  ON tool_registry USING GIN (regions);

CREATE TABLE IF NOT EXISTS tool_versions (
  id TEXT PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  changelog TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'ACTIVE',
  is_latest BOOLEAN NOT NULL DEFAULT FALSE,
  card JSONB NOT NULL DEFAULT '{}'::jsonb,
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deprecated_at TIMESTAMPTZ,
  removed_at TIMESTAMPTZ,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tool_id, version)
);

CREATE INDEX IF NOT EXISTS idx_tool_versions_tenant_tool
  ON tool_versions (tenant_id, tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_versions_latest
  ON tool_versions (tenant_id, tool_id) WHERE is_latest = TRUE;

CREATE TABLE IF NOT EXISTS tool_capabilities (
  id BIGSERIAL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  input_schema JSONB,
  output_schema JSONB,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  execution_modes TEXT[] NOT NULL DEFAULT '{SYNC}',
  UNIQUE (tool_id, version, name)
);

CREATE INDEX IF NOT EXISTS idx_tool_capabilities_name
  ON tool_capabilities (tenant_id, name);

CREATE TABLE IF NOT EXISTS tool_tags (
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (tool_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_tool_tags_tenant_tag
  ON tool_tags (tenant_id, tag);

CREATE TABLE IF NOT EXISTS tool_configuration (
  id BIGSERIAL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '*',
  values JSONB NOT NULL DEFAULT '{}'::jsonb,
  secrets_ref JSONB NOT NULL DEFAULT '{}'::jsonb,
  row_version BIGINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tool_id, tenant_id, version)
);

CREATE TABLE IF NOT EXISTS tool_permissions (
  id BIGSERIAL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  principal TEXT NOT NULL,
  principal_type TEXT NOT NULL DEFAULT 'ROLE',
  permission TEXT NOT NULL,
  effect TEXT NOT NULL DEFAULT 'ALLOW',
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tool_id, tenant_id, principal, permission, effect)
);

CREATE INDEX IF NOT EXISTS idx_tool_permissions_principal
  ON tool_permissions (tenant_id, principal);

CREATE TABLE IF NOT EXISTS tool_metrics (
  id BIGSERIAL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  executions_total BIGINT NOT NULL DEFAULT 0,
  executions_success BIGINT NOT NULL DEFAULT 0,
  executions_failed BIGINT NOT NULL DEFAULT 0,
  executions_cancelled BIGINT NOT NULL DEFAULT 0,
  latency_sum_ms DOUBLE PRECISION NOT NULL DEFAULT 0,
  latency_count BIGINT NOT NULL DEFAULT 0,
  latency_p95_ms DOUBLE PRECISION,
  latency_p99_ms DOUBLE PRECISION,
  last_executed_at TIMESTAMPTZ,
  UNIQUE (tool_id, tenant_id, version, window_start)
);

CREATE INDEX IF NOT EXISTS idx_tool_metrics_tenant_tool
  ON tool_metrics (tenant_id, tool_id, window_start DESC);

CREATE TABLE IF NOT EXISTS tool_health (
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'UNKNOWN',
  latency_ms DOUBLE PRECISION,
  message TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tool_id, tenant_id, version)
);

CREATE INDEX IF NOT EXISTS idx_tool_health_status
  ON tool_health (tenant_id, status);

CREATE TABLE IF NOT EXISTS tool_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tool_id TEXT,
  tool_name TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT,
  correlation_id TEXT,
  execution_id TEXT,
  result TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_audit_tenant_created
  ON tool_audit (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_audit_tool
  ON tool_audit (tenant_id, tool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_audit_correlation
  ON tool_audit (correlation_id) WHERE correlation_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS tool_dependencies (
  id BIGSERIAL PRIMARY KEY,
  tool_id TEXT NOT NULL REFERENCES tool_registry(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  depends_on_tool_id TEXT,
  depends_on_name TEXT NOT NULL,
  version_range TEXT,
  optional BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (tool_id, depends_on_name)
);

CREATE TABLE IF NOT EXISTS tool_executions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  tool_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  version TEXT NOT NULL,
  capability TEXT,
  mode TEXT NOT NULL DEFAULT 'SYNC',
  status TEXT NOT NULL DEFAULT 'RUNNING',
  agent_name TEXT,
  correlation_id TEXT,
  idempotency_key TEXT,
  input JSONB,
  output JSONB,
  error_code TEXT,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 1,
  timeout_ms INT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  latency_ms DOUBLE PRECISION,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  row_version BIGINT NOT NULL DEFAULT 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tool_executions_idempotency
  ON tool_executions (tenant_id, tool_name, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tool_executions_tenant_started
  ON tool_executions (tenant_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status
  ON tool_executions (tenant_id, status)
  WHERE status IN ('RUNNING', 'ACCEPTED');

-- Migrate legacy V4 tools rows into ToolSphere tables
INSERT INTO tool_registry (
  id, tenant_id, name, description, owner, category, lifecycle, builtin,
  latest_version, authentication, input_schema, output_schema, card,
  row_version, created_at, updated_at, permissions, regions, supported_protocols
)
SELECT
  'tool_' || md5(t.tenant_id || ':' || t.name),
  t.tenant_id,
  t.name,
  COALESCE(t.description, ''),
  'system',
  CASE
    WHEN t.name LIKE 'postgres%' OR t.name LIKE 'redis%' OR t.name LIKE 'mongo%' THEN 'DATABASE'
    WHEN t.name LIKE 'git.%' THEN 'GIT'
    WHEN t.name LIKE 'github.%' THEN 'GITHUB'
    WHEN t.name LIKE 'docker%' THEN 'DOCKER'
    WHEN t.name LIKE 'k8s%' OR t.name LIKE 'kubernetes%' THEN 'KUBERNETES'
    WHEN t.name LIKE 'openai%' OR t.name LIKE 'anthropic%' OR t.name LIKE 'gemini%'
      OR t.name LIKE 'ollama%' OR t.name LIKE 'openrouter%' THEN 'AI_MODELS'
    WHEN t.name LIKE 'vault%' OR t.name LIKE 'policy%' OR t.name LIKE 'audit%' THEN 'SECURITY'
    WHEN t.name LIKE 'prometheus%' OR t.name LIKE 'grafana%' OR t.name LIKE 'loki%'
      OR t.name LIKE 'tempo%' OR t.name LIKE 'metrics%' OR t.name LIKE 'tracing%' THEN 'OBSERVABILITY'
    WHEN t.name LIKE 'keycloak%' THEN 'IDENTITY'
    WHEN t.name LIKE 'slack%' OR t.name LIKE 'teams%' OR t.name LIKE 'email%' THEN 'PRODUCTIVITY'
    WHEN t.name LIKE 'kafka%' OR t.name LIKE 'rabbitmq%' THEN 'MESSAGING'
    WHEN t.name LIKE 'fs.%' OR t.name LIKE 'filesystem%' THEN 'FILESYSTEM'
    WHEN t.name LIKE 'browser%' THEN 'BROWSER'
    WHEN t.tags @> ARRAY['builtin']::text[] THEN 'CORE_MESH'
    ELSE 'CUSTOM'
  END,
  CASE WHEN t.status = 'DEPRECATED' THEN 'DEPRECATED' ELSE 'ACTIVE' END,
  t.builtin,
  t.version,
  '{"schemes":["NONE"],"required":false}'::jsonb,
  t.input_schema,
  t.output_schema,
  jsonb_build_object(
    'id', 'tool_' || md5(t.tenant_id || ':' || t.name),
    'name', t.name,
    'description', COALESCE(t.description, ''),
    'version', t.version,
    'owner', 'system',
    'category', 'CUSTOM',
    'capabilities', jsonb_build_array(
      jsonb_build_object(
        'name', t.name,
        'inputSchema', t.input_schema,
        'outputSchema', t.output_schema
      )
    ),
    'authentication', jsonb_build_object('schemes', jsonb_build_array('NONE'), 'required', false),
    'permissions', '[]'::jsonb,
    'tags', to_jsonb(t.tags),
    'lifecycle', CASE WHEN t.status = 'DEPRECATED' THEN 'DEPRECATED' ELSE 'ACTIVE' END,
    'builtin', t.builtin,
    'tenantId', t.tenant_id
  ),
  t.row_version,
  t.created_at,
  t.updated_at,
  '{}',
  '{}',
  '{INTERNAL}'
FROM tools t
ON CONFLICT (tenant_id, name) DO NOTHING;

INSERT INTO tool_versions (
  id, tool_id, tenant_id, version, lifecycle, is_latest, card, released_at, created_at, updated_at, row_version
)
SELECT
  'tv_' || md5(t.tenant_id || ':' || t.name || ':' || t.version),
  r.id,
  t.tenant_id,
  t.version,
  CASE WHEN t.status = 'DEPRECATED' THEN 'DEPRECATED' ELSE 'ACTIVE' END,
  TRUE,
  r.card,
  t.created_at,
  t.created_at,
  t.updated_at,
  t.row_version
FROM tools t
JOIN tool_registry r ON r.tenant_id = t.tenant_id AND r.name = t.name
ON CONFLICT (tool_id, version) DO NOTHING;

INSERT INTO tool_capabilities (tool_id, tenant_id, version, name, description, input_schema, output_schema)
SELECT
  r.id,
  t.tenant_id,
  t.version,
  t.name,
  t.description,
  t.input_schema,
  t.output_schema
FROM tools t
JOIN tool_registry r ON r.tenant_id = t.tenant_id AND r.name = t.name
ON CONFLICT (tool_id, version, name) DO NOTHING;

INSERT INTO tool_tags (tool_id, tenant_id, tag)
SELECT r.id, t.tenant_id, unnest(t.tags)
FROM tools t
JOIN tool_registry r ON r.tenant_id = t.tenant_id AND r.name = t.name
ON CONFLICT DO NOTHING;

INSERT INTO tool_health (tool_id, tenant_id, version, status, message, checked_at)
SELECT r.id, r.tenant_id, r.latest_version, 'UNKNOWN', 'Awaiting first health probe', NOW()
FROM tool_registry r
ON CONFLICT DO NOTHING;
