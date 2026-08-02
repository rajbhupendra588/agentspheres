import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { executeTool, listTools, registerTool } from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";
import type { ToolDefinition } from "@/models/mesh";
import type { ToolExecuteRequest } from "@agentsphere/contracts";
import { useAuthStore } from "@/stores/auth-store";

export function useTools() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.tools.list(tenantId),
    queryFn: ({ signal }) => listTools(signal),
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

export function useExecuteTool() {
  return useMutation({
    mutationFn: (body: ToolExecuteRequest) => executeTool(body),
  });
}
