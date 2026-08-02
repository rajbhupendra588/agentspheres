-- Transactional outbox for mesh CloudEvents → JetStream relay

CREATE TABLE IF NOT EXISTS event_outbox (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  project_id TEXT,
  subject TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS idx_event_outbox_unpublished
  ON event_outbox (created_at ASC)
  WHERE published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_outbox_tenant
  ON event_outbox (tenant_id, created_at DESC);
