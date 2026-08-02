import type pg from "pg";
import type { ToolCard, ToolExecuteRequest, ToolExecuteResponse } from "@agentsphere/contracts";
import { createLogger, ulid } from "@agentsphere/common";
import type { Tool, ToolContext } from "@agentsphere/tool-sdk";
import { ToolSdkError, toolCancelled, toolTimeout } from "@agentsphere/tool-sdk";
import { getBuiltinHandler } from "../builtins/index.js";
import { toolEngineConfig } from "../config.js";
import {
  completeExecution,
  createExecution,
  findIdempotentExecution,
  getConfiguration,
  getToolCard,
  recordMetrics,
  writeAudit,
  evaluatePermissions,
} from "../db/index.js";
import {
  publishToolExecuted,
  publishToolFailed,
} from "../events.js";
import { CircuitBreakerRegistry, ConcurrencyGuard } from "./concurrency.js";

const log = createLogger("tool-engine");
const concurrency = new ConcurrencyGuard();
const circuits = new CircuitBreakerRegistry();
const cancelTokens = new Map<string, AbortController>();

export function getConcurrencySnapshot() {
  return concurrency.snapshot();
}

export function requestCancel(executionId: string, reason?: string): boolean {
  const controller = cancelTokens.get(executionId);
  if (!controller) return false;
  controller.abort(reason ?? "cancelled");
  return true;
}

function resolveSecrets(secretsRef: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, ref] of Object.entries(secretsRef)) {
    const envKey = ref.startsWith("secret://") ? ref.slice("secret://".length) : key;
    const value = process.env[envKey] ?? process.env[key];
    if (typeof value === "string") out[key] = value;
  }
  // Allow common provider keys when referenced by convention
  for (const key of [
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "GITHUB_TOKEN",
    "SLACK_BOT_TOKEN",
    "VAULT_TOKEN",
    "AS_DATABASE_URL",
    "AS_REDIS_URL",
  ]) {
    if (process.env[key]) out[key] = process.env[key]!;
  }
  return out;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(toolCancelled("unknown"));
      return;
    }
    const t = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(toolCancelled("unknown"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function executeTool(
  pool: pg.Pool,
  request: ToolExecuteRequest,
  tenantId: string,
  opts?: { principals?: string[] },
): Promise<ToolExecuteResponse> {
  const startedAt = Date.now();
  const correlationId = request.correlationId ?? ulid();
  const mode = request.mode ?? "SYNC";
  const timeoutMs = request.timeoutMs ?? toolEngineConfig.defaultTimeoutMs;
  const maxAttempts = request.retry?.maxAttempts ?? 1;
  const backoffMs = request.retry?.backoffMs ?? 100;
  const maxBackoffMs = request.retry?.maxBackoffMs ?? 30_000;

  if (request.idempotencyKey) {
    const existing = await findIdempotentExecution(
      pool,
      tenantId,
      request.tool,
      request.idempotencyKey,
    );
    if (existing && existing.status === "SUCCEEDED") {
      return {
        executionId: existing.id,
        output: existing.output,
        tool: existing.tool_name,
        version: existing.version,
        capability: existing.capability ?? undefined,
        status: "SUCCEEDED",
        latencyMs: existing.latency_ms ?? 0,
        correlationId: existing.correlation_id ?? correlationId,
        tenantId,
        attempts: existing.attempts,
      };
    }
  }

  const card = await getToolCard(pool, tenantId, request.tool, request.version);
  if (!card || card.lifecycle !== "ACTIVE") {
    const err = new ToolSdkError(
      "TOOL_NOT_FOUND",
      `No active tool for tenant "${tenantId}": ${request.tool}`,
      404,
    );
    throw err;
  }

  if (card.tenantId !== tenantId) {
    throw new ToolSdkError("TENANT_MISMATCH", "Cross-tenant tool execution denied", 403);
  }

  const runtimeTool: Tool | undefined = getBuiltinHandler(card.name);
  if (!runtimeTool) {
    throw new ToolSdkError(
      "TOOL_NOT_EXECUTABLE",
      `Tool "${card.name}" is registered but has no executable handler in this runtime`,
      501,
    );
  }

  const requiredPerms =
    card.permissions.length > 0
      ? card.permissions
      : (card.capabilities.find((c) => c.name === (request.capability ?? card.name))
          ?.permissions ?? []);

  if (requiredPerms.length > 0) {
    const decision = await evaluatePermissions(pool, {
      toolId: card.id,
      tenantId,
      principals: opts?.principals ?? ["role:developer", "agent:*"],
      required: requiredPerms,
    });
    if (!decision.allowed) {
      throw new ToolSdkError(
        "TOOL_FORBIDDEN",
        `Missing permissions: ${decision.denied.join(", ")}`,
        403,
        { denied: decision.denied },
      );
    }
  }

  const config = await getConfiguration(pool, card.id, tenantId, card.version);
  const secrets = resolveSecrets(config.secretsRef);
  const configuration = { ...config.values, ...(request.configuration ?? {}) };

  const release = concurrency.tryAcquire(tenantId, card.name);
  const breaker = circuits.get(tenantId, card.name);
  breaker.assertClosed(card.name);

  const executionId = ulid();
  const controller = new AbortController();
  cancelTokens.set(executionId, controller);

  const timeout = setTimeout(() => controller.abort("timeout"), timeoutMs);

  await createExecution(pool, {
    id: executionId,
    tenantId,
    toolId: card.id,
    toolName: card.name,
    version: card.version,
    capability: request.capability,
    mode,
    agentName: request.agentName,
    correlationId,
    idempotencyKey: request.idempotencyKey,
    payload: request.input,
    timeoutMs,
  });

  let attempts = 0;
  let lastError: unknown;

  try {
    while (attempts < maxAttempts) {
      attempts += 1;
      if (controller.signal.aborted) {
        throw toolCancelled(card.name, String(controller.signal.reason ?? "cancelled"));
      }

      const ctx: ToolContext = {
        tenantId,
        projectId: request.projectId,
        correlationId,
        executionId,
        agentName: request.agentName,
        capability: request.capability ?? card.name,
        mode,
        timeoutMs,
        attempt: attempts,
        configuration,
        secrets,
        signal: controller.signal,
        log: {
          debug: (msg, fields) => log.debug(msg, { ...fields, tenantId, executionId }),
          info: (msg, fields) => log.info(msg, { ...fields, tenantId, executionId }),
          warn: (msg, fields) => log.warn(msg, { ...fields, tenantId, executionId }),
          error: (msg, fields) => log.error(msg, { ...fields, tenantId, executionId }),
        },
      };

      try {
        if (runtimeTool.validate) {
          const validation = await runtimeTool.validate(request.input, ctx);
          if (!validation.valid) {
            throw new ToolSdkError("TOOL_VALIDATION_FAILED", "Tool input validation failed", 400, {
              errors: validation.errors,
            });
          }
        }

        const result = await runtimeTool.execute(ctx, request.input);
        const latencyMs = Date.now() - startedAt;

        await completeExecution(pool, {
          id: executionId,
          tenantId,
          status: "SUCCEEDED",
          output: result.output,
          attempts,
          latencyMs,
        });
        await recordMetrics(pool, {
          toolId: card.id,
          tenantId,
          version: card.version,
          success: true,
          latencyMs,
        });
        await writeAudit(pool, {
          tenantId,
          toolId: card.id,
          toolName: card.name,
          action: "EXECUTE",
          actor: request.agentName,
          correlationId,
          executionId,
          result: "SUCCESS",
          details: { latencyMs, attempts, capability: ctx.capability },
        });
        await publishToolExecuted({
          executionId,
          toolId: card.id,
          tool: card.name,
          version: card.version,
          capability: ctx.capability,
          latencyMs,
          agentName: request.agentName,
          tenantId,
        });

        breaker.recordSuccess();

        return {
          executionId,
          output: result.output,
          tool: card.name,
          version: card.version,
          capability: ctx.capability,
          status: "SUCCEEDED",
          latencyMs,
          correlationId,
          tenantId,
          attempts,
        };
      } catch (err) {
        lastError = err;
        const retryable =
          attempts < maxAttempts &&
          !(err instanceof ToolSdkError && [400, 401, 403, 404, 422, 424].includes(err.statusCode));
        if (!retryable) break;
        const delay = Math.min(maxBackoffMs, backoffMs * 2 ** (attempts - 1));
        await sleep(delay, controller.signal);
      }
    }

    const latencyMs = Date.now() - startedAt;
    const code =
      lastError instanceof ToolSdkError
        ? lastError.code
        : controller.signal.aborted
          ? controller.signal.reason === "timeout"
            ? "TOOL_TIMEOUT"
            : "TOOL_CANCELLED"
          : "TOOL_EXECUTION_FAILED";
    const message =
      lastError instanceof Error
        ? lastError.message
        : controller.signal.reason === "timeout"
          ? toolTimeout(card.name, timeoutMs).message
          : "Tool execution failed";
    const statusCode =
      lastError instanceof ToolSdkError
        ? lastError.statusCode
        : code === "TOOL_TIMEOUT"
          ? 504
          : code === "TOOL_CANCELLED"
            ? 499
            : 500;

    const status = code === "TOOL_CANCELLED" ? "CANCELLED" : "FAILED";
    await completeExecution(pool, {
      id: executionId,
      tenantId,
      status,
      errorCode: code,
      errorMessage: message,
      attempts,
      latencyMs,
    });
    await recordMetrics(pool, {
      toolId: card.id,
      tenantId,
      version: card.version,
      success: false,
      cancelled: status === "CANCELLED",
      latencyMs,
    });
    await writeAudit(pool, {
      tenantId,
      toolId: card.id,
      toolName: card.name,
      action: "EXECUTE",
      actor: request.agentName,
      correlationId,
      executionId,
      result: status === "CANCELLED" ? "FAILURE" : "FAILURE",
      details: { code, message, attempts },
    });
    await publishToolFailed({
      executionId,
      toolId: card.id,
      tool: card.name,
      version: card.version,
      code,
      message,
      latencyMs,
      attempts,
      tenantId,
    });
    breaker.recordFailure();

    const err = new ToolSdkError(code, message, statusCode);
    throw err;
  } finally {
    clearTimeout(timeout);
    cancelTokens.delete(executionId);
    release();
  }
}

export async function probeToolHealth(
  pool: pg.Pool,
  card: ToolCard,
  tool: Tool,
): Promise<void> {
  const config = await getConfiguration(pool, card.id, card.tenantId, card.version);
  const started = Date.now();
  try {
    const health = await tool.health({
      tenantId: card.tenantId,
      configuration: config.values,
      secrets: resolveSecrets(config.secretsRef),
      signal: AbortSignal.timeout(5_000),
      log,
    });
    await import("../db/ops.js").then((m) =>
      m.upsertHealth(pool, card.id, card.tenantId, card.version, {
        ...health,
        latencyMs: health.latencyMs ?? Date.now() - started,
      }),
    );
  } catch (err) {
    await import("../db/ops.js").then((m) =>
      m.upsertHealth(pool, card.id, card.tenantId, card.version, {
        status: "UNHEALTHY",
        checkedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
