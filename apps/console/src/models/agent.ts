export type AgentStatus = "HEALTHY" | "UNHEALTHY" | "DRAINING" | string;

export interface AgentInstance {
  instanceId: string;
  agentName: string;
  version: string;
  owner: string;
  tenantId: string;
  projectId?: string;
  baseUrl: string;
  capabilities: string[];
  labels: Record<string, string>;
  weight: number;
  status: AgentStatus;
  card: unknown;
  lastHeartbeat: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentsListResponse {
  tenantId?: string;
  projectId?: string;
  agents: AgentInstance[];
  count: number;
}
