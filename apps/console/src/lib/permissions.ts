import type { MeshRole } from "@/models/mesh";

export type PermissionAction =
  | "read"
  | "write"
  | "delete"
  | "invoke"
  | "register_agent"
  | "manage_tools"
  | "manage_workflows"
  | "manage_users"
  | "manage_tenants"
  | "manage_security"
  | "manage_config";

const DEVELOPER_ACTIONS: PermissionAction[] = [
  "read",
  "write",
  "invoke",
  "register_agent",
  "manage_tools",
  "manage_workflows",
];

const VIEWER_ACTIONS: PermissionAction[] = ["read"];

const AGENT_ACTIONS: PermissionAction[] = ["read", "invoke"];

export const MESH_ROLES: MeshRole[] = ["admin", "developer", "agent", "viewer"];

export const PERMISSION_ACTIONS: PermissionAction[] = [
  "read",
  "write",
  "delete",
  "invoke",
  "register_agent",
  "manage_tools",
  "manage_workflows",
  "manage_users",
  "manage_tenants",
  "manage_security",
  "manage_config",
];

export function can(role: MeshRole | null | undefined, action: PermissionAction): boolean {
  if (!role) {
    return false;
  }

  if (role === "admin") {
    return true;
  }

  if (role === "developer") {
    return DEVELOPER_ACTIONS.includes(action);
  }

  if (role === "viewer") {
    return VIEWER_ACTIONS.includes(action);
  }

  if (role === "agent") {
    return AGENT_ACTIONS.includes(action);
  }

  return false;
}
