import { useQuery } from "@tanstack/react-query";
import type { DiscoveryQuery } from "@agentsphere/contracts";
import { discover } from "@/api/mesh";
import { queryKeys } from "@/constants/query-keys";

export function useDiscovery(query: DiscoveryQuery | undefined, enabled = true) {
  return useQuery({
    queryKey: queryKeys.discovery.query(query ?? {}),
    queryFn: ({ signal }) => {
      if (!query?.capability) {
        throw new Error("capability is required for discovery");
      }
      return discover(query, signal);
    },
    enabled: enabled && Boolean(query?.capability),
  });
}
