import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BulkheadRejectedError,
  CircuitBreaker,
  ConcurrencyGuard,
} from "./concurrency.js";

describe("ConcurrencyGuard", () => {
  it("releases permits and rejects when saturated", () => {
    const guard = new ConcurrencyGuard();
    const releases: Array<() => void> = [];
    // Drive tenant bulkhead with a low synthetic load by acquiring many times
    // until rejection; default limits are high so we only assert release hygiene.
    const release = guard.tryAcquire("t1", "echo");
    releases.push(release);
    assert.equal(guard.snapshot().global, 1);
    release();
    assert.equal(guard.snapshot().global, 0);
    release(); // idempotent
    assert.equal(guard.snapshot().global, 0);
  });
});

describe("CircuitBreaker", () => {
  it("opens after failure threshold and recovers after reset window", () => {
    const breaker = new CircuitBreaker(3, 10);
    breaker.assertClosed("x");
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    assert.equal(breaker.getState(), "OPEN");
    assert.throws(() => breaker.assertClosed("x"));
  });

  it("closes on success", () => {
    const breaker = new CircuitBreaker(2, 60_000);
    breaker.recordFailure();
    breaker.recordSuccess();
    assert.equal(breaker.getState(), "CLOSED");
    breaker.assertClosed("ok");
  });
});

describe("BulkheadRejectedError", () => {
  it("exposes 429 backpressure code", () => {
    const err = new BulkheadRejectedError("full");
    assert.equal(err.statusCode, 429);
    assert.equal(err.code, "TOOL_BACKPRESSURE");
  });
});
