# AgentSphere — Enterprise AI Agent Service Mesh

**Comprehensive Design & Implementation Blueprint**  
Version: 2.0  
Author: Bhupendra Singh  
Role: Chief Architect  

---

## 1. Executive Summary

AgentSphere is a production-grade **AI Agent Service Mesh**: a control plane + data plane that lets agents **register, discover, authenticate, invoke, orchestrate, remember, and observe** each other the way a service mesh does for microservices — with agent-native primitives (capabilities, agent cards, tools, memory, workflows).

This repository implements an **end-to-end local mesh** that can be promoted to Kubernetes with the same contracts.

### What “Agent Service Mesh” means here

| Service mesh concept | AgentSphere equivalent |
| --- | --- |
| Service identity (SPIFFE) | Agent identity (JWT + agent card fingerprint) |
| Service discovery | Capability-based discovery |
| Sidecar / proxy | Agent Mesh Sidecar (embedded in SDK) |
| L7 routing | Capability + version + affinity routing |
| mTLS / policy | AuthN/Z, RBAC, tool allow-lists |
| Retries / CB / timeout | Mesh policy on A2A calls |
| Observability | OpenTelemetry traces/metrics/logs per invocation |
| Traffic splitting | Canary agent versions via registry weights |

---

## 2. Vision

Build an extensible agent platform where:

1. Agents announce **Agent Cards** (identity + capabilities + endpoints).
2. The mesh **discovers** agents by capability, not hard-coded URLs.
3. Invocations flow through a **governed data plane** (gateway + sidecar).
4. Multi-agent work is coordinated by a **durable workflow engine** (Temporal).
5. Tools and memory are first-class, injectable, and auditable.
6. Everything is cloud-native, observable, and policy-driven.

---

## 3. Goals

- **Modular** — independently deployable mesh services
- **Cloud native** — containers, health probes, 12-factor config
- **Event driven** — NATS JetStream for lifecycle/domain events
- **Secure** — OAuth2/JWT, RBAC, secrets isolation
- **Observable** — OTel traces across A2A hops
- **Extensible** — Agent SDK + tool/MCP plugins

---

## 4. Functional Requirements

### Agent lifecycle
Register → heartbeat → discoverable → invoke → scale/version → deregister/evict on missed heartbeats.

### Registry
Persist agent cards, instances, versions, health, weights.

### Discovery
Resolve `capability + constraints → instance endpoint` with load balancing.

### Communication
- North-south: REST (Gateway)
- East-west: REST/JSON over mesh sidecar (gRPC-ready contracts)
- Async: NATS subjects for events
- Realtime: WebSocket fan-out via Notification service

### Memory
Short-term (session/Redis), long-term (Postgres), vector (pgvector), shared workspace memory.

### Tools
Tool registry, schema validation, MCP-compatible adapters, DI into agents.

### Workflow
DAG orchestration with retries/compensation via Temporal.

### UI
Operator console: agents, graph, invocations, workflows.

---

## 5. Non-Functional Requirements

| NFR | Target (local/dev → prod) |
| --- | --- |
| Scalability | Horizontal agents + stateless control plane |
| Availability | Multi-replica services; Temporal durability |
| Latency | Discovery < 20ms p99 (cached); invoke overhead < 15ms |
| Resilience | Retries, timeouts, circuit breakers, DLQ events |
| Compliance | Audit log for register/invoke/tool calls |
| Auditability | Immutable event trail on NATS + Postgres audit table |

---

## 6. Personas

- **Platform Admin** — policies, tenants, secrets
- **Agent Developer** — SDK, cards, tools, local run
- **Operations Engineer** — health, SLOs, rollouts
- **Business User** — console chat / workflow triggers

---

## 7. High-Level Architecture

```
                    ┌──────────────────────────────┐
   Clients/UI ───►  │     API Gateway (N/S)        │
                    │  auth · rate limit · route   │
                    └──────────────┬───────────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          ▼
 ┌─────────────┐           ┌─────────────┐            ┌─────────────┐
 │   Auth      │           │  Registry   │            │  Discovery  │
 │  JWT/RBAC   │           │ Agent Cards │            │ Cap routing │
 └─────────────┘           └──────┬──────┘            └──────┬──────┘
                                  │ events                   │
                                  ▼                          ▼
                           ┌──────────── NATS JetStream ────────────┐
                           └───────────────┬────────────────────────┘
        ┌──────────────────┬───────────────┼──────────────┬─────────┐
        ▼                  ▼               ▼              ▼         ▼
 ┌────────────┐     ┌────────────┐  ┌────────────┐ ┌──────────┐ ┌──────────┐
 │  Runtime   │     │  Workflow  │  │ Tool Engine│ │  Memory  │ │  Notify  │
 │  invoke    │     │  Temporal  │  │ MCP/tools  │ │ Redis/PG │ │  WS/SSE  │
 └─────┬──────┘     └─────┬──────┘  └────────────┘ └──────────┘ └──────────┘
       │                  │
       │   A2A via Mesh Sidecar (SDK)
       ▼                  ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │  Agent Instances (researcher, synthesizer, …)                           │
 │  each embeds AgentSphere Sidecar: register · heartbeat · invoke · otel  │
 └─────────────────────────────────────────────────────────────────────────┘
```

**Control plane:** Auth, Registry, Discovery, Policy (in gateway/auth)  
**Data plane:** Gateway (N/S) + Agent Sidecar (E/W) + Runtime invoke path  
**Orchestration plane:** Workflow (Temporal)  
**Intelligence plane:** Tool Engine + Memory  

---

## 8. Domain Model

| Entity | Description |
| --- | --- |
| **Agent** | Logical agent (name, owner, card template) |
| **AgentInstance** | Running replica with endpoint + heartbeat |
| **AgentCard** | Portable JSON identity/capabilities/IO schema |
| **Capability** | Discoverable skill key (e.g. `research.web`) |
| **Tool** | Invocable function with JSON schema |
| **Workflow** | Temporal workflow definition / run |
| **Task** | Unit of work inside a workflow or invoke |
| **MemoryRecord** | Keyed memory with scope + optional embedding |
| **Event** | Domain event on NATS |

---

## 9. Microservices

| Service | Port | Responsibility |
| --- | --- | --- |
| `gateway` | 8080 | Edge API, authn, routing to mesh APIs |
| `auth` | 8081 | Token issue/validate, RBAC |
| `registry` | 8082 | Agent card CRUD, heartbeats, eviction |
| `discovery` | 8083 | Capability lookup, LB |
| `runtime` | 8084 | Synchronous A2A invoke orchestration |
| `workflow` | 8085 | Temporal client + worker APIs |
| `tool-engine` | 8086 | Tool registry + execution |
| `memory` | 8087 | STM/LTM/vector memory APIs |
| `notification` | 8088 | WebSocket/SSE fan-out |
| `console` | 3000 | Operator UI |

Infra: PostgreSQL `5432`, Redis `6379`, NATS `4222`, Temporal `7233`, OTel collector `4318`.

---

## 10. Agent SDK

TypeScript package `@agentsphere/sdk`:

- `defineAgent({ card, handlers })`
- Auto-registration + heartbeat
- `mesh.invoke(capability, input, opts)` via sidecar
- Tool injection from Tool Engine
- Session memory helpers
- OpenTelemetry instrumentation

---

## 11. Agent Cards

```json
{
  "apiVersion": "agentsphere.io/v1",
  "kind": "AgentCard",
  "metadata": {
    "name": "researcher",
    "version": "1.0.0",
    "owner": "platform"
  },
  "spec": {
    "capabilities": ["research.web", "summarize.short"],
    "inputSchema": { "type": "object" },
    "outputSchema": { "type": "object" },
    "endpoints": { "invoke": "/v1/invoke" },
    "resources": { "timeoutMs": 30000 },
    "tools": ["web.search"]
  }
}
```

---

## 12. Registry

- Postgres tables: `agents`, `agent_instances`, `heartbeats_audit`
- APIs: register, heartbeat, deregister, list, get
- Evictor: mark `UNHEALTHY` / remove after `3 × heartbeatInterval`
- Emits `agent.registered`, `agent.heartbeat`, `agent.deregistered`

---

## 13. Discovery

- Query: capability, version range, labels, tenant
- Strategy: weighted round-robin over healthy instances
- Cache: Redis TTL 5s + JetStream invalidation on `agentsphere.agent.*` (registered/updated/offline/deregistered; heartbeat only when status ≠ HEALTHY)

---

## 14. Communication

| Channel | Use |
| --- | --- |
| REST | Control APIs + invoke |
| NATS | Lifecycle & audit events |
| WebSocket | Console live updates |
| Temporal | Durable multi-agent workflows |
| gRPC | Reserved in contracts for future |

---

## 15. Workflow Engine

Temporal task queue `agentsphere-workflows`:

- Activities call Runtime/Discovery to invoke agents
- Retries + compensation (saga) for multi-step agent pipelines
- Sample: `ResearchThenSynthesizeWorkflow`

---

## 16. Tool Engine

- Register tools with JSON Schema
- Execute locally or proxy MCP servers
- Policy: which agents may call which tools

---

## 17. Memory

| Tier | Store | API |
| --- | --- | --- |
| Short-term | Redis | `PUT/GET /v1/memory/session/:id` |
| Long-term | Postgres | `POST /v1/memory/records` |
| Vector | pgvector | `POST /v1/memory/search` |
| Shared | Postgres workspace scope | scoped by `workflowId` |

---

## 18. Security

- Dev: HMAC/JWT from Auth service (`AS_DEV_TOKEN`)
- Prod path: OAuth2/OIDC, mTLS between sidecars, RBAC roles (`admin`, `developer`, `agent`, `viewer`)
- Secrets via env / future vault integration
- Audit every privileged action

---

## 19. Observability

- OpenTelemetry SDK in gateway, runtime, SDK sidecar
- Prometheus metrics scrape
- Structured JSON logs with `traceId`, `agentId`, `capability`
- Compose profile includes collector (optional)

---

## 20. UI (Console)

- Agents table + health
- Capability graph
- Invoke playground
- Workflow run status

---

## 21. APIs

Base path: `/v1`  
Versioned JSON APIs, consistent error envelope:

```json
{ "error": { "code": "NOT_FOUND", "message": "..." } }
```

Gateway prefixes: `/mesh/registry`, `/mesh/discovery`, `/mesh/runtime`, …

---

## 22. Database

PostgreSQL with **Flyway-compatible** versioned SQL in `db/migrations/` (`V{n}__*.sql`), applied by `runMigrations()` into `flyway_schema_history` (advisory-locked; safe from registry + memory boot).

| Version | Schema |
| --- | --- |
| V1 | tenants, agent_instances, tenant_members |
| V2 | event_outbox |
| V3 | memory_records |
| V4 | tools (independent tool registry) |

Future: `auth.*` clients/roles, `audit.*` append-only audit, embeddings/pgvector.

---

## 23. Events (NATS JetStream)

**Decision:** The mesh control-plane event bus is **NATS JetStream** (stream `AGENTSPHERE`, subjects `agentsphere.>`).  
Kafka is reserved for future analytics/CDC dual-write — JetStream already provides durable, replayable, tenant-tagged lifecycle events with Msg-Id dedup and durable consumers.

**Envelope:** CloudEvents 1.0 structured JSON (`MeshEvent` in `@agentsphere/contracts`). Every event carries `tenantid` (mandatory).

**Delivery:**
- Registry domain writes → Postgres **transactional outbox** → outbox relay → JetStream
- Runtime / workflow / tool-engine → JetStream publish (Msg-Id = event id)
- Notification service → durable consumer → SSE fan-out to console
- Discovery → durable consumer on `agentsphere.agent.>` → Redis cache invalidation

| CloudEvents type | Subject | Producer |
| --- | --- | --- |
| `com.agentsphere.agent.registered` | `agentsphere.agent.registered` | Registry (outbox) |
| `com.agentsphere.agent.updated` | `agentsphere.agent.updated` | Registry (outbox) |
| `com.agentsphere.agent.heartbeat` | `agentsphere.agent.heartbeat` | Registry (outbox) |
| `com.agentsphere.agent.offline` | `agentsphere.agent.offline` | Registry (eviction / deregister) |
| `com.agentsphere.agent.deregistered` | `agentsphere.agent.deregistered` | Registry (outbox) |
| `com.agentsphere.tool.registered` | `agentsphere.tool.registered` | Tool Engine |
| `com.agentsphere.task.started` | `agentsphere.task.started` | Runtime |
| `com.agentsphere.task.completed` | `agentsphere.task.completed` | Runtime |
| `com.agentsphere.task.failed` | `agentsphere.task.failed` | Runtime |
| `com.agentsphere.routing.failed` | `agentsphere.routing.failed` | Runtime |
| `com.agentsphere.workflow.started` | `agentsphere.workflow.started` | Workflow |
| `com.agentsphere.workflow.completed` | `agentsphere.workflow.completed` | Workflow |

---

## 24. Deployment

- **Local E2E:** `docker compose up --build`
- **K8s:** Helm charts under `deploy/helm` (scaffold)
- Health: `/healthz`, readiness: `/readyz`

---

## 25. CI/CD

GitHub Actions: lint → typecheck → unit → build images → compose smoke.

---

## 26. Testing

- Unit: contracts + routing + SDK
- Integration: registry↔discovery↔runtime
- E2E: compose smoke (`scripts/e2e-smoke.sh`)
- Contract: OpenAPI snapshots
- Chaos: kill agent instance → discovery failover (future)

---

## 27. Performance

- Discovery cache, connection pooling
- Async heartbeats
- Batch tool calls where possible
- Invoke path avoids extra hops when sidecar has warm discovery cache

---

## 28. HA/DR

- Stateless replicas for control plane
- Postgres primary + backups
- Temporal for workflow durability
- Multi-region: active-passive registry + global discovery (phase 2)

---

## 29. Roadmap (30 milestones — condensed phases)

**Phase 0 — Foundation (this repo)**  
1. Monorepo + contracts  
2. Auth JWT  
3. Registry + heartbeats  
4. Discovery  
5. Gateway  
6. Runtime invoke  
7. Agent SDK sidecar  
8. Sample agents  
9. Docker Compose E2E  
10. Console MVP  

**Phase 1 — Intelligence**  
11–16. Tool engine, MCP, memory tiers, vector search, audit UI, policies  

**Phase 2 — Orchestration**  
17–22. Temporal workflows, saga compensation, workflow designer, notifications, canaries, SLOs  

**Phase 3 — Enterprise**  
23–30. mTLS, multi-tenant, Helm/prod, chaos, cost controls, marketplace, compliance packs, multi-region  

---

## 30. Appendix

### Glossary
- **A2A** — Agent-to-agent call  
- **Agent Card** — Portable agent metadata document  
- **Sidecar** — SDK-embedded mesh client  
- **Capability** — Discoverable skill identifier  

### Conventions
- Package scope: `@agentsphere/*`
- Env prefix: `AS_`
- IDs: ULID

### References
- A2A / agent-card community patterns
- MCP (Model Context Protocol)
- Temporal durable execution
- Istio/Linkerd conceptual model (adapted for agents)
- OpenTelemetry semantic conventions
