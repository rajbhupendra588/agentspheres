import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkflow, listWorkflows, runResearchSynthesize } from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";

export function useWorkflows() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.workflows.list(tenantId),
    queryFn: ({ signal }) => listWorkflows(signal),
  });
}

export function useWorkflow(runId: string | undefined) {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.workflows.detail(tenantId, runId ?? ""),
    queryFn: ({ signal }) => {
      if (!runId) {
        throw new Error("runId is required");
      }
      return getWorkflow(runId, signal);
    },
    enabled: Boolean(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "RUNNING" ? 3_000 : false;
    },
  });
}

export function useRunResearchSynthesize() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ topic, sessionId }: { topic: string; sessionId?: string }) =>
      runResearchSynthesize(topic, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.workflows.all });
    },
  });
}
