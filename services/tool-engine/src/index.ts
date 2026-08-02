import Fastify from "fastify";
import {
  DEFAULT_TENANT_ID,
  PORTS,
  ToolDefinitionSchema,
  ToolExecuteRequestSchema,
  ToolExecuteResponseSchema,
} from "@agentsphere/contracts";
import {
  createLogger,
  createPgPool,
  healthRoutes,
  optional,
  required,
  resolveTenantId,
  toErrorBody,
} from "@agentsphere/common";
import { z } from "zod";
import { BUILTIN_TOOLS } from "./builtins.js";
import {
  deprecateTool,
  getTool,
  initToolSchema,
  listTools,
  upsertTool,
} from "./db.js";
import {
  closeToolEvents,
  initToolEvents,
  publishToolRegistered,
} from "./events.js";

const log = createLogger("tool-engine");
const port = Number(optional("PORT", String(PORTS.toolEngine)));
const pool = createPgPool(required("AS_DATABASE_URL"));

type ToolHandler = (input: unknown) => Promise<unknown>;
const handlers = new Map<string, ToolHandler>();

for (const builtin of BUILTIN_TOOLS) {
  handlers.set(builtin.definition.name, builtin.handler);
}

const DeprecateSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1).default("1.0.0"),
});

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.setErrorHandler((err, _request, reply) => {
  const { statusCode, body } = toErrorBody(err);
  reply.status(statusCode).send(body);
});

app.post("/v1/tools", async (request, reply) => {
  const definition = ToolDefinitionSchema.parse(request.body);
  const tenantId = resolveTenantId(request.headers, definition.tenantId);

  if (definition.tenantId && definition.tenantId !== tenantId) {
    reply.status(403);
    return {
      error: {
        code: "TENANT_MISMATCH",
        message: `Tool tenantId (${definition.tenantId}) does not match request tenant (${tenantId})`,
      },
    };
  }

  const result = await upsertTool(pool, {
    tenantId,
    definition,
    builtin: false,
  });

  await publishToolRegistered(result.definition, tenantId);
  log.info("tool registered", {
    tool: result.definition.name,
    version: result.definition.version,
    tenantId,
    status: result.status,
    rowVersion: result.rowVersion,
  });

  reply.status(result.status === "REGISTERED" ? 201 : 200);
  return {
    tool: result.definition,
    status: result.status,
    rowVersion: result.rowVersion,
  };
});

app.get("/v1/tools", async (request) => {
  const tenantId = resolveTenantId(request.headers);
  const includeDeprecated =
    (request.query as { includeDeprecated?: string }).includeDeprecated === "true";
  const tools = await listTools(pool, tenantId, { includeDeprecated });
  return {
    tools,
    count: tools.length,
    tenantId,
  };
});

app.post("/v1/tools/deprecate", async (request, reply) => {
  const body = DeprecateSchema.parse(request.body);
  const tenantId = resolveTenantId(request.headers);
  const ok = await deprecateTool(pool, tenantId, body.name, body.version);
  if (!ok) {
    reply.status(404);
    return {
      error: {
        code: "TOOL_NOT_FOUND",
        message: `Active tool not found: ${body.name}@${body.version}`,
      },
    };
  }
  return { ok: true, name: body.name, version: body.version, status: "DEPRECATED" };
});

app.post("/v1/execute", async (request, reply) => {
  const startedAt = Date.now();
  const parsed = ToolExecuteRequestSchema.parse(request.body);
  const tenantId = resolveTenantId(request.headers, parsed.tenantId);

  const row = await getTool(pool, tenantId, parsed.tool, parsed.version);
  if (!row) {
    reply.status(404);
    return {
      error: {
        code: "TOOL_NOT_FOUND",
        message: `No active tool for tenant "${tenantId}": ${parsed.tool}`,
      },
    };
  }

  const handler = handlers.get(parsed.tool);
  if (!handler) {
    reply.status(501);
    return {
      error: {
        code: "TOOL_NOT_EXECUTABLE",
        message: `Tool "${parsed.tool}" is registered but has no executable handler in this runtime`,
      },
    };
  }

  const output = await handler(parsed.input);

  return ToolExecuteResponseSchema.parse({
    output,
    tool: parsed.tool,
    latencyMs: Date.now() - startedAt,
  });
});

async function seedBuiltins(): Promise<void> {
  for (const builtin of BUILTIN_TOOLS) {
    const result = await upsertTool(pool, {
      tenantId: DEFAULT_TENANT_ID,
      definition: builtin.definition,
      builtin: true,
    });
    await publishToolRegistered(result.definition, DEFAULT_TENANT_ID);
  }
}

async function main(): Promise<void> {
  await initToolSchema(pool);
  await initToolEvents();
  await seedBuiltins();
  await app.listen({ port, host: "0.0.0.0" });
  const tools = await listTools(pool, DEFAULT_TENANT_ID);
  log.info("tool-engine listening", { port, tools: tools.length });
}

main().catch((err) => {
  log.error("tool-engine failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  log.info("received shutdown signal", { signal });
  await app.close();
  await closeToolEvents();
  await pool.end();
  process.exit(0);
}
