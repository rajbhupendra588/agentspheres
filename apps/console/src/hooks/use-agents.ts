import { useQuery } from "@tanstack/react-query";
import { getAgent, listAgents } from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";

export function useAgents() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.agents.list(tenantId),
    queryFn: ({ signal }) => listAgents(signal),
  });
}

export function useAgent(instanceId: string | undefined) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.agents.detail(tenantId, instanceId ?? ""),
    queryFn: ({ signal }) => {
      if (!instanceId) {
        throw new Error("instanceId is required");
      }
      return getAgent(instanceId, signal);
    },
    enabled: Boolean(instanceId),
  });
}
