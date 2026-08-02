import type pg from "pg";
import { createLogger, runMigrations } from "@agentsphere/common";

const log = createLogger("tool-engine");

export async function initToolSchema(pool: pg.Pool): Promise<void> {
  const result = await runMigrations({
    pool,
    logger: log,
    installedBy: "tool-engine",
  });
  log.info("database migrations ready", {
    directory: result.directory,
    applied: result.applied,
    skipped: result.skipped.length,
  });
}

export * from "./registry.js";
export * from "./executions.js";
export * from "./ops.js";
