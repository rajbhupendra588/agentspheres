# AgentSphere OpenAPI

Canonical client contract for applications calling the AgentSphere Gateway.

| Artifact | Path |
| --- | --- |
| Spec (served by Gateway) | [`services/gateway/openapi/openapi.yaml`](../../services/gateway/openapi/openapi.yaml) |
| Docs mirror | [`agentsphere-gateway.openapi.yaml`](./agentsphere-gateway.openapi.yaml) |
| Live YAML | `GET http://localhost:8080/openapi.yaml` |
| Live discovery JSON | `GET http://localhost:8080/openapi.json` |

## Generate a client

```bash
# Example: openapi-generator
openapi-generator-cli generate \
  -i services/gateway/openapi/openapi.yaml \
  -g typescript-fetch \
  -o /tmp/agentsphere-client

# Example: openapi-typescript
npx openapi-typescript services/gateway/openapi/openapi.yaml -o client/schema.d.ts
```

## Production semantics (summary)

- **Errors:** `{ error: { code, message, details? } }`
- **Auth:** Bearer JWT; locked mode requires bootstrap for token mint
- **Tenancy:** `x-tenant-id` / JWT `tenantId` (JWT wins)
- **Rate limits:** `429` + `Retry-After` + `x-ratelimit-*`
- **Resiliency:** retry `429/502/503/504` with backoff; set timeouts ≥ invoke budget
- **Availability:** `/healthz`, `/readyz`, `/mesh/health`
