import { toolEngineConfig } from "../config.js";

export class BulkheadRejectedError extends Error {
  readonly code = "TOOL_BACKPRESSURE";
  readonly statusCode = 429;

  constructor(message: string) {
    super(message);
    this.name = "BulkheadRejectedError";
  }
}

/**
 * Hierarchical bulkheads for 100k-scale concurrency protection:
 * global → tenant → tool.
 */
export class ConcurrencyGuard {
  private globalActive = 0;
  private readonly tenantActive = new Map<string, number>();
  private readonly toolActive = new Map<string, number>();

  tryAcquire(tenantId: string, toolName: string): () => void {
    if (this.globalActive >= toolEngineConfig.maxConcurrentExecutions) {
      throw new BulkheadRejectedError(
        `Global execution limit reached (${toolEngineConfig.maxConcurrentExecutions})`,
      );
    }
    const tenantCount = this.tenantActive.get(tenantId) ?? 0;
    if (tenantCount >= toolEngineConfig.maxConcurrentPerTenant) {
      throw new BulkheadRejectedError(
        `Tenant "${tenantId}" execution limit reached (${toolEngineConfig.maxConcurrentPerTenant})`,
      );
    }
    const toolKey = `${tenantId}:${toolName}`;
    const toolCount = this.toolActive.get(toolKey) ?? 0;
    if (toolCount >= toolEngineConfig.maxConcurrentPerTool) {
      throw new BulkheadRejectedError(
        `Tool "${toolName}" execution limit reached (${toolEngineConfig.maxConcurrentPerTool})`,
      );
    }

    this.globalActive += 1;
    this.tenantActive.set(tenantId, tenantCount + 1);
    this.toolActive.set(toolKey, toolCount + 1);

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.globalActive -= 1;
      this.tenantActive.set(tenantId, Math.max(0, (this.tenantActive.get(tenantId) ?? 1) - 1));
      this.toolActive.set(toolKey, Math.max(0, (this.toolActive.get(toolKey) ?? 1) - 1));
    };
  }

  snapshot(): { global: number; tenants: number; tools: number } {
    return {
      global: this.globalActive,
      tenants: this.tenantActive.size,
      tools: this.toolActive.size,
    };
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  constructor(
    private readonly failureThreshold = toolEngineConfig.circuitBreakerFailureThreshold,
    private readonly resetMs = toolEngineConfig.circuitBreakerResetMs,
  ) {}

  assertClosed(toolName: string): void {
    if (this.state === "OPEN") {
      if (Date.now() >= this.openUntil) {
        this.state = "HALF_OPEN";
        return;
      }
      const err = new Error(`Circuit open for tool "${toolName}"`);
      (err as Error & { code: string; statusCode: number }).code = "TOOL_CIRCUIT_OPEN";
      (err as Error & { statusCode: number }).statusCode = 503;
      throw err;
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = "CLOSED";
    this.openUntil = 0;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.openUntil = Date.now() + this.resetMs;
    }
  }

  getState(): string {
    return this.state;
  }
}

export class CircuitBreakerRegistry {
  private readonly breakers = new Map<string, CircuitBreaker>();

  get(tenantId: string, toolName: string): CircuitBreaker {
    const key = `${tenantId}:${toolName}`;
    let breaker = this.breakers.get(key);
    if (!breaker) {
      breaker = new CircuitBreaker();
      this.breakers.set(key, breaker);
    }
    return breaker;
  }
}
