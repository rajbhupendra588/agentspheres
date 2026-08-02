import { useQuery } from "@tanstack/react-query";
import { getMeshHealth } from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";

const HEALTH_REFETCH_INTERVAL_MS = 8_000;

export function useMeshHealth() {
  const tenantId = useAuthStore((s) => s.tenantId);

  return useQuery({
    queryKey: queryKeys.mesh.health(tenantId),
    queryFn: ({ signal }) => getMeshHealth(signal),
    refetchInterval: HEALTH_REFETCH_INTERVAL_MS,
  });
}
