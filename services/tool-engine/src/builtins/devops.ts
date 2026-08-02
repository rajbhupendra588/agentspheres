import { spawn } from "node:child_process";
import type { Tool } from "@agentsphere/tool-sdk";
import { defineTool, toolNotConfigured, defaultValidateJsonSchema } from "@agentsphere/tool-sdk";
import { configString, request, secret, type Input } from "./_shared.js";

function tool(name: string, category: "GITHUB" | "GIT" | "DOCKER" | "KUBERNETES", description: string, inputSchema: Record<string, unknown>, execute: (ctx: Parameters<Tool["execute"]>[0], input: Input) => Promise<unknown>): Tool {
  const metadata = { name, description, version: "1.0.0", owner: "agentsphere", category, builtin: true, inputSchema, tags: ["builtin", "devops"] };
  return defineTool({ metadata, validate: (input) => defaultValidateJsonSchema(inputSchema, input), execute: async (ctx, input) => ({ output: await execute(ctx, input as Input) }) });
}
function command(binary: string, args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, shell: false });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(`${binary} exited ${code}: ${stderr}`)));
  });
}

export const devopsTools: Tool[] = [
  tool("github.request", "GITHUB", "Make an authenticated GitHub REST API request.", {
    type: "object", properties: { path: { type: "string" }, method: { type: "string" }, body: {} }, required: ["path"],
  }, async (ctx, input) => {
    const token = secret(ctx, "githubToken");
    if (!token) throw toolNotConfigured("github.request", ["githubToken"]);
    const path = String(input.path);
    if (!path.startsWith("/")) throw new Error("GitHub API path must start with /");
    return request(`https://api.github.com${path}`, { method: String(input.method ?? "GET"), headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "content-type": "application/json" }) }, body: input.body === undefined ? undefined : JSON.stringify(input.body) }, ctx.signal);
  }),
  tool("git.exec", "GIT", "Run an allowlisted Git read-only command.", {
    type: "object", properties: { command: { type: "string" }, args: { type: "array" } }, required: ["command"],
  }, async (ctx, input) => {
    const workspaceRoot = configString(ctx, "workspaceRoot");
    if (!workspaceRoot) throw toolNotConfigured("git.exec", ["workspaceRoot"]);
    const subcommand = String(input.command);
    if (!["status", "log", "rev-parse", "show", "diff", "ls-files"].includes(subcommand)) throw new Error(`Unsupported git subcommand: ${subcommand}`);
    return command("git", [subcommand, ...(Array.isArray(input.args) ? input.args.map(String) : [])], workspaceRoot);
  }),
  tool("docker.exec", "DOCKER", "Run an allowlisted Docker inspection command.", {
    type: "object", properties: { command: { type: "string" }, args: { type: "array" } }, required: ["command"],
  }, async (_ctx, input) => {
    const subcommand = String(input.command);
    if (!["ps", "images", "inspect", "logs", "version"].includes(subcommand)) throw new Error(`Unsupported docker command: ${subcommand}`);
    return command("docker", [subcommand, ...(Array.isArray(input.args) ? input.args.map(String) : [])]);
  }),
  tool("kubernetes.request", "KUBERNETES", "Call a Kubernetes API endpoint with a bearer token.", {
    type: "object", properties: { path: { type: "string" }, method: { type: "string" }, body: {} }, required: ["path"],
  }, async (ctx, input) => {
    const apiUrl = configString(ctx, "kubernetesApiUrl");
    const token = secret(ctx, "kubernetesToken");
    if (!apiUrl || !token) throw toolNotConfigured("kubernetes.request", ["kubernetesApiUrl", "kubernetesToken"]);
    const path = String(input.path);
    if (!path.startsWith("/")) throw new Error("Kubernetes API path must start with /");
    return request(`${apiUrl.replace(/\/$/, "")}${path}`, { method: String(input.method ?? "GET"), headers: { authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "content-type": "application/json" }) }, body: input.body === undefined ? undefined : JSON.stringify(input.body) }, ctx.signal);
  }),
];
