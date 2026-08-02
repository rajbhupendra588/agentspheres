import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, executionRecord, request, type Input } from "./_shared.js";

const schema = (required: string[] = []) => ({
  type: "object",
  properties: {
    service: { type: "string" }, capability: { type: "string" }, agent: { type: "object" },
    toolName: { type: "string" }, key: { type: "string" }, rules: { type: "array" },
    principal: { type: "object" }, event: { type: "object" }, counters: { type: "object" },
    url: { type: "string" },
  },
  required,
});

function meshTool(
  name: string,
  description: string,
  inputSchema: Record<string, unknown>,
  execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>,
): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "CORE_MESH" as const, builtin: true, inputSchema, tags: ["builtin", "mesh"] };
  return defineTool({
    metadata,
    validate: (input) => defaultValidateJsonSchema(inputSchema, input),
    execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }),
  });
}

function serviceUrl(ctx: Parameters<Tool["execute"]>[0], service: string): string {
  const key = `AS_${service.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;
  const url = configString(ctx, key) ?? configString(ctx, "serviceUrl");
  if (!url) throw toolNotConfigured(`mesh.${service}`, [key]);
  return url.replace(/\/$/, "");
}

export const coreMeshTools: Tool[] = [
  meshTool("mesh.agent.registry", "List registered agents from the AgentSphere registry.", schema(), async (ctx) =>
    (await request(`${serviceUrl(ctx, "registry")}/v1/agents`, { method: "GET" }, ctx.signal)).body),
  meshTool("mesh.discovery", "Discover AgentSphere capabilities.", schema(["capability"]), async (ctx, input) =>
    (await request(`${serviceUrl(ctx, "discovery")}/v1/discover?capability=${encodeURIComponent(String(input.capability))}`, { method: "GET" }, ctx.signal)).body),
  meshTool("mesh.heartbeat", "Send an agent heartbeat to the registry.", schema(["agent"]), async (ctx, input) =>
    (await request(`${serviceUrl(ctx, "registry")}/v1/heartbeat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input.agent) }, ctx.signal)).body),
  meshTool("mesh.health", "Probe an AgentSphere service health endpoint.", schema(["url"]), async (ctx, input) =>
    request(`${String(input.url).replace(/\/$/, "")}/healthz`, { method: "GET" }, ctx.signal)),
  meshTool("mesh.configuration", "Return non-secret runtime configuration for a named tool.", schema(["toolName"]), async (ctx, input) => {
    const prefix = `${String(input.toolName)}.`;
    return Object.fromEntries(Object.entries(ctx.configuration).filter(([key]) => key === input.toolName || key.startsWith(prefix)));
  }),
  meshTool("mesh.secrets", "Resolve whether a runtime secret key is available without exposing its value.", schema(["key"]), async (ctx, input) => {
    const key = String(input.key);
    if (!ctx.secrets[key]) throw toolNotConfigured("mesh.secrets", [key]);
    return { key, resolved: true };
  }),
  meshTool("mesh.policy", "Evaluate ordered allow and deny policy rules for a principal.", schema(["rules", "principal"]), async (_ctx, input) => {
    const principal = input.principal as Record<string, unknown>;
    const rules = input.rules as Array<Record<string, unknown>>;
    const matched = rules.find((rule) => Object.entries((rule.match ?? {}) as Record<string, unknown>).every(([key, value]) => principal[key] === value));
    return { allowed: matched?.effect === "allow", matchedRule: matched ?? null };
  }),
  meshTool("mesh.audit", "Create a structured audit record for runtime persistence.", schema(["event"]), async (ctx, input) => ({
    ...executionRecord(ctx), event: input.event, recordedAt: new Date().toISOString(),
  })),
  meshTool("mesh.metrics", "Return an execution-scoped metrics snapshot.", schema(["counters"]), async (ctx, input) => ({
    ...executionRecord(ctx), counters: input.counters, capturedAt: new Date().toISOString(),
  })),
  meshTool("mesh.tracing", "Create trace correlation context for downstream operations.", schema(), async (ctx) => ({
    ...executionRecord(ctx), traceId: ctx.correlationId, spanId: ctx.executionId, createdAt: new Date().toISOString(),
  })),
];
