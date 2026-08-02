import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Shield } from "lucide-react";
import { DEFAULT_TENANT_ID } from "@agentsphere/contracts";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { issueToken, introspectToken } from "@/api/mesh";
import { ApiClientError } from "@/api/client";
import { useAuthStore } from "@/stores/auth-store";
import type { MeshRole } from "@/models/mesh";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

export function SecurityPage() {
  const {
    accessToken,
    subject,
    role,
    tenantId,
    projectId,
    setSession,
    clearSession,
  } = useAuthStore();
  const [tokenSubject, setTokenSubject] = useState("console-operator");
  const [tokenRole, setTokenRole] = useState<MeshRole>("developer");
  const [tokenTenantId, setTokenTenantId] = useState(tenantId || DEFAULT_TENANT_ID);
  const [tokenProjectId, setTokenProjectId] = useState(projectId ?? "");
  const [introspectResult, setIntrospectResult] = useState<unknown>(null);
  const [issuing, setIssuing] = useState(false);
  const [introspecting, setIntrospecting] = useState(false);

  const handleIssue = async () => {
    if (!tokenSubject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!tokenTenantId.trim()) {
      toast.error("Tenant ID is required");
      return;
    }
    setIssuing(true);
    try {
      const response = await issueToken({
        subject: tokenSubject.trim(),
        role: tokenRole,
        tenantId: tokenTenantId.trim(),
        projectId: tokenProjectId.trim() || undefined,
      });
      setSession({
        accessToken: response.accessToken,
        subject: response.subject,
        role: response.role,
        tenantId: response.tenantId,
        projectId: response.projectId,
      });
      toast.success("Token issued and session updated");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to issue token";
      toast.error(message);
    } finally {
      setIssuing(false);
    }
  };

  const handleIntrospect = async () => {
    setIntrospecting(true);
    try {
      const response = await introspectToken();
      setIntrospectResult(response);
      toast.success(response.active ? "Token is active" : "Token is inactive");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to introspect token";
      toast.error(message);
      setIntrospectResult({ error: message });
    } finally {
      setIntrospecting(false);
    }
  };

  const handleClear = () => {
    clearSession();
    setIntrospectResult(null);
    toast.success("Session cleared");
  };

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Security"
          description="JWT mesh authentication — issue tokens via /mesh/auth/v1/token. No user directory on the gateway."
        />

        <div className="mb-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <Shield className="mb-2 inline h-4 w-4" /> AgentSphere uses bearer JWTs issued by the
          auth service. The console stores the token locally and attaches it to mesh API requests.
          User CRUD is not exposed on the mesh gateway in this release.
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="h-4 w-4" />
                Issue token
              </CardTitle>
              <CardDescription>POST /mesh/auth/v1/token</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={tokenSubject}
                  onChange={(e) => setTokenSubject(e.target.value)}
                  placeholder="operator@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Tenant ID</Label>
                <Input
                  value={tokenTenantId}
                  onChange={(e) => setTokenTenantId(e.target.value)}
                  placeholder={DEFAULT_TENANT_ID}
                />
              </div>
              <div className="space-y-2">
                <Label>Project ID (optional)</Label>
                <Input
                  value={tokenProjectId}
                  onChange={(e) => setTokenProjectId(e.target.value)}
                  placeholder="my-project"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={tokenRole} onValueChange={(v) => setTokenRole(v as MeshRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="developer">developer</SelectItem>
                    <SelectItem value="agent">agent</SelectItem>
                    <SelectItem value="viewer">viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => void handleIssue()} disabled={issuing}>
                Issue &amp; set session
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Current session</CardTitle>
              <CardDescription>Stored in local persistence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accessToken ? (
                <>
                  <JsonViewer
                    data={{
                      subject,
                      role,
                      tenantId,
                      projectId,
                      tokenPreview: `${accessToken.slice(0, 20)}…`,
                    }}
                  />
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => void handleIntrospect()} disabled={introspecting}>
                      Introspect token
                    </Button>
                    <Button variant="destructive" onClick={handleClear}>
                      Clear session
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No active session. Issue a token to authenticate mesh requests.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {introspectResult !== null && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Introspection result</CardTitle>
              <CardDescription>GET /mesh/auth/v1/introspect</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer data={introspectResult} />
            </CardContent>
          </Card>
        )}
      </PageMotion>
    </PageContainer>
  );
}
