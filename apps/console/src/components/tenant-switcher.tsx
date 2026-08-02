import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { issueToken, listTenants } from "@/api/mesh";
import { ApiClientError } from "@/api/client";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

export function TenantSwitcher() {
  const tenantId = useAuthStore((s) => s.tenantId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const subject = useAuthStore((s) => s.subject);
  const role = useAuthStore((s) => s.role);
  const setSession = useAuthStore((s) => s.setSession);
  const setTenantContext = useAuthStore((s) => s.setTenantContext);

  const { data } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: ({ signal }) => listTenants(signal),
    staleTime: 30_000,
  });

  const tenants = useMemo(() => {
    const ids = new Set<string>(data?.tenantIds ?? data?.tenants?.map((t) => t.tenantId) ?? []);
    ids.add(tenantId);
    return [...ids].sort();
  }, [data, tenantId]);

  const labels = useMemo(() => {
    const map = new Map<string, string>();
    for (const tenant of data?.tenants ?? []) {
      map.set(tenant.tenantId, tenant.displayName);
    }
    return map;
  }, [data?.tenants]);

  const handleChange = async (newTenantId: string) => {
    if (newTenantId === tenantId) {
      return;
    }

    setTenantContext(newTenantId, null);

    if (accessToken && subject && role) {
      try {
        const response = await issueToken({
          subject,
          role,
          tenantId: newTenantId,
        });
        setSession({
          accessToken: response.accessToken,
          subject: response.subject,
          role: response.role,
          tenantId: response.tenantId,
          projectId: response.projectId,
        });
        toast.success(`Switched to tenant "${newTenantId}"`);
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : "Failed to re-issue token";
        toast.warning(`Tenant switched to "${newTenantId}" (token not refreshed: ${message})`);
      }
      return;
    }

    toast.success(`Switched to tenant "${newTenantId}"`);
  };

  return (
    <Select value={tenantId} onValueChange={(value) => void handleChange(value)}>
      <SelectTrigger className="h-8 w-[160px] text-xs" aria-label="Select tenant">
        <SelectValue placeholder="Tenant" />
      </SelectTrigger>
      <SelectContent>
        {tenants.map((tenant) => (
          <SelectItem key={tenant} value={tenant}>
            {labels.get(tenant) && labels.get(tenant) !== tenant
              ? `${labels.get(tenant)} (${tenant})`
              : tenant}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
