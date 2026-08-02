import { z } from "zod";

// ---------------------------------------------------------------------------
// Multi-tenancy
// ---------------------------------------------------------------------------

/** Organization / hard isolation boundary. */
export const TenantIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Invalid tenant id");

export type TenantId = z.infer<typeof TenantIdSchema>;

/** Optional project scope within a tenant. */
export const ProjectIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/, "Invalid project id");

export type ProjectId = z.infer<typeof ProjectIdSchema>;

export const DEFAULT_TENANT_ID = "default" as const;

export const TENANT_HEADER = "x-tenant-id" as const;
export const PROJECT_HEADER = "x-project-id" as const;

export const MeshRoleSchema = z.enum(["admin", "developer", "agent", "viewer"]);
export type MeshRole = z.infer<typeof MeshRoleSchema>;

export const JwtClaimsSchema = z.object({
  sub: z.string().min(1),
  role: MeshRoleSchema,
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
});

export type JwtClaims = z.infer<typeof JwtClaimsSchema>;

export const TokenRequestSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema.optional(),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
});

export type TokenRequest = z.infer<typeof TokenRequestSchema>;

export const TokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  expiresIn: z.number().int().positive(),
  tokenType: z.literal("Bearer"),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
  role: MeshRoleSchema,
  subject: z.string().min(1),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const TenantStatusSchema = z.enum(["active", "suspended"]);
export type TenantStatus = z.infer<typeof TenantStatusSchema>;

export const TenantRecordSchema = z.object({
  tenantId: TenantIdSchema,
  displayName: z.string().min(1).max(200),
  status: TenantStatusSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  agentCount: z.number().int().nonnegative().optional(),
  memberCount: z.number().int().nonnegative().optional(),
});

export type TenantRecord = z.infer<typeof TenantRecordSchema>;

export const CreateTenantRequestSchema = z.object({
  tenantId: TenantIdSchema,
  displayName: z.string().min(1).max(200).optional(),
});

export type CreateTenantRequest = z.infer<typeof CreateTenantRequestSchema>;

export const TenantMemberSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema,
  tenantId: TenantIdSchema,
  createdAt: z.string().datetime(),
});

export type TenantMember = z.infer<typeof TenantMemberSchema>;

export const InviteTenantMemberRequestSchema = z.object({
  subject: z.string().min(1),
  role: MeshRoleSchema.optional(),
});

export type InviteTenantMemberRequest = z.infer<typeof InviteTenantMemberRequestSchema>;

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

export const AgentCardMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().min(1),
  /** Hard tenant isolation key for this agent. */
  tenantId: TenantIdSchema,
  /** Optional project within the tenant. */
  projectId: ProjectIdSchema.optional(),
  labels: z.record(z.string()).optional(),
});

export type AgentCardMetadata = z.infer<typeof AgentCardMetadataSchema>;

export const AgentCardSpecSchema = z.object({
  capabilities: z.array(z.string().min(1)),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  endpoints: z.object({
    invoke: z.string().min(1),
  }),
  resources: z.object({
    timeoutMs: z.number().int().positive(),
  }),
  tools: z.array(z.string()),
});

export type AgentCardSpec = z.infer<typeof AgentCardSpecSchema>;

export const AgentCardSchema = z.object({
  apiVersion: z.literal("agentsphere.io/v1"),
  kind: z.literal("AgentCard"),
  metadata: AgentCardMetadataSchema,
  spec: AgentCardSpecSchema,
});

export type AgentCard = z.infer<typeof AgentCardSchema>;

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const RegisterAgentRequestSchema = z.object({
  card: AgentCardSchema,
  baseUrl: z.string().url(),
  instanceId: z.string().optional(),
  weight: z.number().int().positive().optional(),
});

export type RegisterAgentRequest = z.infer<typeof RegisterAgentRequestSchema>;

export const RegisterAgentResponseSchema = z.object({
  instanceId: z.string(),
  agentName: z.string(),
  version: z.string(),
  status: z.enum(["REGISTERED", "UPDATED"]),
  registeredAt: z.string().datetime(),
});

export type RegisterAgentResponse = z.infer<typeof RegisterAgentResponseSchema>;

export const HeartbeatRequestSchema = z.object({
  instanceId: z.string(),
  timestamp: z.string().datetime().optional(),
  status: z.enum(["HEALTHY", "DRAINING"]).optional(),
});

export type HeartbeatRequest = z.infer<typeof HeartbeatRequestSchema>;

export const DeregisterAgentRequestSchema = z.object({
  instanceId: z.string(),
  reason: z.string().optional(),
});

export type DeregisterAgentRequest = z.infer<typeof DeregisterAgentRequestSchema>;

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

export const DiscoveryQuerySchema = z.object({
  capability: z.string().min(1),
  version: z.string().optional(),
  labels: z.record(z.string()).optional(),
  /** Required for tenant-safe discovery (also accepted via x-tenant-id). */
  tenant: TenantIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  limit: z.number().int().positive().optional(),
});

export type DiscoveryQuery = z.infer<typeof DiscoveryQuerySchema>;

export const DiscoveryInstanceSchema = z.object({
  instanceId: z.string(),
  agentName: z.string(),
  version: z.string(),
  baseUrl: z.string().url(),
  capabilities: z.array(z.string()),
  weight: z.number().int().positive(),
  status: z.enum(["HEALTHY", "UNHEALTHY", "DRAINING"]),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
});

export type DiscoveryInstance = z.infer<typeof DiscoveryInstanceSchema>;

export const DiscoveryResultSchema = z.object({
  capability: z.string(),
  instances: z.array(DiscoveryInstanceSchema),
  resolvedAt: z.string().datetime(),
});

export type DiscoveryResult = z.infer<typeof DiscoveryResultSchema>;

// ---------------------------------------------------------------------------
// Invoke
// ---------------------------------------------------------------------------

export const InvokeRequestSchema = z.object({
  capability: z.string().min(1),
  input: z.unknown(),
  timeoutMs: z.number().int().positive().optional(),
  correlationId: z.string().optional(),
  sessionId: z.string().optional(),
  tenantId: TenantIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
});

export type InvokeRequest = z.infer<typeof InvokeRequestSchema>;

export const InvokeResponseSchema = z.object({
  output: z.unknown(),
  agentName: z.string(),
  instanceId: z.string(),
  latencyMs: z.number().nonnegative(),
  correlationId: z.string().optional(),
});

export type InvokeResponse = z.infer<typeof InvokeResponseSchema>;

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().optional(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolExecuteRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.unknown(),
  agentName: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ToolExecuteRequest = z.infer<typeof ToolExecuteRequestSchema>;

export const ToolExecuteResponseSchema = z.object({
  output: z.unknown(),
  tool: z.string(),
  latencyMs: z.number().nonnegative(),
});

export type ToolExecuteResponse = z.infer<typeof ToolExecuteResponseSchema>;

// ---------------------------------------------------------------------------
// Memory
// ---------------------------------------------------------------------------

export const MemoryScopeSchema = z.enum(["session", "agent", "workspace"]);

export type MemoryScope = z.infer<typeof MemoryScopeSchema>;

export const MemoryRecordSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  scope: MemoryScopeSchema,
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
  sessionId: z.string().optional(),
  agentName: z.string().optional(),
  workspaceId: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  ttlSeconds: z.number().int().positive().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

export type MemoryRecord = z.infer<typeof MemoryRecordSchema>;

export const MemoryGetRequestSchema = z.object({
  key: z.string().min(1),
  scope: MemoryScopeSchema,
  tenantId: TenantIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  sessionId: z.string().optional(),
  agentName: z.string().optional(),
  workspaceId: z.string().optional(),
});

export type MemoryGetRequest = z.infer<typeof MemoryGetRequestSchema>;

export const MemorySetRequestSchema = MemoryRecordSchema.omit({
  createdAt: true,
  updatedAt: true,
});

export type MemorySetRequest = z.infer<typeof MemorySetRequestSchema>;

// ---------------------------------------------------------------------------
// API errors
// ---------------------------------------------------------------------------

export const ApiErrorBodySchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

export const ApiErrorSchema = z.object({
  error: ApiErrorBodySchema,
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

// ---------------------------------------------------------------------------
// NATS event subjects
// ---------------------------------------------------------------------------

export const subjects = {
  agentRegistered: "agentsphere.agent.registered",
  agentHeartbeat: "agentsphere.agent.heartbeat",
  agentDeregistered: "agentsphere.agent.deregistered",
  invokeCompleted: "agentsphere.invoke.completed",
  workflowUpdated: "agentsphere.workflow.updated",
} as const;

export type EventSubject = (typeof subjects)[keyof typeof subjects];

// ---------------------------------------------------------------------------
// Service ports
// ---------------------------------------------------------------------------

export const PORTS = {
  gateway: 8080,
  auth: 8081,
  registry: 8082,
  discovery: 8083,
  runtime: 8084,
  workflow: 8085,
  toolEngine: 8086,
  memory: 8087,
  notification: 8088,
  console: 3000,
  postgres: 5432,
  redis: 6379,
  nats: 4222,
  temporal: 7233,
  otelCollector: 4318,
} as const;

export type ServiceName = keyof typeof PORTS;
