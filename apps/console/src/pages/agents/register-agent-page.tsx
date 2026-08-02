import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { PageMotion } from "@/pages/shared/page-motion";
import { PermissionGate } from "@/components/permission-gate";
import { registerAgent } from "@/api/mesh";
import { ApiClientError } from "@/api/client";
import { queryKeys } from "@/constants/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { can } from "@/lib/permissions";
import type { RegisterAgentRequest } from "@/models/mesh";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "@/components/ui";

function parseCsv(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function RegisterAgentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenantId = useAuthStore((s) => s.tenantId);
  const subject = useAuthStore((s) => s.subject);
  const role = useAuthStore((s) => s.role);

  const [name, setName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [owner, setOwner] = useState(subject ?? "platform");
  const [projectId, setProjectId] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:9001");
  const [capabilities, setCapabilities] = useState("research.web");
  const [tools, setTools] = useState("");
  const [timeoutMs, setTimeoutMs] = useState("30000");
  const [weight, setWeight] = useState("100");
  const [labelsJson, setLabelsJson] = useState('{"team":"platform"}');

  const allowed = can(role, "register_agent") || role === null;

  const mutation = useMutation({
    mutationFn: async () => {
      let labels: Record<string, string> | undefined;
      if (labelsJson.trim()) {
        const parsed = JSON.parse(labelsJson) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Labels must be a JSON object");
        }
        labels = parsed as Record<string, string>;
      }

      const caps = parseCsv(capabilities);
      if (!name.trim()) throw new Error("Agent name is required");
      if (!caps.length) throw new Error("At least one capability is required");
      if (!baseUrl.trim()) throw new Error("Base URL is required");

      const body: RegisterAgentRequest = {
        baseUrl: baseUrl.trim(),
        weight: Number(weight) || 100,
        card: {
          apiVersion: "agentsphere.io/v1",
          kind: "AgentCard",
          metadata: {
            name: name.trim(),
            version: version.trim() || "1.0.0",
            owner: owner.trim() || "platform",
            tenantId,
            ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
            ...(labels ? { labels } : {}),
          },
          spec: {
            capabilities: caps,
            inputSchema: { type: "object" },
            outputSchema: { type: "object" },
            endpoints: { invoke: "/v1/invoke" },
            resources: { timeoutMs: Number(timeoutMs) || 30_000 },
            tools: parseCsv(tools),
          },
        },
      };

      return registerAgent(body);
    },
    onSuccess: async (result) => {
      toast.success(`Agent ${result.agentName} ${result.status.toLowerCase()}`);
      await queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tenants.all });
      navigate(`/agents/${result.instanceId}`);
    },
    onError: (err) => {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Registration failed";
      toast.error(message);
    },
  });

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Register agent"
          description="Map an agent into the active tenant. The agent card tenantId is stamped from your session and cannot be overridden here."
          actions={
            <Button variant="outline" asChild>
              <Link to="/agents">Back to registry</Link>
            </Button>
          }
        />

        {!allowed ? (
          <PermissionGate
            minRole="developer"
            fallback={
              <div className="rounded-lg border border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                Registering agents requires the developer or admin role. Issue a token on the
                Security page first.
              </div>
            }
          >
            <div />
          </PermissionGate>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Agent card
                </CardTitle>
                <CardDescription>
                  Active tenant: <span className="font-mono text-foreground">{tenantId}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-name">Name</Label>
                    <Input
                      id="agent-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="researcher"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-version">Version</Label>
                    <Input
                      id="agent-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-owner">Owner</Label>
                    <Input
                      id="agent-owner"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-project">Project ID (optional)</Label>
                    <Input
                      id="agent-project"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                      placeholder="search"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-baseurl">Base URL</Label>
                  <Input
                    id="agent-baseurl"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="http://researcher:9001"
                  />
                  <p className="text-xs text-muted-foreground">
                    Reachable invoke endpoint host for the mesh runtime. Instance must expose{" "}
                    <code>/v1/invoke</code>.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-caps">Capabilities</Label>
                  <Textarea
                    id="agent-caps"
                    value={capabilities}
                    onChange={(e) => setCapabilities(e.target.value)}
                    rows={3}
                    placeholder="research.web, summarize.short"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-tools">Tools (optional)</Label>
                  <Input
                    id="agent-tools"
                    value={tools}
                    onChange={(e) => setTools(e.target.value)}
                    placeholder="web.search"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="agent-timeout">Timeout (ms)</Label>
                    <Input
                      id="agent-timeout"
                      value={timeoutMs}
                      onChange={(e) => setTimeoutMs(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agent-weight">Weight</Label>
                    <Input
                      id="agent-weight"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="agent-labels">Labels (JSON)</Label>
                  <Textarea
                    id="agent-labels"
                    value={labelsJson}
                    onChange={(e) => setLabelsJson(e.target.value)}
                    rows={3}
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" asChild>
                    <Link to="/tenants">Manage tenants</Link>
                  </Button>
                  <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
                    {mutation.isPending ? "Registering…" : "Register into tenant"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>How mapping works</CardTitle>
                <CardDescription>Tenant binding is enforced by the registry.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  1. Create the organization on <Link className="text-primary underline" to="/tenants">Tenants</Link>.
                </p>
                <p>
                  2. Switch the top-bar tenant (or use Switch on the tenants table).
                </p>
                <p>
                  3. Register the agent here — <code className="text-foreground">metadata.tenantId</code>{" "}
                  is set to <span className="font-mono text-foreground">{tenantId}</span>.
                </p>
                <p>
                  4. Discovery, invoke, memory, and the registry list are filtered to that tenant.
                </p>
                <p className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                  Tip: for local sidecars, keep using the Agent SDK with{" "}
                  <code>AS_TENANT_ID</code>. This form is for operator onboarding of remote
                  endpoints into the active tenant.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </PageMotion>
    </PageContainer>
  );
}
