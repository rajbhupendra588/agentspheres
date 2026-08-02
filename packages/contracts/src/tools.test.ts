import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ToolCardSchema,
  ToolDiscoverQuerySchema,
  ToolExecuteRequestSchema,
  ToolExecuteResponseSchema,
  ToolCategorySchema,
} from "./tools.js";

describe("ToolSphere contracts", () => {
  it("accepts a complete Tool Card", () => {
    const card = ToolCardSchema.parse({
      id: "tool_abc",
      name: "postgres.query",
      description: "Execute SQL",
      version: "1.0.0",
      owner: "agentsphere",
      category: "DATABASE",
      capabilities: [{ name: "postgres.query", executionModes: ["SYNC"] }],
      authentication: { schemes: ["API_KEY"], required: true },
      permissions: ["tools.postgres.execute"],
      tenantId: "acme",
      tags: ["sql"],
      lifecycle: "ACTIVE",
      builtin: true,
    });
    assert.equal(card.category, "DATABASE");
    assert.equal(card.capabilities.length, 1);
  });

  it("enumerates all enterprise categories", () => {
    assert.ok(ToolCategorySchema.options.includes("CORE_MESH"));
    assert.ok(ToolCategorySchema.options.includes("CUSTOM"));
    assert.equal(ToolCategorySchema.options.length, 24);
  });

  it("parses execute requests with idempotency and retry", () => {
    const req = ToolExecuteRequestSchema.parse({
      tool: "web.search",
      input: { query: "agentsphere" },
      idempotencyKey: "idem-1",
      retry: { maxAttempts: 3, backoffMs: 50 },
      timeoutMs: 5000,
    });
    assert.equal(req.mode, "SYNC");
    assert.equal(req.retry?.maxAttempts, 3);
  });

  it("requires executionId on execute response", () => {
    const res = ToolExecuteResponseSchema.parse({
      executionId: "01HEXEC",
      output: { ok: true },
      tool: "echo",
      status: "SUCCEEDED",
      latencyMs: 12,
    });
    assert.equal(res.status, "SUCCEEDED");
  });

  it("supports capability discovery queries", () => {
    const q = ToolDiscoverQuerySchema.parse({
      capability: "postgres.query",
      category: "DATABASE",
      health: "HEALTHY",
      limit: 10,
    });
    assert.equal(q.offset, 0);
    assert.equal(q.capability, "postgres.query");
  });
});
