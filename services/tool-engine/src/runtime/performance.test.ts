import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConcurrencyGuard } from "./concurrency.js";

describe("performance: bulkhead acquire/release throughput", () => {
  it("handles 50k acquire/release cycles under 2s", () => {
    const guard = new ConcurrencyGuard();
    const started = performance.now();
    const iterations = 50_000;
    for (let i = 0; i < iterations; i++) {
      const release = guard.tryAcquire("perf-tenant", "perf.tool");
      release();
    }
    const elapsed = performance.now() - started;
    assert.equal(guard.snapshot().global, 0);
    assert.ok(elapsed < 2000, `expected <2000ms, got ${elapsed}ms`);
  });
});
