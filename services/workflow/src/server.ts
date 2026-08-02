import {
  createLogger,
  healthRoutes,
  httpJson,
  resolveProjectId,
  resolveTenantId,
  tenantHeaders,
  toErrorBody,
  ulid,
} from "@agentsphere/common";
import type { InvokeResponse } from "@agentsphere/contracts";
import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import {
  closeNats,
  publishWorkflowCompleted,
  publishWorkflowStarted,
} from "./nats.js";
import { createRun, getRun, listRuns, updateRun, type WorkflowStep } from "./store.js";

const log = createLogger("workflow");

const ResearchSynthesizeSchema = z.object({
  topic: z.string().min(1),
  sessionId: z.string().optional(),
  tenantId: z.string().optional(),
  projectId: z.string().optional(),
});

async function invokeRuntime(
  capability: string,
  input: unknown,
  opts: { sessionId?: string; tenantId: string; projectId?: string },
): Promise<InvokeResponse> {
  return httpJson<InvokeResponse>(`${config.runtimeUrl}/v1/invoke`, {
    method: "POST",
    headers: tenantHeaders(opts.tenantId, opts.projectId),
    body: JSON.stringify({
      capability,
      input,
      sessionId: opts.sessionId,
      tenantId: opts.tenantId,
      projectId: opts.projectId,
    }),
  });
}

function markStepRunning(steps: WorkflowStep[], index: number): WorkflowStep[] {
  return steps.map((step, i) =>
    i === index
      ? { ...step, status: "RUNNING", startedAt: new Date().toISOString() }
      : step,
  );
}

function markStepSucceeded(steps: WorkflowStep[], index: number, output: unknown): WorkflowStep[] {
  return steps.map((step, i) =>
    i === index
      ? {
          ...step,
          status: "SUCCEEDED",
          output,
          completedAt: new Date().toISOString(),
        }
      : step,
  );
}

function markStepFailed(steps: WorkflowStep[], index: number, error: string): WorkflowStep[] {
  return steps.map((step, i) =>
    i === index
      ? {
          ...step,
          status: "FAILED",
          error,
          completedAt: new Date().toISOString(),
        }
      : step,
  );
}

export async function buildServer() {
  if (config.temporalAddress) {
    log.info("Temporal address configured; durable mode reserved for future use", {
      temporalAddress: config.temporalAddress,
    });
  }

  const app = Fastify({ logger: false });

  app.setErrorHandler((err, _req, reply) => {
    const { statusCode, body } = toErrorBody(err);
    reply.status(statusCode).send(body);
  });

  await app.register(healthRoutes);

  app.post("/v1/workflows/research-synthesize", async (req) => {
    const body = ResearchSynthesizeSchema.parse(req.body);
    const tenantId = resolveTenantId(req.headers, body.tenantId);
    const projectId = resolveProjectId(req.headers, body.projectId);
    const runId = ulid();

    const initialSteps: WorkflowStep[] = [
      { name: "research.web", status: "PENDING" },
      { name: "synthesize.report", status: "PENDING" },
    ];

    let run = createRun({
      runId,
      workflowType: "research-synthesize",
      status: "RUNNING",
      topic: body.topic,
      sessionId: body.sessionId,
      steps: initialSteps,
    });

    await publishWorkflowStarted(run, tenantId, projectId);

    try {
      let steps = markStepRunning(run.steps, 0);
      run = updateRun(runId, { steps })!;

      const research = await invokeRuntime("research.web", { topic: body.topic }, {
        sessionId: body.sessionId,
        tenantId,
        projectId,
      });

      steps = markStepSucceeded(steps, 0, research.output);
      run = updateRun(runId, { steps })!;

      steps = markStepRunning(steps, 1);
      run = updateRun(runId, { steps })!;

      const synthesis = await invokeRuntime(
        "synthesize.report",
        { topic: body.topic, research: research.output },
        { sessionId: body.sessionId, tenantId, projectId },
      );

      steps = markStepSucceeded(steps, 1, synthesis.output);
      run = updateRun(runId, {
        status: "SUCCEEDED",
        steps,
        result: synthesis.output,
      })!;

      await publishWorkflowCompleted(run, tenantId, projectId);

      return {
        runId: run.runId,
        status: run.status,
        steps: run.steps,
        result: run.result,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const failedIndex = run.steps.findIndex((step) => step.status === "RUNNING");
      const stepIndex = failedIndex >= 0 ? failedIndex : 0;
      const steps = markStepFailed(run.steps, stepIndex, message);

      run = updateRun(runId, {
        status: "FAILED",
        steps,
      })!;

      await publishWorkflowCompleted(run, tenantId, projectId);

      return {
        runId: run.runId,
        status: run.status,
        steps: run.steps,
        result: run.result,
      };
    }
  });

  app.get("/v1/workflows/:runId", async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const run = getRun(runId);
    if (!run) {
      reply.status(404).send({
        error: { code: "NOT_FOUND", message: `Workflow run ${runId} not found` },
      });
      return;
    }
    return run;
  });

  app.get("/v1/workflows", async () => ({
    workflows: listRuns(),
  }));

  app.addHook("onClose", async () => {
    await closeNats();
  });

  return app;
}

export async function startServer() {
  const app = await buildServer();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  log.info("Workflow service listening", { port: config.port });
  return app;
}
