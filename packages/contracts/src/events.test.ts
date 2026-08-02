import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMeshEvent,
  EVENT_TYPE_TO_SUBJECT,
  MeshEventTypeSchema,
  subjectForEventType,
  subjects,
  toEventProjection,
} from "./events.js";

describe("mesh event catalog", () => {
  it("maps every event type to a NATS subject", () => {
    for (const type of MeshEventTypeSchema.options) {
      const subject = subjectForEventType(type);
      assert.equal(EVENT_TYPE_TO_SUBJECT[type], subject);
      assert.ok(subject.startsWith("agentsphere."));
    }
  });

  it("creates CloudEvents-compatible envelopes with tenant isolation", () => {
    const event = createMeshEvent({
      id: "01HTESTEVENT000000000000001",
      type: "com.agentsphere.agent.registered",
      source: "agentsphere/registry",
      tenantId: "acme",
      projectId: "platform",
      correlationId: "corr-1",
      data: {
        instanceId: "inst-1",
        agentName: "researcher",
        version: "1.0.0",
        baseUrl: "http://researcher:8091",
        capabilities: ["research.web"],
        registeredAt: "2026-08-02T12:00:00.000Z",
      },
    });

    assert.equal(event.specversion, "1.0");
    assert.equal(event.tenantid, "acme");
    assert.equal(event.projectid, "platform");
    assert.equal(event.subject, subjects.agentRegistered);
    assert.equal(event.datacontenttype, "application/json");
  });

  it("rejects missing tenant id", () => {
    assert.throws(() =>
      createMeshEvent({
        id: "01HTESTEVENT000000000000002",
        type: "com.agentsphere.task.started",
        source: "agentsphere/runtime",
        tenantId: "",
        data: {},
      }),
    );
  });

  it("projects events for SSE / console consumers", () => {
    const event = createMeshEvent({
      id: "01HTESTEVENT000000000000003",
      type: "com.agentsphere.routing.failed",
      source: "agentsphere/runtime",
      tenantId: "default",
      data: {
        capability: "missing.cap",
        code: "CAPABILITY_UNAVAILABLE",
        message: "none",
        failedAt: "2026-08-02T12:00:00.000Z",
      },
    });

    const projection = toEventProjection(event);
    assert.equal(projection.id, event.id);
    assert.equal(projection.type, event.type);
    assert.equal(projection.ts, event.time);
    assert.equal(projection.tenantId, "default");
    assert.deepEqual(projection.payload, event.data);
  });

  it("includes the full enterprise catalog subjects", () => {
    const required = [
      "agentRegistered",
      "agentUpdated",
      "agentHeartbeat",
      "agentOffline",
      "toolRegistered",
      "toolUpdated",
      "toolDeleted",
      "toolExecuted",
      "toolFailed",
      "toolHealthy",
      "toolUnhealthy",
      "toolDeprecated",
      "toolConfigured",
      "taskStarted",
      "taskCompleted",
      "taskFailed",
      "routingFailed",
      "workflowStarted",
      "workflowCompleted",
    ] as const;

    for (const key of required) {
      assert.ok(subjects[key], `missing subject ${key}`);
    }
  });
});
