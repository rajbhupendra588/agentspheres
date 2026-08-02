import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";

function messagingTool(name: string, description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "MESSAGING" as const, builtin: true, inputSchema, tags: ["builtin", "messaging"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}

export const messagingTools: Tool[] = [
  messagingTool("kafka.publish", "Publish records through a Kafka REST Proxy.", {
    type: "object", properties: { topic: { type: "string" }, records: { type: "array" } }, required: ["topic", "records"],
  }, async (ctx, input) => {
    const url = configString(ctx, "restProxyUrl");
    if (!url) throw toolNotConfigured("kafka.publish", ["restProxyUrl"]);
    const response = await request(`${url.replace(/\/$/, "")}/topics/${encodeURIComponent(String(input.topic))}`, {
      method: "POST", headers: { "content-type": "application/vnd.kafka.json.v2+json", ...(secret(ctx, "kafkaRestProxyToken") ? { authorization: `Bearer ${secret(ctx, "kafkaRestProxyToken")}` } : {}) },
      body: JSON.stringify({ records: input.records }),
    }, ctx.signal);
    return response.body;
  }),
  messagingTool("rabbitmq.publish", "Publish a message through RabbitMQ Management HTTP API.", {
    type: "object", properties: { vhost: { type: "string" }, exchange: { type: "string" }, routingKey: { type: "string" }, payload: {} }, required: ["exchange", "routingKey", "payload"],
  }, async (ctx, input) => {
    const url = configString(ctx, "rabbitmqManagementUrl");
    const username = configString(ctx, "rabbitmqUsername") ?? secret(ctx, "rabbitmqUsername");
    const password = secret(ctx, "rabbitmqPassword");
    if (!url || !username || !password) throw toolNotConfigured("rabbitmq.publish", ["rabbitmqManagementUrl", "rabbitmqUsername", "rabbitmqPassword"]);
    const vhost = encodeURIComponent(String(input.vhost ?? "/"));
    const exchange = encodeURIComponent(String(input.exchange));
    return (await request(`${url.replace(/\/$/, "")}/api/exchanges/${vhost}/${exchange}/publish`, {
      method: "POST", headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
      body: JSON.stringify({ routing_key: input.routingKey, payload: typeof input.payload === "string" ? input.payload : JSON.stringify(input.payload), payload_encoding: "string", properties: input.properties ?? {} }),
    }, ctx.signal)).body;
  }),
];
