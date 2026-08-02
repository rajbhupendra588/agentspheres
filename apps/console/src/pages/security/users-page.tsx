import { Users } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { MESH_ROLES } from "@/lib/permissions";
import { useAuthStore } from "@/stores/auth-store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: "Full platform access including security and configuration",
  developer: "Register agents, manage tools and workflows, invoke runtime",
  agent: "Service identity — read and invoke",
  viewer: "Read-only access to mesh resources",
};

export function UsersPage() {
  const { subject, role, accessToken } = useAuthStore();

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Users"
          description="Platform identity model — roles are issued via JWT, not a user directory API."
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Current session</CardTitle>
            <CardDescription>Authenticated operator from stored JWT</CardDescription>
          </CardHeader>
          <CardContent>
            {accessToken ? (
              <JsonViewer data={{ subject, role }} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Not signed in. Issue a token on the Security page.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Role model</CardTitle>
            <CardDescription>MeshRole enum from contracts — not a live user list</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {MESH_ROLES.map((r) => (
                    <TableRow key={r}>
                      <TableCell className="font-mono font-medium">{r}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {ROLE_DESCRIPTIONS[r] ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <EmptyState
          icon={Users}
          title="User directory not deployed"
          description="User directory service is not exposed on the mesh gateway yet. Identity is managed through JWT issuance at /mesh/auth/v1/token with subject and role claims."
        />
      </PageMotion>
    </PageContainer>
  );
}
