# AgentSphere Console

Operator UI for the AgentSphere AI Agent Service Mesh. The console talks to real mesh APIs via the gateway — no mock data.

## Development

From the monorepo root:

```bash
pnpm install
pnpm --filter @agentsphere/console dev
```

The Vite dev server proxies mesh requests to the gateway (default `http://localhost:8080`). Ensure the mesh stack is running:

```bash
docker compose up --build
# or
pnpm smoke
```

### Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Vite dev server (port 5173) |
| `pnpm dev:server` | Fastify static server with tsx watch |
| `pnpm build` | Typecheck UI + Vite build + compile server |
| `pnpm typecheck` | TypeScript check (app + server) |
| `pnpm test` | Vitest unit tests |
| `pnpm start` | Production server (`dist-server/server.js`) |

## Build & production

```bash
pnpm --filter @agentsphere/console build
pnpm --filter @agentsphere/console start
```

Console is served at **http://localhost:3000** in Docker Compose.

## API wiring

- **Client**: `src/api/client.ts` — axios with JWT from `auth-store`, retries, `ApiClientError`
- **Mesh routes**: `src/api/mesh.ts` — health, registry, discovery, invoke, tools, workflows, memory, auth, SSE events
- **Hooks**: `src/hooks/*` — React Query wrappers (`useAgents`, `useTools`, `useWorkflows`, `useMeshHealth`, …)
- **Live events**: `useLiveEvents` → SSE `/mesh/notify/v1/events` → `events-store`
- **Gateway URL**: `resolveGatewayBaseUrl()` — `window.AGENTSPHERE_GATEWAY`, `VITE_GATEWAY_URL`, or same-origin proxy

Issue a JWT on **Security** (`POST /mesh/auth/v1/token`) to authenticate when the gateway is locked down.

External applications should integrate against the Gateway **OpenAPI** contract:
`GET http://localhost:8080/openapi.yaml` (source: `services/gateway/openapi/openapi.yaml`).

## Multi-tenancy

The console scopes all mesh requests to a **tenant** (and optional **project**):

- **Tenant switcher** (top bar) — selects the active tenant; sends `x-tenant-id` on every request
- **Auth store** — persists `tenantId` (default `default`) and optional `projectId`
- **JWT claims** — tokens are issued per tenant; switching tenants re-issues the token when a session exists
- **React Query keys** — include `tenantId` so agent, tool, and workflow lists refetch on tenant change

List available tenants via `GET /mesh/registry/v1/tenants`.

## Pages map

| Route | Page | Data source |
| --- | --- | --- |
| `/` | Dashboard | Health, agents, workflows |
| `/agents` | Registry | `GET /mesh/registry/v1/agents` |
| `/agents/:id` | Agent details | Registry by instance |
| `/agents/graph` | Agent graph | Registry + AgentFlow |
| `/discovery` | Discovery | `GET/POST /mesh/discovery/v1/discover` |
| `/workflows` | Workflows | `GET /mesh/workflow/v1/workflows` |
| `/workflows/builder` | Workflow builder | `POST …/research-synthesize` |
| `/tools` | Tools | `GET/POST /mesh/tools/v1/tools` |
| `/memory` | Memory | Memory get/set/search APIs |
| `/events` | Event bus | SSE + preferences store |
| `/metrics` | Metrics | Computed from agents, health, workflows |
| `/tracing` | Tracing | Workflow step timestamps |
| `/health` | Health | `GET /mesh/health` |
| `/kafka` | Event Topics (JetStream) | `@agentsphere/contracts` subjects + live JetStream→SSE events |
| `/security` | Security | Token issue/introspect |
| `/users` | Users | Role model only (no user directory API) |
| `/roles` | Roles | `can()` permission matrix |
| `/api-explorer` | API Explorer | Presets + axios client |
| `/configuration` | Configuration | Gateway resolution + preferences |
| `/settings` | Settings | Theme, preferences, session |

Routes without a backend (routing policies, task queue, user directory) show **EmptyState** explaining the service is not deployed on the gateway.

## Router

- `src/app/router.tsx` — `BrowserRouter`, lazy-loaded pages, `AppShell` with `useMeshHealth`
- `src/App.tsx` — renders `<AppRouter />`

## Tests

```bash
pnpm --filter @agentsphere/console test
```

Covers `can()`, format helpers, `ApiClientError`, and the roles permission matrix page.
