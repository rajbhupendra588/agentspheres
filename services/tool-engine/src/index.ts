import Fastify from "fastify";
import {
  PORTS,
  ToolDefinitionSchema,
  ToolExecuteRequestSchema,
  ToolExecuteResponseSchema,
  type ToolDefinition,
} from "@agentsphere/contracts";
import { createLogger, healthRoutes, optional, toErrorBody } from "@agentsphere/common";

const log = createLogger("tool-engine");
const port = Number(optional("PORT", String(PORTS.toolEngine)));

type ToolHandler = (input: unknown) => Promise<unknown>;

const definitions = new Map<string, ToolDefinition>();
const handlers = new Map<string, ToolHandler>();

function seedTool(definition: ToolDefinition, handler: ToolHandler): void {
  definitions.set(definition.name, definition);
  handlers.set(definition.name, handler);
}

seedTool(
  {
    name: "echo",
    description: "Returns the tool input unchanged",
    version: "1.0.0",
    inputSchema: { type: "object" },
    outputSchema: { type: "object" },
    tags: ["builtin"],
  },
  async (input) => input,
);

seedTool(
  {
    name: "web.search",
    description: "Mock web search returning sample results",
    version: "1.0.0",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              url: { type: "string" },
              snippet: { type: "string" },
            },
          },
        },
      },
    },
    tags: ["builtin", "web"],
  },
  async (input) => {
    const query =
      typeof input === "object" && input !== null && "query" in input
        ? String((input as { query: unknown }).query)
        : String(input);

    return {
      results: [
        {
          title: `Result for: ${query}`,
          url: `https://example.com/search?q=${encodeURIComponent(query)}`,
          snippet: `Mock search result for "${query}"`,
        },
        {
          title: `More about ${query}`,
          url: `https://example.org/q/${encodeURIComponent(query)}`,
          snippet: `Additional mock snippet for "${query}"`,
        },
      ],
    };
  },
);

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.post("/v1/tools", async (request, reply) => {
  try {
    const definition = ToolDefinitionSchema.parse(request.body);
    definitions.set(definition.name, definition);
    log.info("tool registered", { tool: definition.name });
    return { tool: definition, status: "REGISTERED" };
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

app.get("/v1/tools", async () => ({
  tools: [...definitions.values()].sort((a, b) => a.name.localeCompare(b.name)),
  count: definitions.size,
}));

app.post("/v1/execute", async (request, reply) => {
  const startedAt = Date.now();

  try {
    const parsed = ToolExecuteRequestSchema.parse(request.body);
    const handler = handlers.get(parsed.tool);

    if (!handler) {
      reply.status(404);
      return {
        error: {
          code: "TOOL_NOT_FOUND",
          message: `No executable handler for tool: ${parsed.tool}`,
        },
      };
    }

    const output = await handler(parsed.input);

    return ToolExecuteResponseSchema.parse({
      output,
      tool: parsed.tool,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

async function main(): Promise<void> {
  await app.listen({ port, host: "0.0.0.0" });
  log.info("tool-engine listening", { port, tools: definitions.size });
}

main().catch((err) => {
  log.error("tool-engine failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
