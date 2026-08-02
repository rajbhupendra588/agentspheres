# ToolSphere runtime (`tool-engine`)

`tool-engine` is the ToolSphere operator runtime: it maintains the tenant-scoped tool registry, seeds built-ins, validates cards and payloads, executes tools with isolation controls, and publishes lifecycle events.

## Deploy

The service listens on port `8086`. Deploy it behind the Gateway; clients should use `/mesh/tools/v1/...` rather than directly exposing the runtime. The Helm chart is at [`deploy/helm/toolsphere`](../../deploy/helm/toolsphere).

```bash
helm upgrade --install toolsphere deploy/helm/toolsphere \
  --namespace agentsphere --create-namespace \
  --set database.existingSecret=agentsphere-database \
  --set nats.existingSecret=agentsphere-nats
```

The referenced Secrets must provide `AS_DATABASE_URL` and `AS_NATS_URL` keys. `AS_NATS_URL` may be empty for a runtime without event publishing, but production deployments should provide JetStream.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8086` | HTTP listen port |
| `AS_DATABASE_URL` | required | PostgreSQL connection string |
| `AS_NATS_URL` | empty | JetStream connection URL |
| `AS_TOOL_DEFAULT_TIMEOUT_MS` | `30000` | Default execution timeout |
| `AS_TOOL_MAX_CONCURRENT` | `10000` | Global execution bulkhead |
| `AS_TOOL_MAX_CONCURRENT_PER_TOOL` | `500` | Per-tool execution bulkhead |
| `AS_TOOL_MAX_CONCURRENT_PER_TENANT` | `2000` | Per-tenant execution bulkhead |
| `AS_TOOL_CB_FAILURES` | `20` | Circuit-breaker failure threshold |
| `AS_TOOL_CB_RESET_MS` | `30000` | Circuit-breaker reset interval |
| `AS_TOOL_METRICS_WINDOW_MS` | `60000` | Metrics aggregation window |
| `AS_TOOL_HEALTH_INTERVAL_MS` | `30000` | Built-in health probe interval |

## Operations

| Endpoint | Use |
| --- | --- |
| `GET /healthz` | Liveness: process is running |
| `GET /readyz` | Readiness: runtime can serve traffic |
| `GET /v1/tools/health` | Tenant-scoped tool health |
| `GET /v1/tools/metrics` | Tenant-scoped metrics |
| `GET /v1/tools/executions` | Execution history and concurrency snapshot |
| `GET /v1/tools/audit` | Registry and operator audit history |

Use the Gateway's equivalent `/mesh/tools/v1/...` routes for routine operations so authentication, tenant resolution, rate limiting, and correlation headers are applied consistently.

## Runtime behavior

Tool cards and executions are stored in PostgreSQL. Built-in tools are seeded into the `default` tenant on startup. The runtime applies global, tenant, and tool-level concurrency limits; uses circuit breakers for failing tools; persists cancellation and retry state; and emits `agentsphere.tool.*` CloudEvents when JetStream is configured. Graceful shutdown stops health probes, closes JetStream, and drains the database pool.

## Verify

```bash
curl -fsS http://127.0.0.1:8086/healthz
curl -fsS http://127.0.0.1:8086/readyz
```

For a full local stack, run `docker compose up --build` from the repository root.
