import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, type Input } from "./_shared.js";

function safePath(ctx: Parameters<Tool["execute"]>[0], path: unknown): string {
  const root = configString(ctx, "rootPath");
  if (!root) throw toolNotConfigured("filesystem", ["rootPath"]);
  const target = resolve(root, String(path));
  if (relative(resolve(root), target).startsWith("..")) throw new Error("Path escapes configured rootPath");
  return target;
}
function fsTool(name: string, description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category: "FILESYSTEM" as const, builtin: true, inputSchema, tags: ["builtin", "filesystem"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}
export const filesystemTools: Tool[] = [
  fsTool("filesystem.read", "Read a UTF-8 file under the configured sandbox root.", { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, async (ctx, input) => ({ path: input.path, content: await readFile(safePath(ctx, input.path), "utf8") })),
  fsTool("filesystem.write", "Write a UTF-8 file under the configured sandbox root.", { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] }, async (ctx, input) => {
    const path = safePath(ctx, input.path); await writeFile(path, String(input.content), "utf8"); return { path: input.path, bytesWritten: Buffer.byteLength(String(input.content)) };
  }),
  fsTool("filesystem.list", "List entries under the configured sandbox root.", { type: "object", properties: { path: { type: "string" } }, required: ["path"] }, async (ctx, input) => ({ path: input.path, entries: await readdir(safePath(ctx, input.path), { withFileTypes: true }).then((entries) => entries.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? "directory" : entry.isFile() ? "file" : "other" }))) })),
];
