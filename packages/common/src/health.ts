import type { FastifyInstance, FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get("/healthz", async () => ({
    status: "ok",
    ts: new Date().toISOString(),
  }));

  app.get("/readyz", async () => ({
    status: "ready",
    ts: new Date().toISOString(),
  }));
};
