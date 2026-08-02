import type {
  ApiErrorBody,
  DiscoveryQuery,
  DiscoveryResult,
  InvokeRequest,
  InvokeResponse,
  MemoryRecord,
  MemoryScope,
  ToolDefinition,
  ToolExecuteRequest,
  ToolExecuteResponse,
} from "@agentsphere/contracts";

export type { ApiErrorBody, DiscoveryQuery, DiscoveryResult, InvokeRequest, InvokeResponse, MemoryRecord, ToolDefinition };

export type MeshAggregateStatus = "ok" | "degraded";

export interface MeshServiceHealth {
  name: string;
  url: string;
  status: "ok" | "error";
  detail: unknown;
}

export interface MeshHealth {
  status: MeshAggregateStatus;
  ts: string;
  services: MeshServiceHealth[];
}

export type WorkflowStepStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export interface WorkflowStep {
  name: string;
  status: WorkflowStepStatus;
  output?: unknown;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export type WorkflowRunStatus = "RUNNING" | "SUCCEEDED" | "FAILED";

export interface WorkflowRun {
  runId: string;
  workflowType: string;
  status: WorkflowRunStatus;
  topic?: string;
  sessionId?: string;
  steps: WorkflowStep[];
  result?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowsListResponse {
  workflows: WorkflowRun[];
}

export interface CapabilitiesResponse {
  capabilities: string[];
  count: number;
  resolvedAt: string;
}

export interface ToolsListResponse {
  tools: ToolDefinition[];
  count: number;
}

export interface RegisterToolResponse {
  tool: ToolDefinition;
  status: "REGISTERED";
}

export interface MemoryGetResponse {
  record: MemoryRecord;
}

export interface MemorySearchRequest {
  query: string;
  scope?: MemoryScope;
  workspaceId?: string;
  limit?: number;
}

export interface MemorySearchResponse {
  records: MemoryRecord[];
  count: number;
  query: string;
}

export type MeshRole = "admin" | "developer" | "agent" | "viewer";

export interface TokenRequest {
  subject: string;
  role?: MeshRole;
  tenantId: string;
  projectId?: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
  tenantId: string;
  projectId?: string;
  role: MeshRole;
  subject: string;
}

export interface TokenIntrospectResponse {
  active: boolean;
  subject?: string;
  role?: MeshRole;
  tenantId?: string;
  projectId?: string;
  exp?: number;
}

export type TenantStatus = "active" | "suspended";

export interface TenantRecord {
  tenantId: string;
  displayName: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
  agentCount?: number;
  memberCount?: number;
}

export interface TenantsListResponse {
  tenants: TenantRecord[];
  tenantIds: string[];
  count: number;
}

export interface CreateTenantRequest {
  tenantId: string;
  displayName?: string;
}

export interface TenantMember {
  subject: string;
  role: MeshRole;
  tenantId: string;
  createdAt: string;
}

export interface TenantMembersResponse {
  tenantId: string;
  members: TenantMember[];
  count: number;
}

export interface InviteTenantMemberRequest {
  subject: string;
  role?: MeshRole;
}

export interface RegisterAgentRequest {
  card: {
    apiVersion: "agentsphere.io/v1";
    kind: "AgentCard";
    metadata: {
      name: string;
      version: string;
      owner: string;
      tenantId: string;
      projectId?: string;
      labels?: Record<string, string>;
    };
    spec: {
      capabilities: string[];
      inputSchema: Record<string, unknown>;
      outputSchema: Record<string, unknown>;
      endpoints: { invoke: string };
      resources: { timeoutMs: number };
      tools: string[];
    };
  };
  baseUrl: string;
  instanceId?: string;
  weight?: number;
}

export interface RegisterAgentResponse {
  instanceId: string;
  agentName: string;
  version: string;
  status: "REGISTERED" | "UPDATED";
  registeredAt: string;
}

export interface MeshEvent {
  id: string;
  type: string;
  payload: unknown;
  ts: string;
  tenantId?: string;
  projectId?: string;
  correlationId?: string;
}

export interface ResearchSynthesizeRequest {
  topic: string;
  sessionId?: string;
}

export interface ResearchSynthesizeResponse {
  runId: string;
  workflowType: string;
  status: WorkflowRunStatus;
  topic: string;
  sessionId?: string;
  steps: WorkflowStep[];
  result?: unknown;
}

export type { ToolExecuteRequest, ToolExecuteResponse };
