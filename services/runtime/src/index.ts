import Fastify from "fastify";
import {
  DiscoveryResultSchema,
  InvokeRequestSchema,
  InvokeResponseSchema,
  PORTS,
  type DiscoveryResult,
  type InvokeResponse,
} from "@agentsphere/contracts";
import {
  createLogger,
  healthRoutes,
  httpJson,
  HttpError,
  optional,
  resolveProjectId,
  resolveTenantId,
  tenantHeaders,
  toErrorBody,
  ulid,
} from "@agentsphere/common";
import {
  closeRuntimeEvents,
  initRuntimeEvents,
  publishRoutingFailed,
  publishTaskCompleted,
  publishTaskFailed,
  publishTaskStarted,
} from "./events.js";

const log = createLogger("runtime");
const discoveryUrl = optional("AS_DISCOVERY_URL", "http://localhost:8083").replace(/\/$/, "");
const registryUrl = optional("AS_REGISTRY_URL", "http://localhost:8082").replace(/\/$/, "");
const port = Number(optional("PORT", String(PORTS.runtime)));

const app = Fastify({ logger: false });

app.register(healthRoutes);

app.post("/v1/invoke", async (request, reply) => {
  const startedAt = Date.now();
  const taskId = ulid();

  try {
    const body = InvokeRequestSchema.parse(request.body);
    const tenantId = resolveTenantId(request.headers, body.tenantId);
    const projectId = resolveProjectId(request.headers, body.projectId);
    const correlationId = body.correlationId ?? taskId;
    const params = new URLSearchParams({ capability: body.capability, tenant: tenantId });
    if (projectId) params.set("projectId", projectId);

    const discovery = DiscoveryResultSchema.parse(
      await httpJson<DiscoveryResult>(
        `${discoveryUrl}/v1/discover?${params.toString()}`,
        { headers: tenantHeaders(tenantId, projectId) },
      ),
    );

    const instance = discovery.instances[0];
    if (!instance) {
      await publishRoutingFailed({
        capability: body.capability,
        tenantId,
        projectId,
        correlationId,
        code: "CAPABILITY_UNAVAILABLE",
        message: `No healthy instances for capability: ${body.capability}`,
      });
      reply.status(404);
      return {
        error: {
          code: "CAPABILITY_UNAVAILABLE",
          message: `No healthy instances for capability: ${body.capability}`,
        },
      };
    }

    await publishTaskStarted({
      taskId,
      capability: body.capability,
      tenantId,
      projectId,
      correlationId,
      instanceId: instance.instanceId,
      agentName: instance.agentName,
    });

    const invokeUrl = `${instance.baseUrl.replace(/\/$/, "")}/v1/invoke`;

    try {
      const agentResponse = await httpJson<InvokeResponse>(invokeUrl, {
        method: "POST",
        body: JSON.stringify({
          capability: body.capability,
          input: body.input,
          timeoutMs: body.timeoutMs,
          correlationId,
          sessionId: body.sessionId,
        }),
      });

      const parsed = InvokeResponseSchema.parse(agentResponse);
      const latencyMs = Date.now() - startedAt;

      await publishTaskCompleted({
        taskId,
        capability: body.capability,
        tenantId,
        projectId,
        correlationId,
        instanceId: instance.instanceId,
        agentName: parsed.agentName || instance.agentName,
        latencyMs: Math.max(parsed.latencyMs, latencyMs),
      });

      return InvokeResponseSchema.parse({
        ...parsed,
        latencyMs: Math.max(parsed.latencyMs, latencyMs),
        correlationId: parsed.correlationId ?? correlationId,
      });
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      const message =
        err instanceof HttpError
          ? err.message
          : `Failed to invoke agent at ${invokeUrl}`;

      log.error("agent invoke failed", {
        capability: body.capability,
        instanceId: instance.instanceId,
        baseUrl: instance.baseUrl,
        error: err instanceof Error ? err.message : String(err),
      });

      await publishTaskFailed({
        taskId,
        capability: body.capability,
        tenantId,
        projectId,
        correlationId,
        instanceId: instance.instanceId,
        agentName: instance.agentName,
        code: "AGENT_INVOKE_FAILED",
        message,
        latencyMs,
      });

      reply.status(502);
      return {
        error: {
          code: "AGENT_INVOKE_FAILED",
          message,
          details: err instanceof HttpError ? err.body : undefined,
        },
      };
    }
  } catch (err) {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

app.get("/v1/capabilities", async (_request, reply) => {
  try {
    const agents = await httpJson<Array<{ card?: { spec?: { capabilities?: string[] } } }>>(
      `${registryUrl}/v1/agents`,
    );

    const capabilities = new Set<string>();
    for (const agent of agents) {
      for (const capability of agent.card?.spec?.capabilities ?? []) {
        capabilities.add(capability);
      }
    }

    return {
      capabilities: [...capabilities].sort(),
      count: capabilities.size,
      resolvedAt: new Date().toISOString(),
    };
  } catch (err) {
    log.warn("capabilities proxy failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode);
    return body;
  }
});

async function main(): Promise<void> {
  await initRuntimeEvents();
  await app.listen({ port, host: "0.0.0.0" });
  log.info("runtime listening", { port, discoveryUrl, registryUrl });
}

main().catch((err) => {
  log.error("runtime failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));

async function shutdown(signal: string): Promise<void> {
  log.info("received shutdown signal", { signal });
  await app.close();
  await closeRuntimeEvents();
  process.exit(0);
}
