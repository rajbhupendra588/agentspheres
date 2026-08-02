import type {
  ToolAuthentication,
  ToolCapability,
  ToolCard,
  ToolCategory,
  ToolConfigurationSchema,
  ToolDependency,
  ToolExecutionMode,
  ToolHealth,
  ToolHealthStatus,
  ToolLifecycleState,
  ToolMetricsSnapshot,
  ToolProtocol,
  ToolRateLimit,
  ToolCost,
  TenantId,
} from "@agentsphere/contracts";

/** Execution context injected into every tool invocation. */
export interface ToolContext {
  tenantId: TenantId;
  projectId?: string;
  correlationId: string;
  executionId: string;
  agentName?: string;
  capability?: string;
  mode: ToolExecutionMode;
  timeoutMs: number;
  attempt: number;
  configuration: Record<string, unknown>;
  secrets: Record<string, string>;
  signal: AbortSignal;
  /** Structured logger bound to tenant + execution. */
  log: {
    debug(msg: string, fields?: Record<string, unknown>): void;
    info(msg: string, fields?: Record<string, unknown>): void;
    warn(msg: string, fields?: Record<string, unknown>): void;
    error(msg: string, fields?: Record<string, unknown>): void;
  };
}

export interface ToolMetadata {
  name: string;
  description: string;
  version: string;
  owner: string;
  category: ToolCategory;
  tags?: string[];
  regions?: string[];
  permissions?: string[];
  authentication?: ToolAuthentication;
  configuration?: ToolConfigurationSchema;
  supportedProtocols?: ToolProtocol[];
  dependencies?: ToolDependency[];
  rateLimits?: ToolRateLimit;
  cost?: ToolCost;
  documentation?: string;
  endpoint?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  builtin?: boolean;
}

export interface ToolActionDescriptor {
  name: string;
  capability: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  permissions?: string[];
  executionModes?: ToolExecutionMode[];
  requiresAuthentication?: boolean;
  authSchemes?: ToolAuthentication["schemes"];
  requiresPermissions?: string[];
}

export interface ToolExecuteResult {
  output: unknown;
  metrics?: Partial<ToolMetricsSnapshot>;
}

export interface ToolValidatorResult {
  valid: boolean;
  errors: Array<{ path: string; code: string; message: string }>;
  warnings?: Array<{ path: string; code: string; message: string }>;
}

/** Core Tool interface — every ToolSphere tool implements this. */
export interface Tool {
  readonly metadata: ToolMetadata;
  readonly capabilities: ToolCapability[];
  readonly actions: ToolActionDescriptor[];

  initialize?(ctx: Pick<ToolContext, "tenantId" | "configuration" | "secrets" | "log">): Promise<void>;
  health(ctx: Pick<ToolContext, "tenantId" | "configuration" | "secrets" | "signal" | "log">): Promise<ToolHealth>;
  validate?(
    input: unknown,
    ctx: Pick<ToolContext, "tenantId" | "configuration" | "capability">,
  ): Promise<ToolValidatorResult>;
  execute(ctx: ToolContext, input: unknown): Promise<ToolExecuteResult>;
  metrics?(): Promise<ToolMetricsSnapshot | undefined>;
  shutdown?(): Promise<void>;
}

export interface ToolLifecycle {
  state: ToolLifecycleState;
  transition(to: ToolLifecycleState, reason?: string): Promise<void>;
}

export type ToolFactory = () => Tool;

export interface RegisteredToolRuntime {
  tool: Tool;
  card: ToolCard;
}

export type { ToolHealthStatus, ToolCard, ToolCapability, ToolMetadata as ToolMetadataType };
