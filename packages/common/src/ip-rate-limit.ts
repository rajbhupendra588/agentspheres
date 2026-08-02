import type { FastifyReply, FastifyRequest } from "fastify";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { optional } from "./env.js";

export type IpRateLimiter = RateLimiterMemory;

/**
 * Create a CodeQL-recognized rate limiter (`rate-limiter-flexible`).
 * Call {@link enforceIpRateLimit} at the top of sensitive route handlers.
 */
export function createIpRateLimiter(options?: {
  points?: number;
  durationSeconds?: number;
}): IpRateLimiter {
  return new RateLimiterMemory({
    points: options?.points ?? Number(optional("AS_RATE_LIMIT_MAX", "200")),
    duration:
      options?.durationSeconds ??
      Math.max(1, Math.ceil(Number(optional("AS_RATE_LIMIT_WINDOW_MS", "60000")) / 1000)),
  });
}

/**
 * Consume one point for the caller IP. Returns false and writes 429 when limited.
 * Must be awaited before DB or authorization work in the same handler.
 */
export async function enforceIpRateLimit(
  limiter: IpRateLimiter,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  try {
    await limiter.consume(String(request.ip || "unknown"));
    return true;
  } catch (rejection) {
    const ms =
      typeof rejection === "object" &&
      rejection !== null &&
      "msBeforeNext" in rejection &&
      typeof (rejection as { msBeforeNext: unknown }).msBeforeNext === "number"
        ? (rejection as { msBeforeNext: number }).msBeforeNext
        : 1000;
    const afterSeconds = Math.max(1, Math.ceil(ms / 1000));
    reply.header("retry-after", String(afterSeconds));
    reply.status(429).send({
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded. Retry after ${afterSeconds} seconds.`,
      },
    });
    return false;
  }
}
