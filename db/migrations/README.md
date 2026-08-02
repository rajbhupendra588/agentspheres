# AgentSphere database migrations

Flyway-compatible versioned SQL:

```
V{version}__{description}.sql
```

Applied by `@agentsphere/common` `runMigrations()` into `flyway_schema_history`.

| Version | Script | Purpose |
| --- | --- | --- |
| 1 | `V1__registry_tenants_and_agents.sql` | Tenants, agents, members |
| 2 | `V2__event_outbox.sql` | Transactional outbox |
| 3 | `V3__memory_records.sql` | Durable memory |
| 4 | `V4__tool_registry.sql` | Independent tool registry |

## Runtime

Services resolve the directory via:

1. `AS_MIGRATIONS_DIR`
2. `./db/migrations` or `../../db/migrations` from the service working directory

Compose sets `AS_MIGRATIONS_DIR=/app/db/migrations`.

## Optional Flyway CLI

These scripts are safe to run with the official Flyway image against the same database (`flyway_schema_history` is shared). Prefer a single migrator in production (either the Node runner at boot, or Flyway as an init job — not both concurrently without coordination).
