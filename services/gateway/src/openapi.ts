import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { config } from "./config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveOpenApiPath(): string | null {
  const candidates = [
    config.openApiPath,
    join(__dirname, "../openapi/openapi.yaml"),
    join(process.cwd(), "openapi/openapi.yaml"),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let cachedYaml: string | null = null;

function loadOpenApiYaml(): string | null {
  if (cachedYaml) return cachedYaml;
  const path = resolveOpenApiPath();
  if (!path) return null;
  cachedYaml = readFileSync(path, "utf8");
  return cachedYaml;
}

/** Serve OpenAPI contract for client SDK generators and integrators. */
export async function registerOpenApiRoutes(app: FastifyInstance): Promise<void> {
  app.get("/openapi.yaml", async (_req, reply) => {
    const yaml = loadOpenApiYaml();
    if (!yaml) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "OpenAPI specification is not available on this gateway",
        },
      });
    }
    reply.header("content-type", "application/yaml; charset=utf-8");
    reply.header("cache-control", "public, max-age=60");
    return reply.send(yaml);
  });

  app.get("/openapi.json", async (_req, reply) => {
    const yaml = loadOpenApiYaml();
    if (!yaml) {
      return reply.status(404).send({
        error: {
          code: "NOT_FOUND",
          message: "OpenAPI specification is not available on this gateway",
        },
      });
    }

    // Lightweight discovery document — YAML remains the canonical contract.
    return {
      openapi: "3.1.0",
      version: "0.1.0",
      title: "AgentSphere Gateway API",
      yamlUrl: "/openapi.yaml",
      jsonUrl: "/openapi.json",
      errorModel: "{ error: { code, message, details? } }",
      rateLimit: {
        defaultMax: config.rateLimitMax,
        windowMs: config.rateLimitWindowMs,
        headers: [
          "x-ratelimit-limit",
          "x-ratelimit-remaining",
          "x-ratelimit-reset",
          "Retry-After",
        ],
      },
      resiliency: {
        proxyTimeoutMs: config.proxyTimeoutMs,
        retryableStatusCodes: [429, 502, 503, 504],
        health: ["/healthz", "/readyz", "/mesh/health"],
      },
      consistency: {
        tenantHeader: "x-tenant-id",
        projectHeader: "x-project-id",
        jwtClaimsWin: true,
        discoveryCacheNote: "Discovery may lag registry by a short TTL; retry after register.",
      },
    };
  });
}
