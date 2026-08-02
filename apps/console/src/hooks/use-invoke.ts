import { useMutation } from "@tanstack/react-query";
import type { InvokeRequest } from "@agentsphere/contracts";
import { invoke } from "@/api/mesh";

export function useInvoke() {
  return useMutation({
    mutationFn: (body: InvokeRequest) => invoke(body),
  });
}
