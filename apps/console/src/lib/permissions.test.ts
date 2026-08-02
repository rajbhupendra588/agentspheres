import { describe, expect, it } from "vitest";
import { can, PERMISSION_ACTIONS } from "@/lib/permissions";

describe("can()", () => {
  it("denies all actions when role is null", () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(can(null, action)).toBe(false);
    }
  });

  it("allows admin all actions", () => {
    for (const action of PERMISSION_ACTIONS) {
      expect(can("admin", action)).toBe(true);
    }
  });

  it("allows developer manage_tools and invoke", () => {
    expect(can("developer", "manage_tools")).toBe(true);
    expect(can("developer", "invoke")).toBe(true);
    expect(can("developer", "manage_users")).toBe(false);
    expect(can("developer", "delete")).toBe(false);
  });

  it("allows viewer read only", () => {
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "write")).toBe(false);
    expect(can("viewer", "invoke")).toBe(false);
  });

  it("allows agent read and invoke", () => {
    expect(can("agent", "read")).toBe(true);
    expect(can("agent", "invoke")).toBe(true);
    expect(can("agent", "manage_tools")).toBe(false);
  });
});
