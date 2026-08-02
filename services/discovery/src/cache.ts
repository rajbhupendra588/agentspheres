import type { Redis } from "ioredis";
import { createLogger } from "@agentsphere/common";

const log = createLogger("discovery");

export const DISCOVERY_CACHE_TTL_SECONDS = 5;

export function buildDiscoveryCacheKey(input: {
  tenantId: string;
  projectId?: string | null;
  capability: string;
  version?: string | null;
}): string {
  return `discover:${input.tenantId}:${input.projectId ?? "_"}:${input.capability}:${input.version ?? "_"}`;
}

export interface InvalidateDiscoveryCacheInput {
  tenantId: string;
  /** When set, scopes SCAN to this project key segment. */
  projectId?: string | null;
  /** When set, invalidate only these capability prefixes. */
  capabilities?: string[];
  /** When set with capabilities, also delete the exact version key. */
  version?: string | null;
  /**
   * tenant — wipe all discover:{tenant}:* keys (offline / deregistered).
   * targeted — wipe capability prefixes (registered / updated).
   */
  mode: "tenant" | "targeted";
}

/**
 * Invalidates discovery Redis keys for a tenant (optionally scoped by project/capability).
 * Uses SCAN to avoid KEYS on large shared Redis.
 */
export async function invalidateDiscoveryCache(
  redis: Redis,
  input: InvalidateDiscoveryCacheInput,
): Promise<number> {
  const patterns = buildInvalidationPatterns(input);
  let deleted = 0;

  for (const pattern of patterns) {
    deleted += await scanAndDelete(redis, pattern);
  }

  if (deleted > 0) {
    log.info("discovery cache invalidated", {
      tenantId: input.tenantId,
      projectId: input.projectId ?? undefined,
      mode: input.mode,
      patterns,
      deleted,
    });
  }

  return deleted;
}

export function buildInvalidationPatterns(input: InvalidateDiscoveryCacheInput): string[] {
  const tenant = input.tenantId;
  const project = input.projectId ?? "_";

  if (input.mode === "tenant") {
    if (input.projectId) {
      return [`discover:${tenant}:${project}:*`];
    }
    return [`discover:${tenant}:*`];
  }

  const capabilities = input.capabilities ?? [];
  if (capabilities.length === 0) {
    return [`discover:${tenant}:${project}:*`];
  }

  const patterns = new Set<string>();
  for (const capability of capabilities) {
    patterns.add(`discover:${tenant}:${project}:${capability}:*`);
    // Also cover queries that omit project (key segment "_") when event carries a project.
    if (input.projectId) {
      patterns.add(`discover:${tenant}:_:${capability}:*`);
    }
  }
  return [...patterns];
}

async function scanAndDelete(redis: Redis, pattern: string): Promise<number> {
  let cursor = "0";
  let deleted = 0;

  do {
    const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    cursor = next;
    if (keys.length > 0) {
      deleted += await redis.del(...keys);
    }
  } while (cursor !== "0");

  return deleted;
}
