import pg from "pg";

export function createPgPool(url: string): pg.Pool {
  return new pg.Pool({
    connectionString: url,
    max: Number(process.env.AS_PG_POOL_MAX ?? 10),
    idleTimeoutMillis: Number(process.env.AS_PG_IDLE_TIMEOUT_MS ?? 30_000),
    connectionTimeoutMillis: Number(process.env.AS_PG_CONNECT_TIMEOUT_MS ?? 5_000),
  });
}
