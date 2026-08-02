import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type pg from "pg";
import { createLogger, type Logger } from "./logger.js";

/**
 * Flyway-compatible migration runner.
 *
 * - Scripts: V{version}__{description}.sql (Flyway naming)
 * - History: flyway_schema_history (subset of Flyway columns)
 * - Idempotent DDL recommended for brownfield AgentSphere volumes
 */

const HISTORY_TABLE = "flyway_schema_history";

const HISTORY_DDL = `
CREATE TABLE IF NOT EXISTS ${HISTORY_TABLE} (
  installed_rank INT NOT NULL,
  version VARCHAR(50),
  description VARCHAR(200) NOT NULL,
  type VARCHAR(20) NOT NULL,
  script VARCHAR(1000) NOT NULL,
  checksum INT,
  installed_by VARCHAR(100) NOT NULL,
  installed_on TIMESTAMP NOT NULL DEFAULT NOW(),
  execution_time INT NOT NULL,
  success BOOLEAN NOT NULL,
  PRIMARY KEY (installed_rank)
);
CREATE INDEX IF NOT EXISTS idx_flyway_schema_history_success
  ON ${HISTORY_TABLE} (success);
`;

export interface MigrationFile {
  version: string;
  description: string;
  script: string;
  absolutePath: string;
  checksum: number;
  sql: string;
}

export interface MigrateOptions {
  pool: pg.Pool;
  /** Absolute path to directory containing V*__*.sql files. */
  directory?: string;
  logger?: Logger;
  installedBy?: string;
}

export interface MigrateResult {
  directory: string;
  applied: string[];
  skipped: string[];
}

const VERSIONED_RE = /^V(\d+(?:\.\d+)*)__(.+)\.sql$/i;

/** Flyway-style CRC32-ish checksum: signed 32-bit from md5 prefix for stability. */
export function checksumSql(sql: string): number {
  const hex = createHash("md5").update(sql, "utf8").digest("hex").slice(0, 8);
  const unsigned = Number.parseInt(hex, 16);
  return unsigned > 0x7fffffff ? unsigned - 0x100000000 : unsigned;
}

export function parseMigrationFileName(fileName: string): {
  version: string;
  description: string;
} | null {
  const match = VERSIONED_RE.exec(fileName);
  if (!match) return null;
  return {
    version: match[1]!,
    description: match[2]!.replace(/_/g, " "),
  };
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10));
  const pb = b.split(".").map((n) => Number.parseInt(n, 10));
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function resolveMigrationsDirectory(explicit?: string): string {
  const candidates = [
    explicit,
    process.env.AS_MIGRATIONS_DIR,
    path.resolve(process.cwd(), "db/migrations"),
    path.resolve(process.cwd(), "../../db/migrations"),
    path.resolve(process.cwd(), "../../../db/migrations"),
    path.resolve(process.cwd(), "../../../../db/migrations"),
  ].filter((v): v is string => Boolean(v));

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return path.resolve(candidate);
    }
  }

  throw new Error(
    `Migrations directory not found. Set AS_MIGRATIONS_DIR. Tried: ${candidates.join(", ")}`,
  );
}

export function loadMigrationFiles(directory: string): MigrationFile[] {
  const files = readdirSync(directory)
    .map((name) => {
      const parsed = parseMigrationFileName(name);
      if (!parsed) return null;
      const absolutePath = path.join(directory, name);
      const sql = readFileSync(absolutePath, "utf8");
      return {
        version: parsed.version,
        description: parsed.description,
        script: name,
        absolutePath,
        checksum: checksumSql(sql),
        sql,
      } satisfies MigrationFile;
    })
    .filter((m): m is MigrationFile => m !== null)
    .sort((a, b) => compareVersions(a.version, b.version));

  return files;
}

async function ensureHistoryTable(client: pg.PoolClient): Promise<void> {
  await client.query(HISTORY_DDL);
}

async function nextInstalledRank(client: pg.PoolClient): Promise<number> {
  const result = await client.query<{ max: string | null }>(
    `SELECT MAX(installed_rank)::text AS max FROM ${HISTORY_TABLE}`,
  );
  const max = result.rows[0]?.max;
  return max ? Number.parseInt(max, 10) + 1 : 1;
}

async function appliedVersions(client: pg.PoolClient): Promise<Set<string>> {
  const result = await client.query<{ version: string }>(
    `SELECT version FROM ${HISTORY_TABLE} WHERE success = TRUE AND version IS NOT NULL`,
  );
  return new Set(result.rows.map((r) => r.version));
}

/**
 * Applies pending Flyway-named SQL migrations. Safe to call from multiple
 * services — uses advisory lock + history table.
 */
export async function runMigrations(options: MigrateOptions): Promise<MigrateResult> {
  const log = options.logger ?? createLogger("migrate");
  const directory = resolveMigrationsDirectory(options.directory);
  const migrations = loadMigrationFiles(directory);
  const installedBy = options.installedBy ?? process.env.USER ?? "agentsphere";
  const applied: string[] = [];
  const skipped: string[] = [];

  const client = await options.pool.connect();
  try {
    // Session-level advisory lock — serialize migrators across registry/memory.
    await client.query("SELECT pg_advisory_lock($1)", [872514001]);
    await ensureHistoryTable(client);

    const done = await appliedVersions(client);

    for (const migration of migrations) {
      if (done.has(migration.version)) {
        skipped.push(migration.script);
        continue;
      }

      const started = Date.now();
      log.info("Applying migration", {
        version: migration.version,
        script: migration.script,
      });

      try {
        await client.query("BEGIN");
        await client.query(migration.sql);
        const rank = await nextInstalledRank(client);
        const executionTime = Date.now() - started;
        await client.query(
          `
          INSERT INTO ${HISTORY_TABLE} (
            installed_rank, version, description, type, script,
            checksum, installed_by, execution_time, success
          ) VALUES ($1, $2, $3, 'SQL', $4, $5, $6, $7, TRUE)
          `,
          [
            rank,
            migration.version,
            migration.description.slice(0, 200),
            migration.script,
            migration.checksum,
            installedBy.slice(0, 100),
            executionTime,
          ],
        );
        await client.query("COMMIT");
        applied.push(migration.script);
        log.info("Migration applied", {
          script: migration.script,
          executionTimeMs: executionTime,
        });
      } catch (err) {
        await client.query("ROLLBACK").catch(() => undefined);
        const executionTime = Date.now() - started;
        try {
          await client.query("BEGIN");
          const rank = await nextInstalledRank(client);
          await client.query(
            `
            INSERT INTO ${HISTORY_TABLE} (
              installed_rank, version, description, type, script,
              checksum, installed_by, execution_time, success
            ) VALUES ($1, $2, $3, 'SQL', $4, $5, $6, $7, FALSE)
            `,
            [
              rank,
              migration.version,
              migration.description.slice(0, 200),
              migration.script,
              migration.checksum,
              installedBy.slice(0, 100),
              executionTime,
            ],
          );
          await client.query("COMMIT");
        } catch {
          await client.query("ROLLBACK").catch(() => undefined);
        }
        throw err;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [872514001]).catch(() => undefined);
    client.release();
  }

  return { directory, applied, skipped };
}
