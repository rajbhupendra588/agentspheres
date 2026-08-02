import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import {
  ToolCancelRequestSchema,
  ToolConfigurationUpsertSchema,
  ToolDefinitionSchema,
  ToolDiscoverQuerySchema,
  ToolExecuteRequestSchema,
  ToolPermissionGrantSchema,
  ToolUpdateRequestSchema,
  ToolValidateRequestSchema,
} from "@agentsphere/contracts";
import { resolveTenantId, ulid } from "@agentsphere/common";
import { defaultValidateJsonSchema, ToolSdkError } from "@agentsphere/tool-sdk";
import { getBuiltinHandler } from "./builtins/index.js";
import {
  deleteToolCard,
  deprecateToolCard,
  discoverTools,
  getToolCard,
  grantPermission,
  listAudit,
  listExecutions,
  listHealth,
  listMetrics,
  listPermissions,
  listToolCards,
  upsertConfiguration,
  upsertToolCard,
  writeAudit,
} from "./db/index.js";
import {
  publishToolConfigured,
  publishToolDeleted,
  publishToolDeprecated,
  publishToolRegistered,
  publishToolUpdated,
} from "./events.js";
import { cancelExecution } from "./db/executions.js";
import { executeTool, getConcurrencySnapshot, requestCancel } from "./runtime/executor.js";
import { ensureBuiltinsForTenant } from "./seed.js";

const DeprecateSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).default("1.0.0"),
});

function actorFromHeaders(headers: Record<string, unknown>): string | undefined {
  const sub = headers["x-actor"] ?? headers["x-agent-name"];
  return typeof sub === "string" ? sub : undefined;
}

export function registerToolRoutes(app: FastifyInstance, pool: pg.Pool): void {
  app.post("/v1/tools", async (request, reply) => {
    const definition = ToolDefinitionSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers, definition.tenantId);
    if (definition.tenantId && definition.tenantId !== tenantId) {
      throw new ToolSdkError("TENANT_MISMATCH", "Tool tenantId does not match request tenant", 403);
    }

    const result = await upsertToolCard(pool, { tenantId, definition, builtin: false });
    if (result.status === "REGISTERED") {
      await publishToolRegistered(result.card, tenantId);
    } else {
      await publishToolUpdated(result.card, tenantId);
    }
    await writeAudit(pool, {
      tenantId,
      toolId: result.card.id,
      toolName: result.card.name,
      action: result.status === "REGISTERED" ? "REGISTER" : "UPDATE",
      actor: actorFromHeaders(request.headers as Record<string, unknown>),
      result: "SUCCESS",
    });

    reply.status(result.status === "REGISTERED" ? 201 : 200);
    return {
      tool: result.card,
      status: result.status,
      rowVersion: result.rowVersion,
    };
  });

  app.put("/v1/tools/:id", async (request) => {
    const { id } = request.params as { id: string };
    const body = ToolUpdateRequestSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers, body.tenantId);
    const existing = await getToolCard(pool, tenantId, id);
    if (!existing) {
      throw new ToolSdkError("TOOL_NOT_FOUND", `Tool not found: ${id}`, 404);
    }
    const result = await upsertToolCard(pool, {
      tenantId,
      expectedRowVersion: body.expectedRowVersion,
      definition: {
        name: existing.name,
        description: body.description ?? existing.description,
        version: body.version ?? existing.version,
        inputSchema: body.inputSchema ?? existing.inputSchema ?? { type: "object" },
        outputSchema: body.outputSchema ?? existing.outputSchema,
        tags: body.tags ?? existing.tags,
        owner: body.owner ?? existing.owner,
        category: body.category ?? existing.category,
        capabilities: body.capabilities ?? existing.capabilities,
        authentication: body.authentication ?? existing.authentication,
        permissions: body.permissions ?? existing.permissions,
        configuration: body.configuration ?? existing.configuration,
        supportedProtocols: body.supportedProtocols ?? existing.supportedProtocols,
        dependencies: body.dependencies ?? existing.dependencies,
        rateLimits: body.rateLimits ?? existing.rateLimits,
        cost: body.cost ?? existing.cost,
        documentation: body.documentation ?? existing.documentation,
        regions: body.regions ?? existing.regions,
        endpoint: body.endpoint ?? existing.endpoint,
        lifecycle: body.lifecycle ?? existing.lifecycle,
        builtin: existing.builtin,
        id: existing.id,
      },
    });
    await publishToolUpdated(result.card, tenantId);
    return { tool: result.card, status: result.status, rowVersion: result.rowVersion };
  });

  app.delete("/v1/tools/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = resolveTenantId(request.headers);
    const deleted = await deleteToolCard(pool, tenantId, id);
    if (!deleted) {
      reply.status(404);
      return { error: { code: "TOOL_NOT_FOUND", message: `Tool not found: ${id}` } };
    }
    await publishToolDeleted(deleted, tenantId);
    await writeAudit(pool, {
      tenantId,
      toolId: deleted.id,
      toolName: deleted.name,
      action: "DELETE",
      actor: actorFromHeaders(request.headers as Record<string, unknown>),
      result: "SUCCESS",
    });
    return { ok: true, tool: deleted };
  });

  app.get("/v1/tools", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    await ensureBuiltinsForTenant(pool, tenantId);
    const includeDeprecated =
      (request.query as { includeDeprecated?: string }).includeDeprecated === "true";
    const tools = await listToolCards(pool, tenantId, { includeDeprecated });
    return { tools, count: tools.length, tenantId };
  });

  app.get("/v1/tools/discover", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    await ensureBuiltinsForTenant(pool, tenantId);
    const raw = request.query as Record<string, string | undefined>;
    const query = ToolDiscoverQuerySchema.parse({
      capability: raw.capability,
      category: raw.category,
      tags: raw.tags ? raw.tags.split(",").filter(Boolean) : undefined,
      region: raw.region,
      owner: raw.owner,
      version: raw.version,
      health: raw.health,
      permissions: raw.permissions ? raw.permissions.split(",").filter(Boolean) : undefined,
      maxLatencyMs: raw.maxLatencyMs ? Number(raw.maxLatencyMs) : undefined,
      includeDeprecated: raw.includeDeprecated === "true",
      limit: raw.limit ? Number(raw.limit) : undefined,
      offset: raw.offset ? Number(raw.offset) : undefined,
      tenantId,
    });
    const { tools, total } = await discoverTools(pool, tenantId, query);
    return {
      tools,
      count: tools.length,
      total,
      tenantId,
      resolvedAt: new Date().toISOString(),
    };
  });

  app.get("/v1/tools/health", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    const tools = await listHealth(pool, tenantId);
    return {
      tools: tools.map((t) => ({
        id: t.toolId,
        name: t.name,
        version: t.version,
        health: t.health,
      })),
      tenantId,
      checkedAt: new Date().toISOString(),
    };
  });

  app.get("/v1/tools/metrics", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    const tools = await listMetrics(pool, tenantId);
    return {
      tools: tools.map((t) => ({
        id: t.toolId,
        name: t.name,
        version: t.version,
        metrics: t.metrics,
      })),
      tenantId,
    };
  });

  app.get("/v1/tools/audit", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    const toolId = (request.query as { toolId?: string }).toolId;
    const records = await listAudit(pool, tenantId, { toolId });
    return { records, count: records.length, tenantId };
  });

  app.get("/v1/tools/executions", async (request) => {
    const tenantId = resolveTenantId(request.headers);
    const toolName = (request.query as { tool?: string }).tool;
    const rows = await listExecutions(pool, tenantId, { toolName });
    return {
      executions: rows.map((r) => ({
        id: r.id,
        tool: r.tool_name,
        version: r.version,
        status: r.status,
        latencyMs: r.latency_ms,
        correlationId: r.correlation_id,
        startedAt: r.started_at.toISOString(),
        finishedAt: r.finished_at?.toISOString(),
        attempts: r.attempts,
      })),
      count: rows.length,
      tenantId,
      concurrency: getConcurrencySnapshot(),
    };
  });

  app.post("/v1/tools/deprecate", async (request, reply) => {
    const body = DeprecateSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers);
    const card = await deprecateToolCard(pool, tenantId, body.name, body.version);
    if (!card) {
      reply.status(404);
      return {
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Active tool not found: ${body.name}@${body.version}`,
        },
      };
    }
    await publishToolDeprecated(card, tenantId);
    return { ok: true, name: body.name, version: body.version, status: "DEPRECATED", tool: card };
  });

  app.post("/v1/tools/validate", async (request) => {
    const body = ToolValidateRequestSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers);
    const errors: Array<{ path: string; code: string; message: string }> = [];
    const warnings: Array<{ path: string; code: string; message: string }> = [];

    let schema: Record<string, unknown> | undefined = body.tool?.inputSchema;
    let toolName = body.tool?.name ?? body.name;

    if (body.toolId || body.name) {
      const card = await getToolCard(pool, tenantId, body.toolId ?? body.name!, body.version);
      if (!card) {
        errors.push({ path: "tool", code: "TOOL_NOT_FOUND", message: "Tool not found" });
      } else {
        schema = card.inputSchema;
        toolName = card.name;
        if (card.lifecycle === "DEPRECATED") {
          warnings.push({
            path: "lifecycle",
            code: "DEPRECATED",
            message: `Tool ${card.name}@${card.version} is deprecated`,
          });
        }
      }
    }

    if (body.tool) {
      if (!body.tool.name) {
        errors.push({ path: "name", code: "REQUIRED", message: "name is required" });
      }
      if (!body.tool.inputSchema) {
        errors.push({ path: "inputSchema", code: "REQUIRED", message: "inputSchema is required" });
      }
    }

    if (body.input !== undefined && schema) {
      const inputValidation = await defaultValidateJsonSchema(schema, body.input);
      errors.push(...inputValidation.errors);
    }

    if (toolName) {
      const runtime = getBuiltinHandler(toolName);
      if (!runtime) {
        warnings.push({
          path: "runtime",
          code: "NO_LOCAL_HANDLER",
          message: "Tool has no in-process handler in this runtime",
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  });

  app.post("/v1/tools/execute", async (request) => executeRoute(pool, request));
  app.post("/v1/execute", async (request) => executeRoute(pool, request));

  app.post("/v1/tools/cancel", async (request, reply) => {
    const body = ToolCancelRequestSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers);
    const inFlight = requestCancel(body.executionId, body.reason);
    const persisted = await cancelExecution(pool, tenantId, body.executionId, body.reason);
    if (!inFlight && !persisted) {
      reply.status(404);
      return {
        error: {
          code: "EXECUTION_NOT_FOUND",
          message: `Cancelable execution not found: ${body.executionId}`,
        },
      };
    }
    return { ok: true, executionId: body.executionId, status: "CANCELLED" };
  });

  app.get("/v1/tools/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = resolveTenantId(request.headers);
    const tool = await getToolCard(pool, tenantId, id);
    if (!tool) {
      reply.status(404);
      return { error: { code: "TOOL_NOT_FOUND", message: `Tool not found: ${id}` } };
    }
    return { tool };
  });

  app.put("/v1/tools/:id/configuration", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = resolveTenantId(request.headers);
    const body = ToolConfigurationUpsertSchema.parse(request.body);
    const card = await getToolCard(pool, tenantId, id);
    if (!card) {
      reply.status(404);
      return { error: { code: "TOOL_NOT_FOUND", message: `Tool not found: ${id}` } };
    }
    const result = await upsertConfiguration(pool, {
      toolId: card.id,
      tenantId,
      version: card.version,
      body,
    });
    await publishToolConfigured(card, tenantId, [
      ...Object.keys(body.values),
      ...result.secretKeys,
    ]);
    return {
      toolId: card.id,
      values: result.values,
      secretKeys: result.secretKeys,
      rowVersion: result.rowVersion,
    };
  });

  app.post("/v1/tools/:id/permissions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = resolveTenantId(request.headers);
    const grant = ToolPermissionGrantSchema.parse(request.body);
    const card = await getToolCard(pool, tenantId, id);
    if (!card) {
      reply.status(404);
      return { error: { code: "TOOL_NOT_FOUND", message: `Tool not found: ${id}` } };
    }
    await grantPermission(pool, card.id, tenantId, grant);
    return { ok: true, toolId: card.id, grant };
  });

  app.get("/v1/tools/:id/permissions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const tenantId = resolveTenantId(request.headers);
    const card = await getToolCard(pool, tenantId, id);
    if (!card) {
      reply.status(404);
      return { error: { code: "TOOL_NOT_FOUND", message: `Tool not found: ${id}` } };
    }
    const permissions = await listPermissions(pool, card.id, tenantId);
    return { toolId: card.id, permissions };
  });

}

async function executeRoute(pool: pg.Pool, request: { body: unknown; headers: unknown }) {
  const parsed = ToolExecuteRequestSchema.parse(request.body);
  const tenantId = resolveTenantId(
    request.headers as Record<string, string | string[] | undefined>,
    parsed.tenantId,
  );
  if (parsed.tenantId && parsed.tenantId !== tenantId) {
    throw new ToolSdkError("TENANT_MISMATCH", "Execution tenantId does not match request tenant", 403);
  }
  return executeTool(pool, { ...parsed, correlationId: parsed.correlationId ?? ulid() }, tenantId);
}
