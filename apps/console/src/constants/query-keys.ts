export const queryKeys = {
  mesh: {
    all: ["mesh"] as const,
    health: (tenantId: string) => [...queryKeys.mesh.all, "health", tenantId] as const,
  },
  agents: {
    all: ["agents"] as const,
    lists: () => [...queryKeys.agents.all, "list"] as const,
    list: (tenantId: string) => [...queryKeys.agents.lists(), tenantId] as const,
    details: () => [...queryKeys.agents.all, "detail"] as const,
    detail: (tenantId: string, instanceId: string) =>
      [...queryKeys.agents.details(), tenantId, instanceId] as const,
  },
  discovery: {
    all: ["discovery"] as const,
    query: (params: Record<string, unknown>) =>
      [...queryKeys.discovery.all, params] as const,
  },
  runtime: {
    all: ["runtime"] as const,
    capabilities: () => [...queryKeys.runtime.all, "capabilities"] as const,
  },
  tools: {
    all: ["tools"] as const,
    lists: () => [...queryKeys.tools.all, "list"] as const,
    list: (tenantId: string) => [...queryKeys.tools.lists(), tenantId] as const,
  },
  workflows: {
    all: ["workflows"] as const,
    lists: () => [...queryKeys.workflows.all, "list"] as const,
    list: (tenantId: string) => [...queryKeys.workflows.lists(), tenantId] as const,
    details: () => [...queryKeys.workflows.all, "detail"] as const,
    detail: (tenantId: string, runId: string) =>
      [...queryKeys.workflows.details(), tenantId, runId] as const,
  },
  memory: {
    all: ["memory"] as const,
    get: (params: Record<string, unknown>) =>
      [...queryKeys.memory.all, "get", params] as const,
    search: (params: Record<string, unknown>) =>
      [...queryKeys.memory.all, "search", params] as const,
  },
  auth: {
    all: ["auth"] as const,
    introspect: () => [...queryKeys.auth.all, "introspect"] as const,
  },
  tenants: {
    all: ["tenants"] as const,
    list: () => [...queryKeys.tenants.all, "list"] as const,
    detail: (tenantId: string) => [...queryKeys.tenants.all, "detail", tenantId] as const,
    members: (tenantId: string) => [...queryKeys.tenants.all, "members", tenantId] as const,
  },
} as const;
