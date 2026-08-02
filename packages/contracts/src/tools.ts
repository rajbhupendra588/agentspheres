import { z } from "zod";
import { ProjectIdSchema, TenantIdSchema } from "./tenancy.js";

// ---------------------------------------------------------------------------
// ToolSphere — categories, lifecycle, auth, execution modes
// ---------------------------------------------------------------------------

export const ToolCategorySchema = z.enum([
  "CORE_MESH",
  "DATABASE",
  "FILESYSTEM",
  "GIT",
  "GITHUB",
  "BROWSER",
  "DOCKER",
  "KUBERNETES",
  "CLOUD",
  "MESSAGING",
  "OBSERVABILITY",
  "MONITORING",
  "SECURITY",
  "IDENTITY",
  "AI_MODELS",
  "DOCUMENTS",
  "IMAGES",
  "AUDIO",
  "VIDEO",
  "FINANCE",
  "PRODUCTIVITY",
  "KNOWLEDGE",
  "ENTERPRISE",
  "CUSTOM",
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

export const ToolLifecycleStateSchema = z.enum([
  "DRAFT",
  "REGISTERED",
  "VALIDATED",
  "ACTIVE",
  "DEPRECATED",
  "DISABLED",
  "REMOVED",
]);
export type ToolLifecycleState = z.infer<typeof ToolLifecycleStateSchema>;

/** @deprecated Prefer ToolLifecycleStateSchema — retained for V4 rows. */
export const ToolStatusSchema = z.enum(["ACTIVE", "DEPRECATED"]);
export type ToolStatus = z.infer<typeof ToolStatusSchema>;

export const ToolAuthSchemeSchema = z.enum([
  "NONE",
  "API_KEY",
  "JWT",
  "OAUTH2",
  "MTLS",
  "BASIC",
  "VAULT",
]);
export type ToolAuthScheme = z.infer<typeof ToolAuthSchemeSchema>;

export const ToolExecutionModeSchema = z.enum([
  "SYNC",
  "ASYNC",
  "STREAMING",
  "BATCH",
  "LONG_RUNNING",
  "SCHEDULED",
]);
export type ToolExecutionMode = z.infer<typeof ToolExecutionModeSchema>;

export const ToolProtocolSchema = z.enum([
  "HTTP",
  "HTTPS",
  "GRPC",
  "NATS",
  "MCP",
  "INTERNAL",
]);
export type ToolProtocol = z.infer<typeof ToolProtocolSchema>;

export const ToolHealthStatusSchema = z.enum([
  "HEALTHY",
  "DEGRADED",
  "UNHEALTHY",
  "UNKNOWN",
]);
export type ToolHealthStatus = z.infer<typeof ToolHealthStatusSchema>;

export const ToolPermissionEffectSchema = z.enum(["ALLOW", "DENY"]);
export type ToolPermissionEffect = z.infer<typeof ToolPermissionEffectSchema>;

// ---------------------------------------------------------------------------
// Capability / version / rate limits / cost
// ---------------------------------------------------------------------------

export const ToolCapabilitySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  permissions: z.array(z.string().min(1)).optional(),
  executionModes: z.array(ToolExecutionModeSchema).optional(),
});
export type ToolCapability = z.infer<typeof ToolCapabilitySchema>;

export const ToolVersionInfoSchema = z.object({
  version: z.string().min(1),
  changelog: z.string().optional(),
  releasedAt: z.string().datetime().optional(),
  deprecatedAt: z.string().datetime().optional(),
  removedAt: z.string().datetime().optional(),
  isLatest: z.boolean().optional(),
});
export type ToolVersionInfo = z.infer<typeof ToolVersionInfoSchema>;

export const ToolRateLimitSchema = z.object({
  requestsPerSecond: z.number().positive().optional(),
  requestsPerMinute: z.number().positive().optional(),
  requestsPerDay: z.number().positive().optional(),
  concurrentExecutions: z.number().int().positive().optional(),
  burst: z.number().int().positive().optional(),
});
export type ToolRateLimit = z.infer<typeof ToolRateLimitSchema>;

export const ToolCostSchema = z.object({
  currency: z.string().min(1).default("USD"),
  perExecution: z.number().nonnegative().optional(),
  perUnit: z.number().nonnegative().optional(),
  unit: z.string().optional(),
});
export type ToolCost = z.infer<typeof ToolCostSchema>;

export const ToolAuthenticationSchema = z.object({
  schemes: z.array(ToolAuthSchemeSchema).min(1).default(["NONE"]),
  required: z.boolean().default(false),
  scopes: z.array(z.string()).optional(),
  audience: z.string().optional(),
});
export type ToolAuthentication = z.infer<typeof ToolAuthenticationSchema>;

export const ToolConfigurationSchemaSchema = z.object({
  schema: z.record(z.unknown()),
  required: z.array(z.string()).default([]),
  secrets: z.array(z.string()).default([]),
  defaults: z.record(z.unknown()).optional(),
});
export type ToolConfigurationSchema = z.infer<typeof ToolConfigurationSchemaSchema>;

export const ToolDependencySchema = z.object({
  toolId: z.string().min(1).optional(),
  name: z.string().min(1),
  versionRange: z.string().optional(),
  optional: z.boolean().default(false),
});
export type ToolDependency = z.infer<typeof ToolDependencySchema>;

export const ToolHealthSchema = z.object({
  status: ToolHealthStatusSchema,
  checkedAt: z.string().datetime(),
  latencyMs: z.number().nonnegative().optional(),
  message: z.string().optional(),
  details: z.record(z.unknown()).optional(),
});
export type ToolHealth = z.infer<typeof ToolHealthSchema>;

export const ToolMetricsSnapshotSchema = z.object({
  executionsTotal: z.number().nonnegative().default(0),
  executionsSuccess: z.number().nonnegative().default(0),
  executionsFailed: z.number().nonnegative().default(0),
  executionsCancelled: z.number().nonnegative().default(0),
  avgLatencyMs: z.number().nonnegative().optional(),
  p95LatencyMs: z.number().nonnegative().optional(),
  p99LatencyMs: z.number().nonnegative().optional(),
  errorRate: z.number().min(0).max(1).optional(),
  lastExecutedAt: z.string().datetime().optional(),
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
});
export type ToolMetricsSnapshot = z.infer<typeof ToolMetricsSnapshotSchema>;

// ---------------------------------------------------------------------------
// Tool Card — published discovery document
// ---------------------------------------------------------------------------

export const ToolCardSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  owner: z.string().min(1),
  category: ToolCategorySchema,
  capabilities: z.array(ToolCapabilitySchema).min(1),
  authentication: ToolAuthenticationSchema,
  permissions: z.array(z.string()).default([]),
  configuration: ToolConfigurationSchemaSchema.optional(),
  supportedProtocols: z.array(ToolProtocolSchema).default(["INTERNAL"]),
  supportedTenants: z.array(TenantIdSchema).optional(),
  dependencies: z.array(ToolDependencySchema).default([]),
  metrics: ToolMetricsSnapshotSchema.optional(),
  health: ToolHealthSchema.optional(),
  rateLimits: ToolRateLimitSchema.optional(),
  cost: ToolCostSchema.optional(),
  documentation: z.string().url().or(z.string().min(1)).optional(),
  tags: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  lifecycle: ToolLifecycleStateSchema.default("ACTIVE"),
  builtin: z.boolean().default(false),
  endpoint: z.string().optional(),
  inputSchema: z.record(z.unknown()).optional(),
  outputSchema: z.record(z.unknown()).optional(),
  tenantId: TenantIdSchema,
  projectId: ProjectIdSchema.optional(),
  rowVersion: z.number().int().positive().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});
export type ToolCard = z.infer<typeof ToolCardSchema>;

/**
 * Legacy tool definition — accepted on register for backward compatibility.
 * Normalized into a ToolCard by the registry.
 */
export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.string().min(1).optional(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  tenantId: TenantIdSchema.optional(),
  status: ToolStatusSchema.optional(),
  builtin: z.boolean().optional(),
  id: z.string().optional(),
  owner: z.string().optional(),
  category: ToolCategorySchema.optional(),
  capabilities: z.array(ToolCapabilitySchema).optional(),
  authentication: ToolAuthenticationSchema.optional(),
  permissions: z.array(z.string()).optional(),
  configuration: ToolConfigurationSchemaSchema.optional(),
  supportedProtocols: z.array(ToolProtocolSchema).optional(),
  supportedTenants: z.array(TenantIdSchema).optional(),
  dependencies: z.array(ToolDependencySchema).optional(),
  rateLimits: ToolRateLimitSchema.optional(),
  cost: ToolCostSchema.optional(),
  documentation: z.string().optional(),
  regions: z.array(z.string()).optional(),
  endpoint: z.string().optional(),
  lifecycle: ToolLifecycleStateSchema.optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ---------------------------------------------------------------------------
// Registry / discovery / validate APIs
// ---------------------------------------------------------------------------

export const ToolRegisterRequestSchema = ToolDefinitionSchema;
export type ToolRegisterRequest = z.infer<typeof ToolRegisterRequestSchema>;

export const ToolRegisterResponseSchema = z.object({
  tool: ToolCardSchema,
  status: z.enum(["REGISTERED", "UPDATED"]),
  rowVersion: z.number().int().positive(),
});
export type ToolRegisterResponse = z.infer<typeof ToolRegisterResponseSchema>;

export const ToolUpdateRequestSchema = ToolDefinitionSchema.partial().extend({
  expectedRowVersion: z.number().int().positive().optional(),
});
export type ToolUpdateRequest = z.infer<typeof ToolUpdateRequestSchema>;

export const ToolDiscoverQuerySchema = z.object({
  capability: z.string().min(1).optional(),
  category: ToolCategorySchema.optional(),
  tags: z.array(z.string()).optional(),
  region: z.string().optional(),
  tenantId: TenantIdSchema.optional(),
  owner: z.string().optional(),
  version: z.string().optional(),
  health: ToolHealthStatusSchema.optional(),
  permissions: z.array(z.string()).optional(),
  maxLatencyMs: z.number().int().positive().optional(),
  includeDeprecated: z.boolean().optional(),
  limit: z.number().int().positive().max(500).default(50),
  offset: z.number().int().nonnegative().default(0),
});
export type ToolDiscoverQuery = z.infer<typeof ToolDiscoverQuerySchema>;

export const ToolDiscoverResponseSchema = z.object({
  tools: z.array(ToolCardSchema),
  count: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  tenantId: TenantIdSchema,
  resolvedAt: z.string().datetime(),
});
export type ToolDiscoverResponse = z.infer<typeof ToolDiscoverResponseSchema>;

export const ToolValidateRequestSchema = z.object({
  tool: ToolDefinitionSchema.optional(),
  toolId: z.string().optional(),
  name: z.string().optional(),
  version: z.string().optional(),
  input: z.unknown().optional(),
  configuration: z.record(z.unknown()).optional(),
});
export type ToolValidateRequest = z.infer<typeof ToolValidateRequestSchema>;

export const ToolValidateResponseSchema = z.object({
  valid: z.boolean(),
  errors: z.array(
    z.object({
      path: z.string(),
      code: z.string(),
      message: z.string(),
    }),
  ),
  warnings: z
    .array(
      z.object({
        path: z.string(),
        code: z.string(),
        message: z.string(),
      }),
    )
    .default([]),
});
export type ToolValidateResponse = z.infer<typeof ToolValidateResponseSchema>;

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export const ToolExecuteRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.unknown(),
  agentName: z.string().optional(),
  correlationId: z.string().optional(),
  tenantId: TenantIdSchema.optional(),
  projectId: ProjectIdSchema.optional(),
  version: z.string().optional(),
  capability: z.string().optional(),
  mode: ToolExecutionModeSchema.optional().default("SYNC"),
  timeoutMs: z.number().int().positive().max(3_600_000).optional(),
  idempotencyKey: z.string().min(1).max(256).optional(),
  scheduledAt: z.string().datetime().optional(),
  cancelToken: z.string().optional(),
  configuration: z.record(z.unknown()).optional(),
  retry: z
    .object({
      maxAttempts: z.number().int().positive().max(20).default(3),
      backoffMs: z.number().int().nonnegative().default(100),
      maxBackoffMs: z.number().int().positive().default(30_000),
    })
    .optional(),
});
export type ToolExecuteRequest = z.infer<typeof ToolExecuteRequestSchema>;

export const ToolExecuteResponseSchema = z.object({
  executionId: z.string().min(1),
  output: z.unknown(),
  tool: z.string(),
  version: z.string().optional(),
  capability: z.string().optional(),
  status: z.enum(["SUCCEEDED", "FAILED", "CANCELLED", "ACCEPTED", "RUNNING"]),
  latencyMs: z.number().nonnegative(),
  correlationId: z.string().optional(),
  tenantId: TenantIdSchema.optional(),
  attempts: z.number().int().positive().optional(),
  streamUrl: z.string().optional(),
});
export type ToolExecuteResponse = z.infer<typeof ToolExecuteResponseSchema>;

export const ToolCancelRequestSchema = z.object({
  executionId: z.string().min(1),
  reason: z.string().optional(),
});
export type ToolCancelRequest = z.infer<typeof ToolCancelRequestSchema>;

export const ToolConfigurationUpsertSchema = z.object({
  values: z.record(z.unknown()),
  secrets: z.record(z.string()).optional(),
});
export type ToolConfigurationUpsert = z.infer<typeof ToolConfigurationUpsertSchema>;

export const ToolPermissionGrantSchema = z.object({
  principal: z.string().min(1),
  principalType: z.enum(["USER", "ROLE", "AGENT", "SERVICE"]),
  permission: z.string().min(1),
  effect: ToolPermissionEffectSchema.default("ALLOW"),
  attributes: z.record(z.unknown()).optional(),
});
export type ToolPermissionGrant = z.infer<typeof ToolPermissionGrantSchema>;

export const ToolAuditRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: TenantIdSchema,
  toolId: z.string().min(1),
  toolName: z.string().min(1),
  action: z.string().min(1),
  actor: z.string().optional(),
  correlationId: z.string().optional(),
  executionId: z.string().optional(),
  result: z.enum(["SUCCESS", "FAILURE", "DENIED"]).optional(),
  details: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});
export type ToolAuditRecord = z.infer<typeof ToolAuditRecordSchema>;

export const ToolHealthListResponseSchema = z.object({
  tools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      health: ToolHealthSchema,
    }),
  ),
  tenantId: TenantIdSchema,
  checkedAt: z.string().datetime(),
});
export type ToolHealthListResponse = z.infer<typeof ToolHealthListResponseSchema>;

export const ToolMetricsListResponseSchema = z.object({
  tools: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      metrics: ToolMetricsSnapshotSchema,
    }),
  ),
  tenantId: TenantIdSchema,
  windowStart: z.string().datetime().optional(),
  windowEnd: z.string().datetime().optional(),
});
export type ToolMetricsListResponse = z.infer<typeof ToolMetricsListResponseSchema>;

export const ToolListResponseSchema = z.object({
  tools: z.array(ToolCardSchema),
  count: z.number().int().nonnegative(),
  tenantId: TenantIdSchema,
});
export type ToolListResponse = z.infer<typeof ToolListResponseSchema>;
