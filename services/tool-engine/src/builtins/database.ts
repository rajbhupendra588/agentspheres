import { Pool } from "pg";
import { Redis } from "ioredis";
import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";

function databaseTool(name: string, description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "DATABASE" as const, builtin: true, inputSchema, tags: ["builtin", "database"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}

export const databaseTools: Tool[] = [
  databaseTool("postgres.query", "Execute a parameterized PostgreSQL query.", {
    type: "object", properties: { query: { type: "string" }, values: { type: "array" } }, required: ["query"],
  }, async (ctx, input) => {
    const connectionString = configString(ctx, "connectionString") ?? secret(ctx, "postgresConnectionString");
    if (!connectionString) throw toolNotConfigured("postgres.query", ["connectionString or postgresConnectionString"]);
    const pool = new Pool({ connectionString });
    try {
      const result = await pool.query(String(input.query), Array.isArray(input.values) ? input.values : []);
      return { command: result.command, rowCount: result.rowCount, rows: result.rows };
    } finally { await pool.end(); }
  }),
  databaseTool("redis.command", "Execute an allowlisted Redis command.", {
    type: "object", properties: { command: { type: "string" }, args: { type: "array" } }, required: ["command"],
  }, async (ctx, input) => {
    const url = configString(ctx, "redisUrl") ?? secret(ctx, "redisUrl");
    if (!url) throw toolNotConfigured("redis.command", ["redisUrl"]);
    const command = String(input.command).toUpperCase();
    if (!["GET", "SET", "DEL", "HGET", "HSET", "LPUSH", "LRANGE", "PUBLISH"].includes(command)) throw new Error(`Unsupported Redis command: ${command}`);
    const redis = new Redis(url);
    try { return { command, result: await redis.call(command, ...(Array.isArray(input.args) ? input.args.map(String) : [])) }; }
    finally { redis.disconnect(); }
  }),
  databaseTool("mongodb.command", "Call the configured MongoDB Atlas Data API.", {
    type: "object", properties: { action: { type: "string" }, database: { type: "string" }, collection: { type: "string" }, document: { type: "object" }, filter: { type: "object" }, update: { type: "object" } }, required: ["action", "database", "collection"],
  }, async (ctx, input) => {
    const dataApiUrl = configString(ctx, "mongoDataApiUrl");
    const apiKey = secret(ctx, "mongoDataApiKey") ?? configString(ctx, "mongoDataApiKey");
    if (!dataApiUrl || !apiKey) throw toolNotConfigured("mongodb.command", ["mongoDataApiUrl", "mongoDataApiKey"]);
    const actions: Record<string, string> = { find: "find", findOne: "findOne", insertOne: "insertOne", updateOne: "updateOne", deleteOne: "deleteOne", aggregate: "aggregate" };
    const action = actions[String(input.action)];
    if (!action) throw new Error(`Unsupported MongoDB Data API action: ${String(input.action)}`);
    const body = { dataSource: configString(ctx, "mongoDataSource") ?? "Cluster0", database: input.database, collection: input.collection, filter: input.filter ?? {}, document: input.document, update: input.update, pipeline: input.pipeline };
    return (await request(`${dataApiUrl.replace(/\/$/, "")}/action/${action}`, { method: "POST", headers: { "content-type": "application/json", "api-key": apiKey }, body: JSON.stringify(body) }, ctx.signal)).body;
  }),
];
