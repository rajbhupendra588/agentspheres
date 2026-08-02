import { randomUUID } from "node:crypto";
import type { ToolContext, ToolMetadata } from "@agentsphere/tool-sdk";
import { defaultValidateJsonSchema } from "@agentsphere/tool-sdk";

export type Input = Record<string, unknown>;

export async function validated(
  metadata: Pick<ToolMetadata, "name" | "inputSchema">,
  input: unknown,
): Promise<Input> {
  const result = await defaultValidateJsonSchema(metadata.inputSchema, input);
  if (!result.valid) {
    throw new Error(
      `Invalid input for ${metadata.name}: ${result.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join(", ")}`,
    );
  }
  return input as Input;
}

export function configString(ctx: ToolContext, key: string): string | undefined {
  const value = ctx.configuration[key];
  if (typeof value === "string" && value.length > 0) return value;
  return process.env[key] || undefined;
}

export function secret(ctx: ToolContext, key: string): string | undefined {
  return ctx.secrets[key];
}

export function jsonHeaders(token?: string): Record<string, string> {
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function responseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function request(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
  const response = await fetch(url, { ...init, signal });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}: ${JSON.stringify(body)}`);
  }
  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  };
}

export function executionRecord(ctx: ToolContext): Record<string, string> {
  return {
    executionId: ctx.executionId || randomUUID(),
    correlationId: ctx.correlationId,
    tenantId: ctx.tenantId,
  };
}
