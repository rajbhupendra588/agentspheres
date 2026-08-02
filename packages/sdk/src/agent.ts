import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import {
  AgentCardSchema,
  DeregisterAgentRequestSchema,
  HeartbeatRequestSchema,
  InvokeRequestSchema,
  InvokeResponseSchema,
  RegisterAgentRequestSchema,
  type AgentCard,
  type InvokeResponse,
} from "@agentsphere/contracts";
import {
  createLogger,
  healthRoutes,
  httpJson,
  optional,
  tenantHeaders,
  toErrorBody,
  ulid,
} from "@agentsphere/common";
import { createMeshClient, type MeshClient } from "./mesh.js";

export interface InvokeHandlerContext {
  input: unknown;
  capability: string;
  sessionId?: string;
  correlationId?: string;
}

export interface CreateAgentOptions {
  card: AgentCard;
  port: number;
  baseUrl?: string;
  handler: (ctx: InvokeHandlerContext) => Promise<unknown>;
  heartbeatMs?: number;
  registryUrl?: string;
  weight?: number;
  token?: string;
}

export interface AgentRuntime {
  app: FastifyInstance;
  mesh: MeshClient;
  instanceId: string;
  card: AgentCard;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createAgent(options: CreateAgentOptions): AgentRuntime {
  const log = createLogger("agentsphere-agent", {
    agent: options.card.metadata.name,
  });

  const card = AgentCardSchema.parse(options.card);
  const instanceId = ulid();
  const baseUrl = options.baseUrl ?? `http://localhost:${options.port}`;
  const registryUrl = (options.registryUrl ?? optional("AS_REGISTRY_URL", "http://localhost:8082")).replace(
    /\/$/,
    "",
  );
  const heartbeatMs = options.heartbeatMs ?? 5_000;
  const mesh = createMeshClient({
    agentName: card.metadata.name,
    tenantId: card.metadata.tenantId,
    projectId: card.metadata.projectId,
  });

  const app = Fastify({ logger: false });

  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let started = false;

  app.register(healthRoutes);

  app.post("/v1/invoke", async (request, reply) => {
    const startedAt = Date.now();
    try {
      const parsed = InvokeRequestSchema.parse(request.body);
      const { capability, input, sessionId, correlationId } = parsed;

      if (!card.spec.capabilities.includes(capability)) {
        reply.status(404);
        return {
          error: {
            code: "CAPABILITY_NOT_FOUND",
            message: `Agent does not expose capability: ${capability}`,
          },
        };
      }

      const output = await options.handler({
        input,
        capability,
        sessionId,
        correlationId,
      });

      const response: InvokeResponse = InvokeResponseSchema.parse({
        output,
        agentName: card.metadata.name,
        instanceId,
        latencyMs: Date.now() - startedAt,
        correlationId,
      });

      return response;
    } catch (err) {
      const { statusCode, body } = toErrorBody(err);
      reply.status(statusCode);
      return body;
    }
  });

  async function register(): Promise<void> {
    const payload = RegisterAgentRequestSchema.parse({
      card,
      baseUrl,
      instanceId,
      weight: options.weight ?? 100,
    });

    await httpJson(`${registryUrl}/v1/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(card.metadata.tenantId, card.metadata.projectId),
        ...authHeader(options.token),
      },
      body: JSON.stringify(payload),
    });

    log.info("registered with registry", { instanceId, registryUrl });
  }

  async function sendHeartbeat(): Promise<void> {
    const payload = HeartbeatRequestSchema.parse({
      instanceId,
      timestamp: new Date().toISOString(),
      status: "HEALTHY",
    });

    await httpJson(`${registryUrl}/v1/heartbeat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(card.metadata.tenantId, card.metadata.projectId),
        ...authHeader(options.token),
      },
      body: JSON.stringify(payload),
    });
  }

  async function deregister(reason = "graceful_shutdown"): Promise<void> {
    const payload = DeregisterAgentRequestSchema.parse({ instanceId, reason });

    await httpJson(`${registryUrl}/v1/deregister`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...tenantHeaders(card.metadata.tenantId, card.metadata.projectId),
        ...authHeader(options.token),
      },
      body: JSON.stringify(payload),
    });

    log.info("deregistered from registry", { instanceId, reason });
  }

  function startHeartbeat(): void {
    heartbeatTimer = setInterval(() => {
      sendHeartbeat().catch((err) => {
        log.error("heartbeat failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, heartbeatMs);
    heartbeatTimer.unref?.();
  }

  function stopHeartbeat(): void {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = undefined;
    }
  }

  async function start(): Promise<void> {
    if (started) {
      return;
    }

    await app.listen({ port: options.port, host: "0.0.0.0" });
    log.info("agent listening", { port: options.port, baseUrl });

    await register();
    await sendHeartbeat();
    startHeartbeat();

    started = true;
  }

  async function stop(): Promise<void> {
    if (!started) {
      return;
    }

    stopHeartbeat();

    try {
      await deregister();
    } catch (err) {
      log.warn("deregister failed during shutdown", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    await app.close();
    started = false;
    log.info("agent stopped", { instanceId });
  }

  const shutdown = async (signal: string) => {
    log.info("received shutdown signal", { signal });
    await stop();
    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  return {
    app,
    mesh,
    instanceId,
    card,
    start,
    stop,
  };
}

function authHeader(token?: string): Record<string, string> {
  const resolved = token ?? process.env.AS_AGENT_TOKEN ?? process.env.AS_JWT_TOKEN;
  if (!resolved) {
    return {};
  }
  return { Authorization: `Bearer ${resolved}` };
}
