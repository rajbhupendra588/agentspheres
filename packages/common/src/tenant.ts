import {
  DEFAULT_TENANT_ID,
  PROJECT_HEADER,
  TENANT_HEADER,
  TenantIdSchema,
  ProjectIdSchema,
  type ProjectId,
  type TenantId,
} from "@agentsphere/contracts";

export { DEFAULT_TENANT_ID, TENANT_HEADER, PROJECT_HEADER };

type HeaderBag =
  | Record<string, string | string[] | undefined>
  | { [key: string]: unknown };

function headerValue(headers: HeaderBag, name: string): string | undefined {
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lower) continue;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) {
      return value[0].trim();
    }
  }
  return undefined;
}

export function resolveTenantId(
  headers: HeaderBag,
  explicit?: string | null,
  fallback: TenantId = DEFAULT_TENANT_ID,
): TenantId {
  const candidate = explicit?.trim() || headerValue(headers, TENANT_HEADER) || fallback;
  return TenantIdSchema.parse(candidate);
}

export function resolveProjectId(
  headers: HeaderBag,
  explicit?: string | null,
): ProjectId | undefined {
  const candidate = explicit?.trim() || headerValue(headers, PROJECT_HEADER);
  if (!candidate) return undefined;
  return ProjectIdSchema.parse(candidate);
}

export function tenantHeaders(
  tenantId: TenantId,
  projectId?: ProjectId,
): Record<string, string> {
  const headers: Record<string, string> = {
    [TENANT_HEADER]: tenantId,
  };
  if (projectId) {
    headers[PROJECT_HEADER] = projectId;
  }
  return headers;
}
