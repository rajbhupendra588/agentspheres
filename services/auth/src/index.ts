import Fastify from "fastify";
import jwt from "jsonwebtoken";
import rateLimit from "@fastify/rate-limit";
import {
  JwtClaimsSchema,
  PORTS,
  TokenRequestSchema,
  TokenResponseSchema,
  type JwtClaims,
  type MeshRole,
} from "@agentsphere/contracts";
import {
  createLogger,
  envFlag,
  healthRoutes,
  optional,
  registerGracefulShutdown,
  resolveBootstrapSecret,
  resolveJwtSecret,
  toErrorBody,
} from "@agentsphere/common";

const DEFAULT_ROLE: MeshRole = "agent";
const TOKEN_TTL_SECONDS = 3600;

const log = createLogger("auth");
const secret = resolveJwtSecret();
const gatewayOpen = envFlag("AS_GATEWAY_OPEN", false);
const bootstrapSecret = resolveBootstrapSecret();
const port = Number(process.env.PORT ?? PORTS.auth);

const app = Fastify({ logger: false, trustProxy: true });

await app.register(rateLimit, {
  max: Number(optional("AS_AUTH_RATE_LIMIT_MAX", "30")),
  timeWindow: Number(optional("AS_AUTH_RATE_LIMIT_WINDOW_MS", "60000")),
  addHeadersOnExceeding: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
  },
  addHeaders: {
    "x-ratelimit-limit": true,
    "x-ratelimit-remaining": true,
    "x-ratelimit-reset": true,
    "retry-after": true,
  },
  errorResponseBuilder: (_request, context) => {
    const afterSeconds = Math.max(1, Math.ceil(context.ttl / 1000));
    return Object.assign(
      new Error(`Rate limit exceeded. Retry after ${afterSeconds} seconds.`),
      {
        statusCode: context.statusCode,
        code: "RATE_LIMITED",
      },
    );
  },
});

app.register(healthRoutes);

app.setErrorHandler((err, _request, reply) => {
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  if (status >= 500) {
    log.error("request failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  const { statusCode, body } = toErrorBody(err);
  reply.status(statusCode).send(body);
});

function assertTokenMintAuthorized(request: { headers: Record<string, unknown> }): void {
  // Open/local mode: allow unauthenticated minting for E2E convenience.
  if (gatewayOpen) {
    return;
  }

  if (!bootstrapSecret) {
    throw Object.assign(
      new Error("AS_BOOTSTRAP_SECRET is required to mint tokens in locked mode"),
      { statusCode: 503, code: "BOOTSTRAP_NOT_CONFIGURED" },
    );
  }

  const bootstrapHeader = request.headers["x-agentsphere-bootstrap"];
  const authorization = request.headers.authorization;
  const provided =
    typeof bootstrapHeader === "string"
      ? bootstrapHeader
      : typeof authorization === "string" && authorization.startsWith("Bootstrap ")
        ? authorization.slice("Bootstrap ".length)
        : undefined;

  if (!provided || provided !== bootstrapSecret) {
    throw Object.assign(new Error("Missing or invalid bootstrap credentials"), {
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }
}

app.post("/v1/token", async (request) => {
  assertTokenMintAuthorized(request);

  const body = TokenRequestSchema.parse(request.body);
  const role = body.role ?? DEFAULT_ROLE;

  const claims: JwtClaims = JwtClaimsSchema.parse({
    sub: body.subject,
    role,
    tenantId: body.tenantId,
    projectId: body.projectId,
  });

  const accessToken = jwt.sign(claims, secret, {
    expiresIn: TOKEN_TTL_SECONDS,
  });

  log.info("token issued", {
    subject: claims.sub,
    role: claims.role,
    tenantId: claims.tenantId,
  });

  return TokenResponseSchema.parse({
    accessToken,
    expiresIn: TOKEN_TTL_SECONDS,
    tokenType: "Bearer",
    tenantId: claims.tenantId,
    projectId: claims.projectId,
    role: claims.role,
    subject: claims.sub,
  });
});

app.get("/v1/introspect", async (request, reply) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    reply.status(401);
    return {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing or invalid Authorization header",
      },
    };
  }

  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    reply.status(401);
    return {
      error: {
        code: "UNAUTHORIZED",
        message: "Missing bearer token",
      },
    };
  }

  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload & Partial<JwtClaims>;
    const parsed = JwtClaimsSchema.safeParse({
      sub: decoded.sub,
      role: decoded.role,
      tenantId: decoded.tenantId,
      projectId: decoded.projectId,
    });

    if (!parsed.success || decoded.exp === undefined) {
      reply.status(401);
      return { active: false };
    }

    return {
      active: true,
      subject: parsed.data.sub,
      role: parsed.data.role,
      tenantId: parsed.data.tenantId,
      projectId: parsed.data.projectId,
      exp: decoded.exp,
    };
  } catch (err) {
    log.debug("token introspection failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { active: false };
  }
});

await app.listen({ port, host: "0.0.0.0" });
registerGracefulShutdown("auth", app);
log.info("auth service listening", { port, gatewayOpen, bootstrapRequired: !gatewayOpen || Boolean(bootstrapSecret) });
