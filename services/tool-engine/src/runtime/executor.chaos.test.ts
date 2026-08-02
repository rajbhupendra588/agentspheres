import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CircuitBreaker, ConcurrencyGuard, BulkheadRejectedError } from "./concurrency.js";

/**
 * Chaos / concurrency stress for ToolSphere runtime primitives.
 * These tests do not require Postgres; they validate isolation under contention.
 */
describe("chaos: concurrent bulkhead acquire/release", () => {
  it("never goes negative under interleaved releases", async () => {
    const guard = new ConcurrencyGuard();
    const workers = Array.from({ length: 200 }, async (_, i) => {
      const release = guard.tryAcquire(`tenant-${i % 7}`, `tool-${i % 11}`);
      await new Promise((r) => setTimeout(r, Math.random() * 5));
      release();
    });
    await Promise.all(workers);
    assert.equal(guard.snapshot().global, 0);
  });
});

describe("chaos: circuit breaker flap", () => {
  it("does not accept calls while open", () => {
    const breaker = new CircuitBreaker(5, 50);
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    let rejected = 0;
    for (let i = 0; i < 20; i++) {
      try {
        breaker.assertClosed("flap");
      } catch {
        rejected += 1;
      }
    }
    assert.equal(rejected, 20);
  });
});

describe("chaos: backpressure error contract", () => {
  it("BulkheadRejectedError is distinguishable for retry storms", () => {
    const err = new BulkheadRejectedError("saturated");
    assert.ok(err instanceof Error);
    assert.equal(err.statusCode, 429);
    // Clients should treat TOOL_BACKPRESSURE as retryable with jittered backoff.
    assert.equal(err.code, "TOOL_BACKPRESSURE");
  });
});
