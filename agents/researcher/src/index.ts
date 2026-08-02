import { createAgent } from "@agentsphere/sdk";
import type { AgentCard } from "@agentsphere/contracts";

const port = Number(process.env.PORT ?? 9001);
const baseUrl = process.env.AS_AGENT_BASE_URL ?? `http://localhost:${port}`;

const card: AgentCard = {
  apiVersion: "agentsphere.io/v1",
  kind: "AgentCard",
  metadata: {
    name: "researcher",
    version: "1.0.0",
    owner: "platform",
    tenantId: process.env.AS_TENANT_ID ?? "default",
    projectId: process.env.AS_PROJECT_ID || undefined,
    labels: { team: "research", mesh: "agentsphere" },
  },
  spec: {
    capabilities: ["research.web"],
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        query: { type: "string" },
      },
    },
    outputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        findings: { type: "array" },
        sources: { type: "array" },
      },
    },
    endpoints: { invoke: "/v1/invoke" },
    resources: { timeoutMs: 30_000 },
    tools: ["web.search"],
  },
};

const agent = createAgent({
  card,
  port,
  baseUrl,
  handler: async ({ input, capability, sessionId, correlationId }) => {
    const body = (input ?? {}) as { topic?: string; query?: string };
    const topic = body.topic ?? body.query ?? "AgentSphere";

    const search = await agent.mesh.tools.execute(
      "web.search",
      { query: topic },
      { correlationId },
    );

    const results = (search.output as { results?: Array<{ title: string; url: string; snippet: string }> })
      .results ?? [];

    const findings = results.map((r, i) => ({
      id: i + 1,
      claim: r.snippet,
      confidence: 0.7 + (i % 3) * 0.05,
    }));

    if (sessionId) {
      await agent.mesh.memory.set(
        "last-research",
        { topic, findings },
        { scope: "session", sessionId },
      );
    }

    return {
      topic,
      capability,
      findings,
      sources: results.map((r) => ({ title: r.title, url: r.url })),
      researchedAt: new Date().toISOString(),
    };
  },
});

await agent.start();
console.log(`[researcher] ready at ${baseUrl} instance=${agent.instanceId}`);
