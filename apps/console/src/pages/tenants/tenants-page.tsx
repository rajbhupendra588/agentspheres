import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Building2, Plus, UserPlus } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { PermissionGate } from "@/components/permission-gate";
import { PageMotion } from "@/pages/shared/page-motion";
import {
  createTenant,
  inviteTenantMember,
  listTenantMembers,
  listTenants,
} from "@/api/mesh";
import { ApiClientError } from "@/api/client";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { can } from "@/lib/permissions";
import { formatRelative } from "@/utils/format";
import type { MeshRole, TenantRecord } from "@/models/mesh";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

export function TenantsPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.role);
  const setTenantContext = useAuthStore((s) => s.setTenantContext);
  const canManage = can(role, "manage_tenants") || role === null;

  const [createOpen, setCreateOpen] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTenantId, setInviteTenantId] = useState<string | null>(null);
  const [inviteSubject, setInviteSubject] = useState("");
  const [inviteRole, setInviteRole] = useState<MeshRole>("developer");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.tenants.list(),
    queryFn: ({ signal }) => listTenants(signal),
  });

  const membersQuery = useQuery({
    queryKey: queryKeys.tenants.members(inviteTenantId ?? ""),
    queryFn: ({ signal }) => listTenantMembers(inviteTenantId!, signal),
    enabled: Boolean(inviteTenantId) && inviteOpen,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createTenant({
        tenantId: tenantId.trim(),
        displayName: displayName.trim() || undefined,
      }),
    onSuccess: async (tenant) => {
      toast.success(`Tenant "${tenant.tenantId}" created`);
      setCreateOpen(false);
      setTenantId("");
      setDisplayName("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to create tenant");
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      inviteTenantMember(inviteTenantId!, {
        subject: inviteSubject.trim(),
        role: inviteRole,
      }),
    onSuccess: async (member) => {
      toast.success(`Invited ${member.subject} as ${member.role}`);
      setInviteSubject("");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.tenants.members(inviteTenantId!),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.list() });
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to invite member");
    },
  });

  const tenants = useMemo(() => data?.tenants ?? [], [data?.tenants]);

  const openInvite = (tenant: TenantRecord) => {
    setInviteTenantId(tenant.tenantId);
    setInviteOpen(true);
  };

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Tenants"
          description="Create organizations, invite members, and switch the active tenant for mesh operations."
          actions={
            canManage ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create tenant
              </Button>
            ) : (
              <PermissionGate minRole="admin">
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create tenant
                </Button>
              </PermissionGate>
            )
          }
        />

        {!can(role, "manage_tenants") && role !== null && (
          <div className="mb-6 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            You can view tenants. Creating tenants and inviting members requires the{" "}
            <strong>admin</strong> role.
          </div>
        )}

        {isLoading ? (
          <LoadingState variant="table" />
        ) : isError ? (
          <ErrorState
            title="Failed to load tenants"
            message={error instanceof Error ? error.message : "Unknown error"}
            onRetry={() => void refetch()}
          />
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No tenants yet"
            description="Create your first organization to isolate agents, memory, and workflows."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create tenant
              </Button>
            }
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Organizations</CardTitle>
              <CardDescription>
                {tenants.length} tenant{tenants.length === 1 ? "" : "s"} in the mesh catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Agents</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.map((tenant) => (
                    <TableRow key={tenant.tenantId}>
                      <TableCell>
                        <div className="font-medium">{tenant.displayName}</div>
                        <div className="font-mono text-xs text-muted-foreground">
                          {tenant.tenantId}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                          {tenant.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{tenant.agentCount ?? 0}</TableCell>
                      <TableCell>{tenant.memberCount ?? 0}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatRelative(tenant.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setTenantContext(tenant.tenantId, null);
                              toast.success(`Active tenant set to "${tenant.tenantId}"`);
                            }}
                          >
                            Switch
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => openInvite(tenant)}>
                            <UserPlus className="h-3.5 w-3.5" />
                            Invite
                          </Button>
                          <Button size="sm" variant="ghost" asChild>
                            <Link to="/agents/register">Register agent</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create tenant</DialogTitle>
              <DialogDescription>
                Tenant IDs are permanent isolation keys (letters, numbers, `.`, `_`, `-`).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="tenant-id">Tenant ID</Label>
                <Input
                  id="tenant-id"
                  placeholder="acme"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  placeholder="Acme Corp"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!tenantId.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Creating…" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite member</DialogTitle>
              <DialogDescription>
                Add a subject + role to tenant{" "}
                <span className="font-mono">{inviteTenantId}</span>. They can then issue a JWT
                for this tenant on the Security page.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="invite-subject">Subject</Label>
                <Input
                  id="invite-subject"
                  placeholder="alice@acme.com"
                  value={inviteSubject}
                  onChange={(e) => setInviteSubject(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as MeshRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="developer">developer</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                    <SelectItem value="agent">agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {membersQuery.data && membersQuery.data.members.length > 0 && (
                <div className="rounded-md border border-border p-3">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current members
                  </p>
                  <ul className="space-y-1 text-sm">
                    {membersQuery.data.members.map((m) => (
                      <li key={m.subject} className="flex justify-between gap-2">
                        <span className="truncate">{m.subject}</span>
                        <Badge variant="outline">{m.role}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>
                Close
              </Button>
              <Button
                disabled={!inviteSubject.trim() || inviteMutation.isPending}
                onClick={() => inviteMutation.mutate()}
              >
                {inviteMutation.isPending ? "Inviting…" : "Invite"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageMotion>
    </PageContainer>
  );
}
