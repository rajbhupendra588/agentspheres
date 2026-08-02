import Fastify from "fastify";
import {
  createLogger,
  createPgPool,
  healthRoutes,
  registerGracefulShutdown,
  required,
  toErrorBody,
} from "@agentsphere/common";
import { ToolSdkError } from "@agentsphere/tool-sdk";
import { BUILTIN_TOOLS, getBuiltinHandler } from "./builtins/index.js";
import { toolEngineConfig } from "./config.js";
import { initToolSchema, listToolCards } from "./db/index.js";
import { closeToolEvents, initToolEvents } from "./events.js";
import { probeToolHealth } from "./runtime/executor.js";
import { listSeededTenantIds, seedBuiltinsForAllTenants } from "./seed.js";
import { registerToolRoutes } from "./server.js";

const log = createLogger("tool-engine");
const pool = createPgPool(required("AS_DATABASE_URL"));
const app = Fastify({ logger: false });

app.register(healthRoutes);

app.setErrorHandler((err, _request, reply) => {
  if (err instanceof ToolSdkError) {
    reply.status(err.statusCode).send({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }
  const { statusCode, body } = toErrorBody(err);
  reply.status(statusCode).send(body);
});

registerToolRoutes(app, pool);

async function startHealthProbes(): Promise<NodeJS.Timeout> {
  const tick = async () => {
    try {
      const tenants = await listSeededTenantIds(pool);
      for (const tenantId of tenants) {
        const cards = await listToolCards(pool, tenantId);
        for (const card of cards) {
          const tool = getBuiltinHandler(card.name);
          if (!tool) continue;
          await probeToolHealth(pool, card, tool);
        }
      }
    } catch (err) {
      log.warn("health probe cycle failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };
  await tick();
  return setInterval(() => void tick(), toolEngineConfig.healthProbeIntervalMs);
}

async function main(): Promise<void> {
  await initToolSchema(pool);
  await initToolEvents();
  await seedBuiltinsForAllTenants(pool);
  const healthTimer = await startHealthProbes();

  await app.listen({ port: toolEngineConfig.port, host: "0.0.0.0" });
  const tenants = await listSeededTenantIds(pool);
  log.info("ToolSphere tool-engine listening", {
    port: toolEngineConfig.port,
    tenants: tenants.length,
    builtins: BUILTIN_TOOLS.length,
  });

  registerGracefulShutdown("tool-engine", app, [
    { close: async () => clearInterval(healthTimer) },
    { close: async () => closeToolEvents() },
    { close: async () => pool.end() },
  ]);
}

main().catch((err) => {
  log.error("tool-engine failed to start", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
