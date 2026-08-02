import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteTool,
  discoverTools,
  executeTool,
  getTool,
  getToolAudit,
  getToolExecutions,
  getToolsHealth,
  getToolsMetrics,
  grantToolPermission,
  listToolPermissions,
  listTools,
  registerTool,
  updateTool,
  upsertToolConfiguration,
  validateTool,
} from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";
import type {
  ToolConfigurationUpsert,
  ToolDefinition,
  ToolDiscoverQuery,
  ToolPermissionGrant,
  ToolUpdateRequest,
  ToolValidateRequest,
} from "@/models/mesh";
import type { ToolExecuteRequest } from "@agentsphere/contracts";
import { useAuthStore } from "@/stores/auth-store";

export function useTools() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.tools.list(tenantId),
    queryFn: ({ signal }) => listTools(signal),
  });
}

export function useDiscoverTools(query: ToolDiscoverQuery) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.tools.discover(tenantId, query),
    queryFn: ({ signal }) => discoverTools(query, signal),
  });
}

export function useTool(id: string | undefined) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.tools.detail(tenantId, id ?? ""),
    queryFn: ({ signal }) => {
      if (!id) throw new Error("Tool ID is required");
      return getTool(id, signal);
    },
    enabled: Boolean(id),
  });
}

export function useToolsHealth() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: queryKeys.tools.health(tenantId),
    queryFn: ({ signal }) => getToolsHealth(signal),
  });
}

export function useToolsMetrics() {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: queryKeys.tools.metrics(tenantId),
    queryFn: ({ signal }) => getToolsMetrics(signal),
  });
}

export function useToolExecutions(tool?: string) {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: queryKeys.tools.executions(tenantId, tool),
    queryFn: ({ signal }) => getToolExecutions(tool, signal),
  });
}

export function useToolAudit(toolId?: string) {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: queryKeys.tools.audit(tenantId, toolId),
    queryFn: ({ signal }) => getToolAudit(toolId, signal),
  });
}

export function useToolPermissions(toolId: string | undefined) {
  const tenantId = useAuthStore((s) => s.tenantId);
  return useQuery({
    queryKey: queryKeys.tools.permissions(tenantId, toolId ?? ""),
    queryFn: ({ signal }) => {
      if (!toolId) throw new Error("Tool ID is required");
      return listToolPermissions(toolId, signal);
    },
    enabled: Boolean(toolId),
  });
}

export function useRegisterTool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definition: ToolDefinition) => registerTool(definition),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tools.all });
    },
  });
}

export function useUpdateTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ToolUpdateRequest }) => updateTool(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tools.all }),
  });
}

export function useDeleteTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTool(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tools.all }),
  });
}

export function useExecuteTool() {
  return useMutation({
    mutationFn: (body: ToolExecuteRequest) => executeTool(body),
  });
}

export function useValidateTool() {
  return useMutation({
    mutationFn: (body: ToolValidateRequest) => validateTool(body),
  });
}

export function useUpsertToolConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ToolConfigurationUpsert }) =>
      upsertToolConfiguration(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tools.all }),
  });
}

export function useGrantToolPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ToolPermissionGrant }) =>
      grantToolPermission(id, body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.tools.all }),
  });
}
