import type { ToolLifecycleState } from "@agentsphere/contracts";
import type { ToolLifecycle } from "./types.js";

const TRANSITIONS: Record<ToolLifecycleState, ToolLifecycleState[]> = {
  DRAFT: ["REGISTERED", "REMOVED"],
  REGISTERED: ["VALIDATED", "DISABLED", "REMOVED"],
  VALIDATED: ["ACTIVE", "DISABLED", "REMOVED"],
  ACTIVE: ["DEPRECATED", "DISABLED", "REMOVED"],
  DEPRECATED: ["DISABLED", "REMOVED", "ACTIVE"],
  DISABLED: ["ACTIVE", "REMOVED"],
  REMOVED: [],
};

export class ToolLifecycleController implements ToolLifecycle {
  state: ToolLifecycleState;

  constructor(initial: ToolLifecycleState = "DRAFT") {
    this.state = initial;
  }

  async transition(to: ToolLifecycleState, reason?: string): Promise<void> {
    const allowed = TRANSITIONS[this.state];
    if (!allowed.includes(to)) {
      throw new Error(
        `Illegal tool lifecycle transition ${this.state} → ${to}${reason ? `: ${reason}` : ""}`,
      );
    }
    this.state = to;
  }

  static canTransition(from: ToolLifecycleState, to: ToolLifecycleState): boolean {
    return TRANSITIONS[from].includes(to);
  }

  static assertTransition(from: ToolLifecycleState, to: ToolLifecycleState): void {
    if (!this.canTransition(from, to)) {
      throw Object.assign(new Error(`Illegal tool lifecycle transition ${from} → ${to}`), {
        code: "INVALID_LIFECYCLE_TRANSITION",
        statusCode: 409,
      });
    }
  }
}
