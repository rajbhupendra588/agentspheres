import type { FastifyReply, FastifyRequest } from "fastify";

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

  const response = await fetch(targetUrl, {
    method: req.method,
    headers: pickForwardHeaders(req),
    body: await readRequestBody(req),
  });

  const responseContentType = response.headers.get("content-type");
  if (responseContentType) {
    reply.header("content-type", responseContentType);
  }

  reply.status(response.status);

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
