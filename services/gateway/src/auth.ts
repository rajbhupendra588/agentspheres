import {
  DEFAULT_TENANT_ID,
  PROJECT_HEADER,
  TENANT_HEADER,
  JwtClaimsSchema,
  type JwtClaims,
} from "@agentsphere/contracts";
import { toErrorBody } from "@agentsphere/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

const PUBLIC_MESH_PATHS = new Set([
  "/mesh/auth/v1/token",
  "/mesh/auth/token",
  "/mesh/health",
]);

export type MeshRequestContext = {
  claims?: JwtClaims;
  tenantId: string;
  projectId?: string;
};

declare module "fastify" {
  interface FastifyRequest {
    mesh?: MeshRequestContext;
  }
}

function extractBearerToken(authorization: string | undefined): string | null {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1] ?? null;
}

function headerString(
  headers: FastifyRequest["headers"],
  name: string,
): string | undefined {
  const value = headers[name];
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
    return value[0].trim();
  }
  return undefined;
}

/**
 * Authenticate mesh requests and bind tenant/project context.
 * Prefer JWT claims; fall back to explicit tenant headers (dev / gateway-open).
 */
export async function meshAuthHook(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const path = req.url.split("?")[0] ?? req.url;

  if (!path.startsWith("/mesh/")) {
    return;
  }

  if (PUBLIC_MESH_PATHS.has(path)) {
    const tenantId = headerString(req.headers, TENANT_HEADER) ?? DEFAULT_TENANT_ID;
    const projectId = headerString(req.headers, PROJECT_HEADER);
    req.mesh = { tenantId, projectId };
    return;
  }

  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    if (!config.gatewayOpen) {
      const { statusCode, body } = toErrorBody(
        Object.assign(new Error("Missing Bearer token"), {
          statusCode: 401,
          code: "UNAUTHORIZED",
        }),
      );
      reply.status(statusCode).send(body);
      return;
    }

    const tenantId = headerString(req.headers, TENANT_HEADER) ?? DEFAULT_TENANT_ID;
    const projectId = headerString(req.headers, PROJECT_HEADER);
    req.mesh = { tenantId, projectId };
    // Ensure downstream services always see a tenant header.
    req.headers[TENANT_HEADER] = tenantId;
    if (projectId) req.headers[PROJECT_HEADER] = projectId;
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload & Partial<JwtClaims>;
    const claims = JwtClaimsSchema.parse({
      sub: decoded.sub,
      role: decoded.role,
      tenantId: decoded.tenantId,
      projectId: decoded.projectId,
    });

    // JWT is source of truth — overwrite any client-supplied tenant headers.
    req.headers[TENANT_HEADER] = claims.tenantId;
    if (claims.projectId) {
      req.headers[PROJECT_HEADER] = claims.projectId;
    } else {
      delete req.headers[PROJECT_HEADER];
    }

    req.mesh = {
      claims,
      tenantId: claims.tenantId,
      projectId: claims.projectId,
    };
  } catch {
    const { statusCode, body } = toErrorBody(
      Object.assign(new Error("Invalid or expired token"), {
        statusCode: 401,
        code: "UNAUTHORIZED",
      }),
    );
    reply.status(statusCode).send(body);
  }
}
