import { z } from "zod";
import { ProjectIdSchema, TenantIdSchema } from "./tenancy.js";

/**
 * AgentSphere mesh event bus.
 *
 * Transport: NATS JetStream (control-plane lifecycle bus).
 * Envelope: CloudEvents 1.0 compatible (structured JSON).
 *
 * Kafka is reserved for future analytics/CDC dual-write; the mesh
 * control plane uses JetStream for low-latency durable delivery,
 * subject-based routing, and at-least-once consumers with dedup.
 */

// ---------------------------------------------------------------------------
// Event types (CloudEvents `type`)
// ---------------------------------------------------------------------------

export const MeshEventTypeSchema = z.enum([
  "com.agentsphere.agent.registered",
  "com.agentsphere.agent.updated",
  "com.agentsphere.agent.heartbeat",
  "com.agentsphere.agent.offline",
  "com.agentsphere.agent.deregistered",
  "com.agentsphere.tool.registered",
  "com.agentsphere.tool.updated",
  "com.agentsphere.tool.deleted",
  "com.agentsphere.tool.executed",
  "com.agentsphere.tool.failed",
  "com.agentsphere.tool.healthy",
  "com.agentsphere.tool.unhealthy",
  "com.agentsphere.tool.deprecated",
  "com.agentsphere.tool.configured",
  "com.agentsphere.task.started",
  "com.agentsphere.task.completed",
  "com.agentsphere.task.failed",
  "com.agentsphere.routing.failed",
  "com.agentsphere.workflow.started",
  "com.agentsphere.workflow.completed",
]);

export type MeshEventType = z.infer<typeof MeshEventTypeSchema>;

// ---------------------------------------------------------------------------
// NATS subjects (1:1 with event types)
// ---------------------------------------------------------------------------

export const subjects = {
  agentRegistered: "agentsphere.agent.registered",
  agentUpdated: "agentsphere.agent.updated",
  agentHeartbeat: "agentsphere.agent.heartbeat",
  agentOffline: "agentsphere.agent.offline",
  agentDeregistered: "agentsphere.agent.deregistered",
  toolRegistered: "agentsphere.tool.registered",
  toolUpdated: "agentsphere.tool.updated",
  toolDeleted: "agentsphere.tool.deleted",
  toolExecuted: "agentsphere.tool.executed",
  toolFailed: "agentsphere.tool.failed",
  toolHealthy: "agentsphere.tool.healthy",
  toolUnhealthy: "agentsphere.tool.unhealthy",
  toolDeprecated: "agentsphere.tool.deprecated",
  toolConfigured: "agentsphere.tool.configured",
  taskStarted: "agentsphere.task.started",
  taskCompleted: "agentsphere.task.completed",
  taskFailed: "agentsphere.task.failed",
  routingFailed: "agentsphere.routing.failed",
  workflowStarted: "agentsphere.workflow.started",
  workflowCompleted: "agentsphere.workflow.completed",
  /** @deprecated Use taskCompleted — retained for subscribers already wired. */
  invokeCompleted: "agentsphere.invoke.completed",
  /** @deprecated Use workflowStarted / workflowCompleted. */
  workflowUpdated: "agentsphere.workflow.updated",
} as const;

export type EventSubject = (typeof subjects)[keyof typeof subjects];

export const EVENT_TYPE_TO_SUBJECT: Record<MeshEventType, EventSubject> = {
  "com.agentsphere.agent.registered": subjects.agentRegistered,
  "com.agentsphere.agent.updated": subjects.agentUpdated,
  "com.agentsphere.agent.heartbeat": subjects.agentHeartbeat,
  "com.agentsphere.agent.offline": subjects.agentOffline,
  "com.agentsphere.agent.deregistered": subjects.agentDeregistered,
  "com.agentsphere.tool.registered": subjects.toolRegistered,
  "com.agentsphere.tool.updated": subjects.toolUpdated,
  "com.agentsphere.tool.deleted": subjects.toolDeleted,
  "com.agentsphere.tool.executed": subjects.toolExecuted,
  "com.agentsphere.tool.failed": subjects.toolFailed,
  "com.agentsphere.tool.healthy": subjects.toolHealthy,
  "com.agentsphere.tool.unhealthy": subjects.toolUnhealthy,
  "com.agentsphere.tool.deprecated": subjects.toolDeprecated,
  "com.agentsphere.tool.configured": subjects.toolConfigured,
  "com.agentsphere.task.started": subjects.taskStarted,
  "com.agentsphere.task.completed": subjects.taskCompleted,
  "com.agentsphere.task.failed": subjects.taskFailed,
  "com.agentsphere.routing.failed": subjects.routingFailed,
  "com.agentsphere.workflow.started": subjects.workflowStarted,
  "com.agentsphere.workflow.completed": subjects.workflowCompleted,
};

export const JETSTREAM_STREAM = "AGENTSPHERE" as const;
export const JETSTREAM_SUBJECTS = "agentsphere.>" as const;

// ---------------------------------------------------------------------------
// CloudEvents-compatible envelope
// ---------------------------------------------------------------------------

export const MeshEventSchema = z.object({
  /** CloudEvents id — ULID, used as JetStream Msg-Id for dedup. */
  id: z.string().min(1),
  specversion: z.literal("1.0"),
  type: MeshEventTypeSchema,
  source: z.string().min(1),
  time: z.string().datetime(),
  datacontenttype: z.literal("application/json"),
  subject: z.string().min(1).optional(),
  /** Hard tenant isolation — required on every mesh event. */
  tenantid: TenantIdSchema,
  projectid: ProjectIdSchema.optional(),
  correlationid: z.string().optional(),
  requestid: z.string().optional(),
  agentid: z.string().optional(),
  data: z.unknown(),
});

export type MeshEvent = z.infer<typeof MeshEventSchema>;

/** SSE / console projection of a mesh event. */
export const MeshEventProjectionSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
  ts: z.string().datetime(),
  tenantId: TenantIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  correlationId: z.string().optional(),
});

export type MeshEventProjection = z.infer<typeof MeshEventProjectionSchema>;

// ---------------------------------------------------------------------------
// Typed data payloads
// ---------------------------------------------------------------------------

export const AgentRegisteredDataSchema = z.object({
  instanceId: z.string().min(1),
  agentName: z.string().min(1),
  version: z.string().min(1),
  baseUrl: z.string().url(),
  capabilities: z.array(z.string()),
  owner: z.string().min(1).optional(),
  projectId: ProjectIdSchema.optional(),
  registeredAt: z.string().datetime(),
});

export type AgentRegisteredData = z.infer<typeof AgentRegisteredDataSchema>;

export const AgentUpdatedDataSchema = AgentRegisteredDataSchema.extend({
  updatedAt: z.string().datetime(),
});

export type AgentUpdatedData = z.infer<typeof AgentUpdatedDataSchema>;

export const HeartbeatReceivedDataSchema = z.object({
  instanceId: z.string().min(1),
  status: z.enum(["HEALTHY", "DRAINING", "UNHEALTHY"]),
  timestamp: z.string().datetime(),
  agentName: z.string().optional(),
});

export type HeartbeatReceivedData = z.infer<typeof HeartbeatReceivedDataSchema>;

export const AgentOfflineDataSchema = z.object({
  instanceId: z.string().min(1),
  agentName: z.string().min(1),
  version: z.string().min(1),
  reason: z.enum(["HEARTBEAT_EXPIRED", "DEREGISTERED", "EVICTED"]),
  offlineAt: z.string().datetime(),
  lastHeartbeat: z.string().datetime().optional(),
});

export type AgentOfflineData = z.infer<typeof AgentOfflineDataSchema>;

export const AgentDeregisteredDataSchema = z.object({
  instanceId: z.string().min(1),
  agentName: z.string().min(1),
  version: z.string().min(1),
  reason: z.string().optional(),
  deregisteredAt: z.string().datetime(),
});

export type AgentDeregisteredData = z.infer<typeof AgentDeregisteredDataSchema>;

export const ToolRegisteredDataSchema = z.object({
  toolId: z.string().min(1).optional(),
  tool: z.string().min(1),
  version: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  registeredAt: z.string().datetime(),
});

export type ToolRegisteredData = z.infer<typeof ToolRegisteredDataSchema>;

export const ToolUpdatedDataSchema = z.object({
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().min(1),
  rowVersion: z.number().int().positive(),
  updatedAt: z.string().datetime(),
});
export type ToolUpdatedData = z.infer<typeof ToolUpdatedDataSchema>;

export const ToolDeletedDataSchema = z.object({
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().min(1),
  deletedAt: z.string().datetime(),
});
export type ToolDeletedData = z.infer<typeof ToolDeletedDataSchema>;

export const ToolExecutedDataSchema = z.object({
  executionId: z.string().min(1),
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().optional(),
  capability: z.string().optional(),
  latencyMs: z.number().nonnegative(),
  agentName: z.string().optional(),
  executedAt: z.string().datetime(),
});
export type ToolExecutedData = z.infer<typeof ToolExecutedDataSchema>;

export const ToolFailedDataSchema = z.object({
  executionId: z.string().min(1),
  toolId: z.string().optional(),
  tool: z.string().min(1),
  version: z.string().optional(),
  code: z.string().min(1),
  message: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  attempts: z.number().int().positive().optional(),
  failedAt: z.string().datetime(),
});
export type ToolFailedData = z.infer<typeof ToolFailedDataSchema>;

export const ToolHealthChangedDataSchema = z.object({
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(["HEALTHY", "DEGRADED", "UNHEALTHY", "UNKNOWN"]),
  message: z.string().optional(),
  checkedAt: z.string().datetime(),
});
export type ToolHealthChangedData = z.infer<typeof ToolHealthChangedDataSchema>;

export const ToolDeprecatedDataSchema = z.object({
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().min(1),
  deprecatedAt: z.string().datetime(),
});
export type ToolDeprecatedData = z.infer<typeof ToolDeprecatedDataSchema>;

export const ToolConfiguredDataSchema = z.object({
  toolId: z.string().min(1),
  tool: z.string().min(1),
  version: z.string().min(1),
  configuredAt: z.string().datetime(),
  keys: z.array(z.string()).optional(),
});
export type ToolConfiguredData = z.infer<typeof ToolConfiguredDataSchema>;
export const TaskStartedDataSchema = z.object({
  taskId: z.string().min(1),
  capability: z.string().min(1),
  instanceId: z.string().optional(),
  agentName: z.string().optional(),
  startedAt: z.string().datetime(),
});

export type TaskStartedData = z.infer<typeof TaskStartedDataSchema>;

export const TaskCompletedDataSchema = z.object({
  taskId: z.string().min(1),
  capability: z.string().min(1),
  instanceId: z.string().min(1),
  agentName: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  completedAt: z.string().datetime(),
});

export type TaskCompletedData = z.infer<typeof TaskCompletedDataSchema>;

export const TaskFailedDataSchema = z.object({
  taskId: z.string().min(1),
  capability: z.string().min(1),
  instanceId: z.string().optional(),
  agentName: z.string().optional(),
  code: z.string().min(1),
  message: z.string().min(1),
  latencyMs: z.number().nonnegative(),
  failedAt: z.string().datetime(),
});

export type TaskFailedData = z.infer<typeof TaskFailedDataSchema>;

export const RoutingFailedDataSchema = z.object({
  capability: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
  failedAt: z.string().datetime(),
});

export type RoutingFailedData = z.infer<typeof RoutingFailedDataSchema>;

export const WorkflowStartedDataSchema = z.object({
  runId: z.string().min(1),
  workflowType: z.string().min(1),
  topic: z.string().optional(),
  startedAt: z.string().datetime(),
});

export type WorkflowStartedData = z.infer<typeof WorkflowStartedDataSchema>;

export const WorkflowCompletedDataSchema = z.object({
  runId: z.string().min(1),
  workflowType: z.string().min(1),
  status: z.enum(["SUCCEEDED", "FAILED"]),
  topic: z.string().optional(),
  completedAt: z.string().datetime(),
});

export type WorkflowCompletedData = z.infer<typeof WorkflowCompletedDataSchema>;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export interface CreateMeshEventInput {
  id: string;
  type: MeshEventType;
  source: string;
  tenantId: string;
  data: unknown;
  projectId?: string;
  correlationId?: string;
  requestId?: string;
  agentId?: string;
  time?: string;
  subject?: string;
}

export function createMeshEvent(input: CreateMeshEventInput): MeshEvent {
  const natsSubject = EVENT_TYPE_TO_SUBJECT[input.type];
  return MeshEventSchema.parse({
    id: input.id,
    specversion: "1.0",
    type: input.type,
    source: input.source,
    time: input.time ?? new Date().toISOString(),
    datacontenttype: "application/json",
    subject: input.subject ?? natsSubject,
    tenantid: input.tenantId,
    projectid: input.projectId,
    correlationid: input.correlationId,
    requestid: input.requestId,
    agentid: input.agentId,
    data: input.data,
  });
}

export function toEventProjection(event: MeshEvent): MeshEventProjection {
  return MeshEventProjectionSchema.parse({
    id: event.id,
    type: event.type,
    payload: event.data,
    ts: event.time,
    tenantId: event.tenantid,
    projectId: event.projectid,
    correlationId: event.correlationid,
  });
}

export function subjectForEventType(type: MeshEventType): EventSubject {
  return EVENT_TYPE_TO_SUBJECT[type];
}
