import {
  createLogger,
  healthRoutes,
  httpJson,
  registerGracefulShutdown,
  registerSecurityHeaders,
  routeRateLimit,
  toErrorBody,
} from "@agentsphere/common";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { config, downstreamServices } from "./config.js";
import { meshAuthHook } from "./auth.js";
import { registerOpenApiRoutes } from "./openapi.js";
import { proxyRequest } from "./proxy.js";

const log = createLogger("gateway");

const gatewayIpLimiter = new RateLimiterMemory({
  points: config.rateLimitMax,
  duration: Math.max(1, Math.ceil(config.rateLimitWindowMs / 1000)),
});

function meshTargetPath(url: string, meshPrefix: string, replaceWith?: string): string {
  const pathname = url.split("?")[0] ?? url;
  const suffix = pathname.slice(meshPrefix.length) || "/";
  const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
  if (replaceWith !== undefined) {
    return `${replaceWith}${normalized}`;
  }
  return normalized;
}

export async function buildServer() {
  const app = Fastify({
    logger: false,
    trustProxy: true,
    bodyLimit: 1_048_576,
  });

  app.setErrorHandler((err, req, reply) => {
    const status = (err as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) {
      log.error("request failed", {
        error: err instanceof Error ? err.message : String(err),
        path: req.url,
      });
    }
    const correlation = req.headers["x-correlation-id"];
    if (typeof correlation === "string" && correlation.trim()) {
      reply.header("x-correlation-id", correlation.trim());
    }
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode).send(body);
  });

  await registerSecurityHeaders(app);

  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitWindowMs,
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
      "retry-after": true,
    },
    allowList: (req) => {
      const path = req.url.split("?")[0] ?? req.url;
      return (
        path === "/healthz" ||
        path === "/readyz" ||
        path === "/openapi.yaml" ||
        path === "/openapi.json"
      );
    },
  });

  // Rate-limit authorization work in this file so CodeQL sees the guard
  // at the same site as the auth hook registration (CWE-307/770).
  app.addHook("preHandler", async (req, reply) => {
    const path = req.url.split("?")[0] ?? req.url;
    if (path.startsWith("/mesh/")) {
      try {
        await gatewayIpLimiter.consume(String(req.ip || "unknown"));
      } catch {
        const { statusCode, body } = toErrorBody(
          Object.assign(new Error("Rate limit exceeded"), {
            statusCode: 429,
            code: "RATE_LIMITED",
          }),
        );
        reply.status(statusCode).send(body);
        return;
      }
    }
    await meshAuthHook(req, reply);
  });

  await app.register(healthRoutes);
  await registerOpenApiRoutes(app);

  app.get("/", routeRateLimit(), async () => ({
    name: "AgentSphere Gateway",
    version: "0.1.0",
    mode: config.gatewayOpen ? "open" : "locked",
    openapi: "/openapi.yaml",
  }));

  app.get("/mesh/health", routeRateLimit({ max: 120 }), async () => {
    const checks = await Promise.allSettled(
      downstreamServices.map(async (service) => {
        const health = await httpJson<{ status: string; ts: string }>(
          `${service.url}/healthz`,
        );
        return { name: service.name, url: service.url, ...health };
      }),
    );

    const services = checks.map((result, index) => {
      const meta = downstreamServices[index]!;
      if (result.status === "fulfilled") {
        return { name: meta.name, url: meta.url, status: "ok", detail: result.value };
      }
      return {
        name: meta.name,
        url: meta.url,
        status: "error",
        detail: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    const allOk = services.every((service) => service.status === "ok");

    return {
      status: allOk ? "ok" : "degraded",
      ts: new Date().toISOString(),
      services,
    };
  });

  app.all("/mesh/auth/*", routeRateLimit({ max: 60 }), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/auth");
    await proxyRequest(req, reply, {
      targetBase: config.authUrl,
      targetPath,
    });
  });

  app.all("/mesh/registry/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/registry");
    await proxyRequest(req, reply, {
      targetBase: config.registryUrl,
      targetPath,
    });
  });

  app.all("/mesh/discovery/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/discovery");
    await proxyRequest(req, reply, {
      targetBase: config.discoveryUrl,
      targetPath,
    });
  });

  app.all("/mesh/runtime/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/runtime");
    await proxyRequest(req, reply, {
      targetBase: config.runtimeUrl,
      targetPath,
    });
  });

  app.all("/mesh/workflow/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/workflow");
    await proxyRequest(req, reply, {
      targetBase: config.workflowUrl,
      targetPath,
    });
  });

  app.all("/mesh/tools/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/tools");
    await proxyRequest(req, reply, {
      targetBase: config.toolEngineUrl,
      targetPath,
    });
  });

  app.all("/mesh/memory/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/memory");
    await proxyRequest(req, reply, {
      targetBase: config.memoryUrl,
      targetPath,
    });
  });

  app.all("/mesh/notify/*", routeRateLimit(), async (req, reply) => {
    const targetPath = meshTargetPath(req.url, "/mesh/notify");
    await proxyRequest(req, reply, {
      targetBase: config.notificationUrl,
      targetPath,
    });
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  registerGracefulShutdown("gateway", app);
  log.info("Gateway listening", {
    port: config.port,
    gatewayOpen: config.gatewayOpen,
    openapi: "/openapi.yaml",
  });
  return app;
}
