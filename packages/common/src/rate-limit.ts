import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { optional } from "./env.js";

export type ServiceRateLimitOptions = {
  max?: number;
  timeWindowMs?: number;
  /** Paths that skip rate limiting (health probes, etc.). */
  allowPaths?: string[];
};

const DEFAULT_ALLOW = ["/healthz", "/readyz"];

/**
 * Register `@fastify/rate-limit` globally for a Fastify service.
 * Must be awaited before route registration so every handler is covered.
 */
export async function registerServiceRateLimit(
  app: FastifyInstance,
  options: ServiceRateLimitOptions = {},
): Promise<void> {
  const max = options.max ?? Number(optional("AS_RATE_LIMIT_MAX", "200"));
  const timeWindow = options.timeWindowMs ?? Number(optional("AS_RATE_LIMIT_WINDOW_MS", "60000"));
  const allowPaths = new Set([...(options.allowPaths ?? []), ...DEFAULT_ALLOW]);

  await app.register(rateLimit, {
    max,
    timeWindow,
    addHeadersOnExceeding: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    allowList: (req) => {
      const path = req.url.split("?")[0] ?? req.url;
      return allowPaths.has(path);
    },
    errorResponseBuilder: (_req, context) => {
      const afterSeconds = Math.max(1, Math.ceil(context.ttl / 1000));
      return Object.assign(
        new Error(`Rate limit exceeded. Retry after ${afterSeconds} seconds.`),
        {
          statusCode: context.statusCode,
          code: "RATE_LIMITED",
        },
      );
    },
  });
}

/**
 * Per-route rate-limit config that CodeQL's `js/missing-rate-limiting` recognizes.
 * Empty object inherits the globally registered limiter.
 */
export function routeRateLimit(overrides?: { max?: number; timeWindow?: number | string }) {
  return {
    config: {
      rateLimit: overrides ?? {},
    },
  };
}
