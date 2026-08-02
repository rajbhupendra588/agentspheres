import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";

function aiTool(name: string, description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "AI_MODELS" as const, builtin: true, inputSchema, tags: ["builtin", "ai"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}
const chatSchema = { type: "object", properties: { model: { type: "string" }, messages: { type: "array" }, options: { type: "object" } }, required: ["model", "messages"] };
export const aiTools: Tool[] = [
  aiTool("openai.chat", "Create a chat completion through OpenAI.", chatSchema, async (ctx, input) => {
    const key = secret(ctx, "openaiApiKey"); if (!key) throw toolNotConfigured("openai.chat", ["openaiApiKey"]);
    return (await request("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: input.model, messages: input.messages, ...(input.options as object ?? {}) }) }, ctx.signal)).body;
  }),
  aiTool("anthropic.messages", "Create a message through Anthropic.", chatSchema, async (ctx, input) => {
    const key = secret(ctx, "anthropicApiKey"); if (!key) throw toolNotConfigured("anthropic.messages", ["anthropicApiKey"]);
    return (await request("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: input.model, messages: input.messages, max_tokens: (input.options as Input | undefined)?.max_tokens ?? 1024, ...(input.options as object ?? {}) }) }, ctx.signal)).body;
  }),
  aiTool("gemini.generate", "Generate content through Google Gemini.", { type: "object", properties: { model: { type: "string" }, contents: { type: "array" }, generationConfig: { type: "object" } }, required: ["model", "contents"] }, async (ctx, input) => {
    const key = secret(ctx, "geminiApiKey"); if (!key) throw toolNotConfigured("gemini.generate", ["geminiApiKey"]);
    return (await request(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(String(input.model))}:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contents: input.contents, generationConfig: input.generationConfig }) }, ctx.signal)).body;
  }),
  aiTool("ollama.chat", "Create a chat response through a configured Ollama server.", chatSchema, async (ctx, input) => {
    const baseUrl = configString(ctx, "ollamaBaseUrl"); if (!baseUrl) throw toolNotConfigured("ollama.chat", ["ollamaBaseUrl"]);
    return (await request(`${baseUrl.replace(/\/$/, "")}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: input.model, messages: input.messages, stream: false, ...(input.options as object ?? {}) }) }, ctx.signal)).body;
  }),
  aiTool("openrouter.chat", "Create a chat completion through OpenRouter.", chatSchema, async (ctx, input) => {
    const key = secret(ctx, "openrouterApiKey"); if (!key) throw toolNotConfigured("openrouter.chat", ["openrouterApiKey"]);
    return (await request("https://openrouter.ai/api/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify({ model: input.model, messages: input.messages, ...(input.options as object ?? {}) }) }, ctx.signal)).body;
  }),
];
