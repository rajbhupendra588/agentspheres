import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { defineTool, toToolCard, defaultValidateJsonSchema, toolIdFor } from "./define-tool.js";
import { ToolLifecycleController } from "./lifecycle.js";

describe("tool-sdk", () => {
  it("defineTool produces a frozen tool with capabilities", () => {
    const tool = defineTool({
      metadata: {
        name: "echo",
        description: "Echo input",
        version: "1.0.0",
        owner: "system",
        category: "CORE_MESH",
        builtin: true,
        inputSchema: { type: "object" },
      },
      execute: async (_ctx, input) => ({ output: input }),
    });

    assert.equal(tool.metadata.name, "echo");
    assert.equal(tool.capabilities.length, 1);
    assert.equal(tool.capabilities[0]!.name, "echo");
  });

  it("toToolCard is tenant-scoped and stable", () => {
    const tool = defineTool({
      metadata: {
        name: "fs.read",
        description: "Read file",
        version: "1.0.0",
        owner: "platform",
        category: "FILESYSTEM",
      },
      execute: async () => ({ output: null }),
    });
    const a = toToolCard(tool, "acme");
    const b = toToolCard(tool, "acme");
    assert.equal(a.id, b.id);
    assert.equal(a.tenantId, "acme");
    assert.notEqual(toolIdFor("acme", "fs.read"), toolIdFor("other", "fs.read"));
  });

  it("validates required JSON schema fields", async () => {
    const result = await defaultValidateJsonSchema(
      {
        type: "object",
        required: ["query"],
        properties: { query: { type: "string" } },
      },
      {},
    );
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, "REQUIRED");
  });

  it("enforces lifecycle transitions", async () => {
    const lc = new ToolLifecycleController("DRAFT");
    await lc.transition("REGISTERED");
    await lc.transition("VALIDATED");
    await lc.transition("ACTIVE");
    await assert.rejects(() => lc.transition("DRAFT"));
  });
});
