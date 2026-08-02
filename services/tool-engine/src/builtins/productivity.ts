import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";
function productivityTool(name: string, description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "PRODUCTIVITY" as const, builtin: true, inputSchema, tags: ["builtin", "productivity"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}
export const productivityTools: Tool[] = [
  productivityTool("email.send", "Send email through a configured HTTP email provider.", { type: "object", properties: { from: { type: "string" }, to: { type: "array" }, subject: { type: "string" }, text: { type: "string" }, html: { type: "string" } }, required: ["from", "to", "subject"] }, async (ctx, input) => {
    const providerUrl = configString(ctx, "providerUrl"), apiKey = secret(ctx, "emailApiKey"); if (!providerUrl || !apiKey) throw toolNotConfigured("email.send", ["providerUrl", "emailApiKey"]);
    return (await request(providerUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, body: JSON.stringify(input) }, ctx.signal)).body;
  }),
  productivityTool("slack.post", "Post a message with Slack chat.postMessage.", { type: "object", properties: { channel: { type: "string" }, text: { type: "string" }, blocks: { type: "array" } }, required: ["channel", "text"] }, async (ctx, input) => {
    const token = secret(ctx, "slackToken"); if (!token) throw toolNotConfigured("slack.post", ["slackToken"]);
    return (await request("https://slack.com/api/chat.postMessage", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(input) }, ctx.signal)).body;
  }),
  productivityTool("teams.message", "Send a message through a Microsoft Teams incoming webhook.", { type: "object", properties: { text: { type: "string" }, title: { type: "string" } }, required: ["text"] }, async (ctx, input) => {
    const webhookUrl = configString(ctx, "teamsWebhookUrl") ?? secret(ctx, "teamsWebhookUrl"); if (!webhookUrl) throw toolNotConfigured("teams.message", ["teamsWebhookUrl"]);
    return (await request(webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) }, ctx.signal)).body;
  }),
];
