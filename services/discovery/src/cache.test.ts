import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDiscoveryCacheKey,
  buildInvalidationPatterns,
} from "./cache.js";

describe("discovery cache keys", () => {
  it("builds stable cache keys with project and version sentinels", () => {
    assert.equal(
      buildDiscoveryCacheKey({
        tenantId: "acme",
        capability: "research.web",
      }),
      "discover:acme:_:research.web:_",
    );

    assert.equal(
      buildDiscoveryCacheKey({
        tenantId: "acme",
        projectId: "platform",
        capability: "research.web",
        version: "1.2.0",
      }),
      "discover:acme:platform:research.web:1.2.0",
    );
  });

  it("builds targeted invalidation patterns for registered/updated", () => {
    const patterns = buildInvalidationPatterns({
      tenantId: "acme",
      projectId: "platform",
      capabilities: ["research.web", "synthesize.report"],
      mode: "targeted",
    });

    assert.ok(patterns.includes("discover:acme:platform:research.web:*"));
    assert.ok(patterns.includes("discover:acme:_:research.web:*"));
    assert.ok(patterns.includes("discover:acme:platform:synthesize.report:*"));
  });

  it("builds tenant-wide patterns for offline/deregistered", () => {
    assert.deepEqual(
      buildInvalidationPatterns({
        tenantId: "acme",
        mode: "tenant",
      }),
      ["discover:acme:*"],
    );

    assert.deepEqual(
      buildInvalidationPatterns({
        tenantId: "acme",
        projectId: "platform",
        mode: "tenant",
      }),
      ["discover:acme:platform:*"],
    );
  });
});
