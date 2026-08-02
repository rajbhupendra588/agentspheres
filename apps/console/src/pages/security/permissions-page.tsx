import { useState } from "react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { PageMotion } from "@/pages/shared/page-motion";
import {
  can,
  MESH_ROLES,
  PERMISSION_ACTIONS,
  type PermissionAction,
} from "@/lib/permissions";
import type { MeshRole } from "@/models/mesh";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

export function PermissionsPage() {
  const [role, setRole] = useState<MeshRole>("developer");
  const [action, setAction] = useState<PermissionAction>("manage_tools");
  const allowed = can(role, action);

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Permissions"
          description="Interactive permission checker using the can() matrix."
        />

        <Card>
          <CardHeader>
            <CardTitle>Check permission</CardTitle>
            <CardDescription>Select a role and action to evaluate access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as MeshRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MESH_ROLES.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={action} onValueChange={(v) => setAction(v as PermissionAction)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERMISSION_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a.replace(/_/g, " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <span className="text-sm text-muted-foreground">
                can(<span className="font-mono">{role}</span>,{" "}
                <span className="font-mono">{action}</span>)
              </span>
              <Badge variant={allowed ? "default" : "error"} className="ml-auto">
                {allowed ? "Allowed" : "Denied"}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </PageMotion>
    </PageContainer>
  );
}
