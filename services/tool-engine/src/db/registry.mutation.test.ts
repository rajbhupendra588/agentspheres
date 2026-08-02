import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ToolLifecycleController } from "@agentsphere/tool-sdk";

/**
 * Mutation-style tests: assert illegal lifecycle mutations are rejected.
 * These protect registry upgrade/deprecation invariants under concurrent editors.
 */
describe("mutation: tool lifecycle", () => {
  it("rejects DRAFT → ACTIVE (must validate first)", () => {
    assert.equal(ToolLifecycleController.canTransition("DRAFT", "ACTIVE"), false);
  });

  it("rejects REMOVED → ACTIVE (tombstones are terminal)", () => {
    assert.equal(ToolLifecycleController.canTransition("REMOVED", "ACTIVE"), false);
  });

  it("allows ACTIVE → DEPRECATED → REMOVED", () => {
    assert.equal(ToolLifecycleController.canTransition("ACTIVE", "DEPRECATED"), true);
    assert.equal(ToolLifecycleController.canTransition("DEPRECATED", "REMOVED"), true);
  });

  it("throws on illegal assertTransition", () => {
    assert.throws(() => ToolLifecycleController.assertTransition("ACTIVE", "DRAFT"));
  });
});
