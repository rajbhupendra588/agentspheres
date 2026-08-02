import { Readable } from "node:stream";
import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config.js";

export interface ProxyOptions {
  targetBase: string;
  targetPath: string;
}

function buildTargetUrl(
  targetBase: string,
  targetPath: string,
  query: Record<string, unknown>,
): string {
  const url = new URL(targetPath, targetBase.endsWith("/") ? targetBase : `${targetBase}/`);

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        url.searchParams.append(key, String(item));
      }
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function pickForwardHeaders(req: FastifyRequest): Headers {
  const headers = new Headers();
  const contentType = req.headers["content-type"];
  const authorization = req.headers.authorization;
  const tenantId = req.headers["x-tenant-id"];
  const projectId = req.headers["x-project-id"];
  const correlationId = req.headers["x-correlation-id"];
  const idempotencyKey = req.headers["idempotency-key"];

  if (typeof contentType === "string") {
    headers.set("Content-Type", contentType);
  }
  if (typeof authorization === "string") {
    headers.set("Authorization", authorization);
  }
  if (typeof tenantId === "string" && tenantId.trim()) {
    headers.set("x-tenant-id", tenantId.trim());
  } else if (req.mesh?.tenantId) {
    headers.set("x-tenant-id", req.mesh.tenantId);
  }
  if (typeof projectId === "string" && projectId.trim()) {
    headers.set("x-project-id", projectId.trim());
  } else if (req.mesh?.projectId) {
    headers.set("x-project-id", req.mesh.projectId);
  }
  if (typeof correlationId === "string" && correlationId.trim()) {
    headers.set("x-correlation-id", correlationId.trim());
  }
  if (typeof idempotencyKey === "string" && idempotencyKey.trim()) {
    headers.set("Idempotency-Key", idempotencyKey.trim());
  }

  return headers;
}

async function readRequestBody(req: FastifyRequest): Promise<string | Buffer | undefined> {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  if (req.body === undefined || req.body === null) {
    return undefined;
  }

  if (typeof req.body === "string") {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  return JSON.stringify(req.body);
}

function proxyError(code: string, message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode, code });
}

async function streamUpstream(
  response: Response,
  reply: FastifyReply,
  correlationId?: string,
): Promise<void> {
  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    reply.header("content-type", responseContentType);
  }
  if (correlationId) {
    reply.header("x-correlation-id", correlationId);
  }

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) reply.header("retry-after", retryAfter);
  for (const name of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
    const value = response.headers.get(name);
    if (value) reply.header(name, value);
  }

  reply.status(response.status);

  if (!response.body) {
    reply.send();
    return;
  }

  const isEventStream = responseContentType?.includes("text/event-stream");
  if (isEventStream) {
    reply.hijack();
    reply.raw.writeHead(response.status, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...(correlationId ? { "x-correlation-id": correlationId } : {}),
    });

    const nodeStream = Readable.fromWeb(response.body as import("node:stream/web").ReadableStream);
    nodeStream.pipe(reply.raw);
    return;
  }

  const text = await response.text();
  if (!text) {
    reply.send();
    return;
  }

  if (responseContentType?.includes("application/json")) {
    try {
      reply.send(JSON.parse(text) as unknown);
      return;
    } catch {
      reply.send(text);
      return;
    }
  }

  reply.send(text);
}

export async function proxyRequest(
  req: FastifyRequest,
  reply: FastifyReply,
  options: ProxyOptions,
): Promise<void> {
  const targetUrl = buildTargetUrl(
    options.targetBase,
    options.targetPath,
    req.query as Record<string, unknown>,
  );

  const correlationHeader = req.headers["x-correlation-id"];
  const correlationId =
    typeof correlationHeader === "string" && correlationHeader.trim()
      ? correlationHeader.trim()
      : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.proxyTimeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: pickForwardHeaders(req),
      body: await readRequestBody(req),
      signal: controller.signal,
    });
    await streamUpstream(response, reply, correlationId);
  } catch (err) {
    if (controller.signal.aborted) {
      throw proxyError("GATEWAY_TIMEOUT", "Upstream request timed out", 504);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw proxyError("BAD_GATEWAY", `Upstream service unavailable: ${message}`, 502);
  } finally {
    clearTimeout(timer);
  }
}
