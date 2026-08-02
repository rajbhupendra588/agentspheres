import type { MeshRole } from "@/models/mesh";
import { useAuthStore } from "@/stores/auth-store";

const roleHierarchy: Record<MeshRole, number> = {
  viewer: 1,
  agent: 2,
  developer: 3,
  admin: 4,
};

export interface PermissionGateProps {
  children: React.ReactNode;
  minRole: MeshRole;
  fallback?: React.ReactNode;
}

export function PermissionGate({ children, minRole, fallback = null }: PermissionGateProps) {
  const role = useAuthStore((s) => s.role);

  if (!role || roleHierarchy[role] < roleHierarchy[minRole]) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
