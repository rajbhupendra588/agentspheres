import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 3000);
const gatewayUrl = (
  process.env.AS_GATEWAY_URL ??
  process.env.AS_GATEWAY_PUBLIC_URL ??
  "http://localhost:8080"
).replace(/\/$/, "");

/** Browser-facing gateway base. Empty = same-origin (console proxies /mesh). */
const publicGatewayBase = (process.env.AS_CONSOLE_PUBLIC_GATEWAY ?? "").replace(/\/$/, "");
const bootstrapSecret = process.env.AS_BOOTSTRAP_SECRET ?? "";

const distRoot = join(__dirname, "..", "dist");
const staticRoot = existsSync(distRoot)
  ? distRoot
  : join(__dirname, "..", "legacy-public");

const app = Fastify({
  logger: false,
  trustProxy: true,
  bodyLimit: 1_048_576,
});

app.addHook("onSend", async (_req, reply, payload) => {
  reply.header("X-Content-Type-Options", "nosniff");
  reply.header("X-Frame-Options", "DENY");
  reply.header("Referrer-Policy", "no-referrer");
  reply.header(
    "Content-Security-Policy",
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; connect-src 'self'",
  );
  return payload;
});

app.addContentTypeParser(
  ["application/json", "text/plain", "application/octet-stream"],
  { parseAs: "buffer" },
  (_req, body, done) => {
    done(null, body);
  },
);

await app.register(fastifyStatic, {
  root: staticRoot,
  prefix: "/",
});

app.get("/config.js", async (_req, reply) => {
  reply
    .type("application/javascript")
    .send(`window.AGENTSPHERE_GATEWAY = ${JSON.stringify(publicGatewayBase)};\n`);
});

app.get("/healthz", async () => ({ status: "ok", ts: new Date().toISOString() }));
app.get("/readyz", async () => ({ status: "ready", ts: new Date().toISOString() }));

/**
 * Server-side token mint. Keeps AS_BOOTSTRAP_SECRET off the browser.
 */
app.post("/api/auth/token", async (req, reply) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (bootstrapSecret) {
    headers["x-agentsphere-bootstrap"] = bootstrapSecret;
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${gatewayUrl}/mesh/auth/v1/token`, {
      method: "POST",
      headers,
      body: Buffer.isBuffer(req.body) ? req.body : JSON.stringify(req.body ?? {}),
    });
  } catch (err) {
    reply.code(502);
    return {
      error: {
        code: "GATEWAY_UNREACHABLE",
        message: err instanceof Error ? err.message : "Gateway unreachable",
      },
    };
  }

  const text = await upstream.text();
  reply.code(upstream.status);
  reply.type(upstream.headers.get("content-type") ?? "application/json");
  return reply.send(text);
});

/**
 * Same-origin reverse proxy to the mesh gateway.
 */
app.all("/mesh/*", async (req, reply) => {
  const targetUrl = `${gatewayUrl}${req.url}`;
  const headers = new Headers();
  const contentType = req.headers["content-type"];
  const authorization = req.headers.authorization;
  const accept = req.headers.accept;
  const tenantId = req.headers["x-tenant-id"];
  const projectId = req.headers["x-project-id"];

  if (typeof contentType === "string") headers.set("Content-Type", contentType);
  if (typeof authorization === "string") headers.set("Authorization", authorization);
  if (typeof accept === "string") headers.set("Accept", accept);
  if (typeof tenantId === "string" && tenantId.trim()) {
    headers.set("x-tenant-id", tenantId.trim());
  }
  if (typeof projectId === "string" && projectId.trim()) {
    headers.set("x-project-id", projectId.trim());
  }

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody && Buffer.isBuffer(req.body) ? req.body : undefined;

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, {
      method,
      headers,
      body,
      redirect: "manual",
    });
  } catch (err) {
    reply.code(502);
    return {
      error: {
        code: "GATEWAY_UNREACHABLE",
        message: err instanceof Error ? err.message : "Gateway unreachable",
      },
    };
  }

  const responseContentType = upstream.headers.get("content-type") ?? "";
  const isEventStream = responseContentType.includes("text/event-stream");

  if (isEventStream && upstream.body) {
    reply.hijack();
    reply.raw.writeHead(upstream.status, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(typeof value === "string" ? value : decoder.decode(value, { stream: true }));
      }
    } catch {
      // client disconnected or upstream closed
    } finally {
      reply.raw.end();
    }
    return;
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  reply.code(upstream.status);
  if (responseContentType) {
    reply.type(responseContentType);
  }
  return reply.send(buffer);
});

app.setNotFoundHandler(async (req, reply) => {
  if (
    req.method === "GET" &&
    !req.url.startsWith("/api") &&
    !req.url.startsWith("/mesh") &&
    existsSync(join(staticRoot, "index.html"))
  ) {
    return reply.sendFile("index.html");
  }
  return reply.code(404).send({ error: "not_found" });
});

const shutdown = async (signal: string) => {
  console.log(`[console] shutting down (${signal})`);
  await app.close();
  process.exit(0);
};
process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port, host: "0.0.0.0" });
console.log(
  `[console] http://0.0.0.0:${port} gateway=${gatewayUrl} publicGateway=${publicGatewayBase || "(same-origin)"} static=${staticRoot}`,
);
