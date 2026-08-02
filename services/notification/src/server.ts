import {
  createLogger,
  healthRoutes,
  toErrorBody,
  ulid,
} from "@agentsphere/common";
import { createMeshEvent, toEventProjection } from "@agentsphere/contracts";
import Fastify from "fastify";
import { z } from "zod";
import { startEventBridge, stopEventBridge } from "./bus.js";
import { addClient, broadcast, clientCount, removeClient } from "./clients.js";
import { config } from "./config.js";

const log = createLogger("notification");

const PublishSchema = z.object({
  type: z.string().min(1),
  payload: z.unknown(),
  tenantId: z.string().min(1).optional(),
});

export async function buildServer() {
  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode).send(body);
  });

  await app.register(healthRoutes);

  app.get("/v1/events", async (req, reply) => {
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    const client = {
      id: ulid(),
      response: reply.raw,
    };

    addClient(client);
    log.info("SSE client connected", { clientId: client.id, total: clientCount() });

    reply.raw.write(`: connected ${client.id}\n\n`);

    req.raw.on("close", () => {
      removeClient(client);
      log.info("SSE client disconnected", {
        clientId: client.id,
        total: clientCount(),
      });
    });
  });

  app.post("/v1/publish", async (req) => {
    const body = PublishSchema.parse(req.body);
    const tenantId = body.tenantId ?? "default";

    // Accept legacy {type,payload} and project to console MeshEvent shape.
    // Prefer CloudEvents mesh types when callers pass com.agentsphere.* types.
    const isMeshType = body.type.startsWith("com.agentsphere.");
    if (isMeshType) {
      const event = createMeshEvent({
        id: ulid(),
        type: body.type as Parameters<typeof createMeshEvent>[0]["type"],
        source: "agentsphere/notification",
        tenantId,
        data: body.payload,
      });
      const projection = toEventProjection(event);
      const delivered = broadcast(projection);
      return { published: true, delivered, clients: clientCount(), id: event.id };
    }

    const event = {
      id: ulid(),
      type: body.type,
      payload: body.payload,
      ts: new Date().toISOString(),
      tenantId,
    };
    const delivered = broadcast(event);

    return {
      published: true,
      delivered,
      clients: clientCount(),
      id: event.id,
    };
  });

  app.addHook("onClose", async () => {
    await stopEventBridge();
  });

  return app;
}

export async function startServer() {
  await startEventBridge();
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  log.info("Notification service listening", { port: config.port });
  return app;
}
