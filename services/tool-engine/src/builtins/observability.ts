import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";
function obsTool(name: string, category: "OBSERVABILITY" | "MONITORING" | "SECURITY", description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category, builtin: true, inputSchema, tags: ["builtin", "observability"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}
function configured(ctx: Parameters<Tool["execute"]>[0], tool: string, key: string): string { const value = configString(ctx, key); if (!value) throw toolNotConfigured(tool, [key]); return value.replace(/\/$/, ""); }
export const observabilityTools: Tool[] = [
  obsTool("vault.kv", "SECURITY", "Read or write a HashiCorp Vault KV v2 secret.", { type: "object", properties: { operation: { type: "string" }, path: { type: "string" }, data: { type: "object" } }, required: ["operation", "path"] }, async (ctx, input) => {
    const url = configured(ctx, "vault.kv", "vaultUrl"), token = secret(ctx, "vaultToken"); if (!token) throw toolNotConfigured("vault.kv", ["vaultToken"]);
    const operation = String(input.operation); if (!["read", "write"].includes(operation)) throw new Error("Vault operation must be read or write");
    return (await request(`${url}/v1/${String(input.path).replace(/^\/+/, "")}`, { method: operation === "read" ? "GET" : "POST", headers: { "x-vault-token": token, ...(operation === "write" ? { "content-type": "application/json" } : {}) }, body: operation === "write" ? JSON.stringify({ data: input.data ?? {} }) : undefined }, ctx.signal)).body;
  }),
  obsTool("prometheus.query", "MONITORING", "Run an instant PromQL query.", { type: "object", properties: { query: { type: "string" }, time: { type: "string" } }, required: ["query"] }, async (ctx, input) => (await request(`${configured(ctx, "prometheus.query", "prometheusUrl")}/api/v1/query?query=${encodeURIComponent(String(input.query))}${input.time ? `&time=${encodeURIComponent(String(input.time))}` : ""}`, { method: "GET" }, ctx.signal)).body),
  obsTool("grafana.proxy", "OBSERVABILITY", "Proxy an authenticated request to Grafana HTTP API.", { type: "object", properties: { path: { type: "string" }, method: { type: "string" }, body: {} }, required: ["path"] }, async (ctx, input) => {
    const token = secret(ctx, "grafanaToken"); if (!token) throw toolNotConfigured("grafana.proxy", ["grafanaToken"]);
    const path = String(input.path); if (!path.startsWith("/")) throw new Error("Grafana path must start with /");
    return request(`${configured(ctx, "grafana.proxy", "grafanaUrl")}${path}`, { method: String(input.method ?? "GET"), headers: { authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "content-type": "application/json" }) }, body: input.body === undefined ? undefined : JSON.stringify(input.body) }, ctx.signal);
  }),
  obsTool("loki.query", "OBSERVABILITY", "Query Loki logs over a time range.", { type: "object", properties: { query: { type: "string" }, start: { type: "string" }, end: { type: "string" }, limit: { type: "number" } }, required: ["query", "start", "end"] }, async (ctx, input) => (await request(`${configured(ctx, "loki.query", "lokiUrl")}/loki/api/v1/query_range?query=${encodeURIComponent(String(input.query))}&start=${encodeURIComponent(String(input.start))}&end=${encodeURIComponent(String(input.end))}${input.limit ? `&limit=${input.limit}` : ""}`, { method: "GET" }, ctx.signal)).body),
  obsTool("tempo.trace", "OBSERVABILITY", "Retrieve a Tempo trace by trace ID.", { type: "object", properties: { traceId: { type: "string" } }, required: ["traceId"] }, async (ctx, input) => (await request(`${configured(ctx, "tempo.trace", "tempoUrl")}/api/traces/${encodeURIComponent(String(input.traceId))}`, { method: "GET" }, ctx.signal)).body),
];
