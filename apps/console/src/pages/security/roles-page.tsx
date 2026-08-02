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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@/components/ui";

function formatAction(action: PermissionAction): string {
  return action.replace(/_/g, " ");
}

export function RolesPage() {
  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Roles"
          description="Role → permission matrix driven by @/lib/permissions can()."
        />

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background">Action</TableHead>
                {MESH_ROLES.map((role) => (
                  <TableHead key={role} className="text-center capitalize">
                    {role}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSION_ACTIONS.map((action) => (
                <TableRow key={action}>
                  <TableCell className="sticky left-0 bg-background font-medium capitalize">
                    {formatAction(action)}
                  </TableCell>
                  {MESH_ROLES.map((role) => {
                    const allowed = can(role as MeshRole, action);
                    return (
                      <TableCell key={role} className="text-center">
                        <Badge variant={allowed ? "default" : "outline"}>
                          {allowed ? "Allow" : "Deny"}
                        </Badge>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PageMotion>
    </PageContainer>
  );
}
