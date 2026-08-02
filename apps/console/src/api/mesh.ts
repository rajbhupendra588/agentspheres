import type { DiscoveryQuery, InvokeRequest, MemorySetRequest, ToolExecuteRequest } from "@agentsphere/contracts";
import { del, get, post, put, resolveAbsoluteGatewayUrl } from "@/api/client";
import type { AgentInstance, AgentsListResponse } from "@/models/agent";
import type {
  CapabilitiesResponse,
  CreateTenantRequest,
  DiscoveryResult,
  InviteTenantMemberRequest,
  InvokeResponse,
  MemoryGetResponse,
  MemorySearchRequest,
  MemorySearchResponse,
  MemoryRecord,
  MeshHealth,
  RegisterAgentRequest,
  RegisterAgentResponse,
  RegisterToolResponse,
  ResearchSynthesizeRequest,
  ResearchSynthesizeResponse,
  TenantMember,
  TenantMembersResponse,
  TenantRecord,
  TenantsListResponse,
  TokenIntrospectResponse,
  TokenRequest,
  TokenResponse,
  ToolDefinition,
  ToolConfigurationResponse,
  ToolDeleteResponse,
  ToolExecutionsResponse,
  ToolAuditResponse,
  ToolPermissionsResponse,
  ToolResponse,
  ToolExecuteResponse,
  WorkflowRun,
  WorkflowsListResponse,
  ToolsListResponse,
  ToolConfigurationUpsert,
  ToolDiscoverQuery,
  ToolDiscoverResponse,
  ToolHealthListResponse,
  ToolMetricsListResponse,
  ToolPermissionGrant,
  ToolUpdateRequest,
  ToolValidateRequest,
  ToolValidateResponse,
} from "@/models/mesh";
import { useAuthStore } from "@/stores/auth-store";

export function getMeshHealth(signal?: AbortSignal): Promise<MeshHealth> {
  return get<MeshHealth>("/mesh/health", { signal });
}

export function listTenants(signal?: AbortSignal): Promise<TenantsListResponse> {
  return get<TenantsListResponse>("/mesh/registry/v1/tenants", { signal });
}

export function createTenant(
  body: CreateTenantRequest,
  signal?: AbortSignal,
): Promise<TenantRecord> {
  return post<TenantRecord>("/mesh/registry/v1/tenants", body, { signal });
}

export function getTenant(tenantId: string, signal?: AbortSignal): Promise<TenantRecord> {
  return get<TenantRecord>(`/mesh/registry/v1/tenants/${encodeURIComponent(tenantId)}`, {
    signal,
  });
}

export function listTenantMembers(
  tenantId: string,
  signal?: AbortSignal,
): Promise<TenantMembersResponse> {
  return get<TenantMembersResponse>(
    `/mesh/registry/v1/tenants/${encodeURIComponent(tenantId)}/members`,
    { signal },
  );
}

export function inviteTenantMember(
  tenantId: string,
  body: InviteTenantMemberRequest,
  signal?: AbortSignal,
): Promise<TenantMember> {
  return post<TenantMember>(
    `/mesh/registry/v1/tenants/${encodeURIComponent(tenantId)}/members`,
    body,
    { signal },
  );
}

export function registerAgent(
  body: RegisterAgentRequest,
  signal?: AbortSignal,
): Promise<RegisterAgentResponse> {
  return post<RegisterAgentResponse>("/mesh/registry/v1/register", body, { signal });
}

export function listAgents(signal?: AbortSignal): Promise<AgentsListResponse> {
  return get<AgentsListResponse>("/mesh/registry/v1/agents", { signal });
}

export function getAgent(instanceId: string, signal?: AbortSignal): Promise<AgentInstance> {
  return get<AgentInstance>(`/mesh/registry/v1/agents/${encodeURIComponent(instanceId)}`, {
    signal,
  });
}

export function discover(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryResult> {
  const { tenantId } = useAuthStore.getState();
  const enrichedQuery: DiscoveryQuery = {
    ...query,
    tenant: query.tenant ?? tenantId,
  };
  const hasLabels =
    enrichedQuery.labels !== undefined && Object.keys(enrichedQuery.labels).length > 0;

  if (hasLabels) {
    return post<DiscoveryResult>("/mesh/discovery/v1/discover", enrichedQuery, { signal });
  }

  const params: Record<string, string> = {
    capability: enrichedQuery.capability,
  };

  if (enrichedQuery.version) {
    params.version = enrichedQuery.version;
  }
  if (enrichedQuery.tenant) {
    params.tenant = enrichedQuery.tenant;
  }
  if (enrichedQuery.limit !== undefined) {
    params.limit = String(enrichedQuery.limit);
  }

  return get<DiscoveryResult>("/mesh/discovery/v1/discover", { signal, params });
}

export function invoke(body: InvokeRequest, signal?: AbortSignal): Promise<InvokeResponse> {
  return post<InvokeResponse>("/mesh/runtime/v1/invoke", body, { signal });
}

export function listCapabilities(signal?: AbortSignal): Promise<CapabilitiesResponse> {
  return get<CapabilitiesResponse>("/mesh/runtime/v1/capabilities", { signal });
}

export function listTools(signal?: AbortSignal): Promise<ToolsListResponse> {
  return get<ToolsListResponse>("/mesh/tools/v1/tools", { signal });
}

export function discoverTools(
  query: ToolDiscoverQuery,
  signal?: AbortSignal,
): Promise<ToolDiscoverResponse> {
  const params: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    params[key] = Array.isArray(value) ? value.join(",") : value;
  }

  return get<ToolDiscoverResponse>("/mesh/tools/v1/tools/discover", { signal, params });
}

export function getTool(id: string, signal?: AbortSignal): Promise<ToolResponse> {
  return get<ToolResponse>(`/mesh/tools/v1/tools/${encodeURIComponent(id)}`, { signal });
}

export function registerTool(
  definition: ToolDefinition,
  signal?: AbortSignal,
): Promise<RegisterToolResponse> {
  return post<RegisterToolResponse>("/mesh/tools/v1/tools", definition, { signal });
}

export function updateTool(
  id: string,
  body: ToolUpdateRequest,
  signal?: AbortSignal,
): Promise<RegisterToolResponse> {
  return put<RegisterToolResponse>(`/mesh/tools/v1/tools/${encodeURIComponent(id)}`, body, { signal });
}

export function deleteTool(id: string, signal?: AbortSignal): Promise<ToolDeleteResponse> {
  return del<ToolDeleteResponse>(`/mesh/tools/v1/tools/${encodeURIComponent(id)}`, { signal });
}

export function validateTool(
  body: ToolValidateRequest,
  signal?: AbortSignal,
): Promise<ToolValidateResponse> {
  return post<ToolValidateResponse>("/mesh/tools/v1/tools/validate", body, { signal });
}

export function getToolsHealth(signal?: AbortSignal): Promise<ToolHealthListResponse> {
  return get<ToolHealthListResponse>("/mesh/tools/v1/tools/health", { signal });
}

export function getToolsMetrics(signal?: AbortSignal): Promise<ToolMetricsListResponse> {
  return get<ToolMetricsListResponse>("/mesh/tools/v1/tools/metrics", { signal });
}

export function getToolExecutions(
  tool?: string,
  signal?: AbortSignal,
): Promise<ToolExecutionsResponse> {
  return get<ToolExecutionsResponse>("/mesh/tools/v1/tools/executions", {
    signal,
    params: tool ? { tool } : undefined,
  });
}

export function getToolAudit(toolId?: string, signal?: AbortSignal): Promise<ToolAuditResponse> {
  return get<ToolAuditResponse>("/mesh/tools/v1/tools/audit", {
    signal,
    params: toolId ? { toolId } : undefined,
  });
}

export function upsertToolConfiguration(
  id: string,
  body: ToolConfigurationUpsert,
  signal?: AbortSignal,
): Promise<ToolConfigurationResponse> {
  return put<ToolConfigurationResponse>(
    `/mesh/tools/v1/tools/${encodeURIComponent(id)}/configuration`,
    body,
    { signal },
  );
}

export function grantToolPermission(
  id: string,
  body: ToolPermissionGrant,
  signal?: AbortSignal,
): Promise<{ ok: boolean; toolId: string; grant: ToolPermissionGrant }> {
  return post<{ ok: boolean; toolId: string; grant: ToolPermissionGrant }>(
    `/mesh/tools/v1/tools/${encodeURIComponent(id)}/permissions`,
    body,
    { signal },
  );
}

export function listToolPermissions(
  id: string,
  signal?: AbortSignal,
): Promise<ToolPermissionsResponse> {
  return get<ToolPermissionsResponse>(
    `/mesh/tools/v1/tools/${encodeURIComponent(id)}/permissions`,
    { signal },
  );
}

export function executeTool(
  body: ToolExecuteRequest,
  signal?: AbortSignal,
): Promise<ToolExecuteResponse> {
  return post<ToolExecuteResponse>("/mesh/tools/v1/execute", body, { signal });
}

export function listWorkflows(signal?: AbortSignal): Promise<WorkflowsListResponse> {
  return get<WorkflowsListResponse>("/mesh/workflow/v1/workflows", { signal });
}

export function getWorkflow(runId: string, signal?: AbortSignal): Promise<WorkflowRun> {
  return get<WorkflowRun>(`/mesh/workflow/v1/workflows/${encodeURIComponent(runId)}`, {
    signal,
  });
}

export function runResearchSynthesize(
  topic: string,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<ResearchSynthesizeResponse> {
  const body: ResearchSynthesizeRequest = { topic, sessionId };
  return post<ResearchSynthesizeResponse>(
    "/mesh/workflow/v1/workflows/research-synthesize",
    body,
    { signal },
  );
}

export function memoryGet(
  body: {
    key: string;
    scope: MemoryRecord["scope"];
    tenantId?: string;
    projectId?: string;
    sessionId?: string;
    agentName?: string;
    workspaceId?: string;
  },
  signal?: AbortSignal,
): Promise<MemoryGetResponse> {
  const { tenantId, projectId } = useAuthStore.getState();
  return post<MemoryGetResponse>(
    "/mesh/memory/v1/memory/get",
    {
      ...body,
      tenantId: body.tenantId ?? tenantId,
      projectId: body.projectId ?? projectId ?? undefined,
    },
    { signal },
  );
}

export function memorySet(
  body: Omit<MemorySetRequest, "tenantId"> & { tenantId?: string },
  signal?: AbortSignal,
): Promise<MemoryRecord> {
  const { tenantId, projectId } = useAuthStore.getState();
  const payload: MemorySetRequest = {
    ...body,
    tenantId: body.tenantId ?? tenantId,
    projectId: body.projectId ?? projectId ?? undefined,
  };
  return put<MemoryRecord>("/mesh/memory/v1/memory", payload, { signal });
}

export function memorySearch(
  body: MemorySearchRequest,
  signal?: AbortSignal,
): Promise<MemorySearchResponse> {
  return post<MemorySearchResponse>("/mesh/memory/v1/memory/search", body, { signal });
}

/** Mint via console server so AS_BOOTSTRAP_SECRET never reaches the browser. */
export function issueToken(body: TokenRequest, signal?: AbortSignal): Promise<TokenResponse> {
  return post<TokenResponse>("/api/auth/token", body, { signal });
}

export function introspectToken(signal?: AbortSignal): Promise<TokenIntrospectResponse> {
  return get<TokenIntrospectResponse>("/mesh/auth/v1/introspect", { signal });
}

export function createEventSource(): EventSource {
  const url = resolveAbsoluteGatewayUrl("/mesh/notify/v1/events");
  return new EventSource(url);
}
