import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Play, Save, ShieldPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PermissionGate } from "@/components/permission-gate";
import { MonacoEditor } from "@/components/monaco-editor";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import {
  useDeleteTool,
  useExecuteTool,
  useGrantToolPermission,
  useTool,
  useToolAudit,
  useToolExecutions,
  useToolPermissions,
  useToolsHealth,
  useToolsMetrics,
  useUpsertToolConfiguration,
} from "@/hooks/use-tools";
import { ApiClientError } from "@/api/client";
import {
  Badge,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

export function ToolDetailsPage() {
  const { toolName } = useParams<{ toolName: string }>();
  const navigate = useNavigate();
  const toolId = toolName ? decodeURIComponent(toolName) : "";
  const toolQuery = useTool(toolId);
  const executeTool = useExecuteTool();
  const configureTool = useUpsertToolConfiguration();
  const grantPermission = useGrantToolPermission();
  const deleteTool = useDeleteTool();
  const [execInput, setExecInput] = useState('{\n  \n}');
  const [execResult, setExecResult] = useState<unknown>(null);
  const [configValues, setConfigValues] = useState("{}");
  const [configSecrets, setConfigSecrets] = useState("{}");
  const [principal, setPrincipal] = useState("");
  const [permission, setPermission] = useState("execute");
  const [principalType, setPrincipalType] = useState<"USER" | "ROLE" | "AGENT" | "SERVICE">("ROLE");
  const tool = toolQuery.data?.tool;
  const metricsQuery = useToolsMetrics();
  const healthQuery = useToolsHealth();
  const executionsQuery = useToolExecutions(tool?.name);
  const auditQuery = useToolAudit(tool?.id);
  const permissionsQuery = useToolPermissions(tool?.id);
  const toolMetrics = useMemo(
    () => metricsQuery.data?.tools.find((item) => item.id === tool?.id),
    [metricsQuery.data?.tools, tool?.id],
  );
  const toolHealth = useMemo(
    () => healthQuery.data?.tools.find((item) => item.id === tool?.id),
    [healthQuery.data?.tools, tool?.id],
  );

  const handleExecute = async () => {
    if (!tool) return;
    let input: unknown;
    try {
      input = JSON.parse(execInput);
    } catch {
      toast.error("Input must be valid JSON");
      return;
    }
    try {
      const result = await executeTool.mutateAsync({ tool: tool.name, input, mode: "SYNC" });
      setExecResult(result);
      toast.success(`Executed in ${result.latencyMs} ms`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to execute tool");
    }
  };

  const handleConfigure = async () => {
    if (!tool) return;
    try {
      const values = JSON.parse(configValues) as Record<string, unknown>;
      const secrets = JSON.parse(configSecrets) as Record<string, string>;
      await configureTool.mutateAsync({ id: tool.id, body: { values, secrets } });
      toast.success("Tool configuration saved");
    } catch (err) {
      toast.error(err instanceof SyntaxError ? "Configuration values and secrets must be valid JSON" : "Failed to save configuration");
    }
  };

  const handleGrant = async () => {
    if (!tool || !principal.trim() || !permission.trim()) {
      toast.error("Principal and permission are required");
      return;
    }
    try {
      await grantPermission.mutateAsync({
        id: tool.id,
        body: { principal: principal.trim(), principalType, permission: permission.trim(), effect: "ALLOW" },
      });
      setPrincipal("");
      await permissionsQuery.refetch();
      toast.success("Permission granted");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to grant permission");
    }
  };

  const handleDelete = async () => {
    if (!tool || !window.confirm(`Delete ${tool.name}? This cannot be undone.`)) return;
    try {
      await deleteTool.mutateAsync(tool.id);
      toast.success(`Deleted ${tool.name}`);
      navigate("/tools");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to delete tool");
    }
  };

  return (
    <PageContainer>
      <PageMotion>
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to="/tools"><ArrowLeft className="h-4 w-4" />Back to tools</Link>
        </Button>
        {toolQuery.isLoading && <LoadingState />}
        {toolQuery.isError && <ErrorState title="Tool registry unavailable" message={toolQuery.error instanceof ApiClientError ? toolQuery.error.message : "Could not reach the mesh tool engine."} onRetry={() => void toolQuery.refetch()} />}
        {!toolQuery.isLoading && !toolQuery.isError && !tool && <EmptyState title="Tool not found" description={`No tool matching "${toolId}" is registered on the mesh.`} action={<Button variant="outline" asChild><Link to="/tools">Browse tools</Link></Button>} />}
        {tool && (
          <>
            <PageHeader
              title={tool.name}
              description={`${tool.owner} · ${tool.category.replaceAll("_", " ")} · v${tool.version}`}
              actions={<div className="flex gap-2"><Badge variant={tool.lifecycle === "ACTIVE" ? "success" : "warning"}>{tool.lifecycle}</Badge><PermissionGate minRole="admin"><Button variant="outline" size="sm" onClick={() => void handleDelete()} disabled={deleteTool.isPending}><Trash2 className="h-4 w-4" />Delete</Button></PermissionGate></div>}
            />
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="flex h-auto flex-wrap justify-start">
                <TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="configuration">Configuration</TabsTrigger><TabsTrigger value="metrics">Metrics</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger><TabsTrigger value="executions">Execution history</TabsTrigger><TabsTrigger value="permissions">Permissions</TabsTrigger><TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Version" value={tool.version} />
                  <StatCard label="Owner" value={tool.owner} />
                  <StatCard label="Health" value={toolHealth?.health.status ?? tool.health?.status ?? "UNKNOWN"} />
                  <StatCard label="Executions" value={String(toolMetrics?.metrics.executionsTotal ?? 0)} />
                </div>
                <Card><CardHeader><CardTitle>Tool Card</CardTitle><CardDescription>Published metadata, capabilities, and schemas</CardDescription></CardHeader><CardContent><JsonViewer data={tool} /></CardContent></Card>
              </TabsContent>
              <TabsContent value="configuration"><PermissionGate minRole="developer"><Card><CardHeader><CardTitle>Runtime configuration</CardTitle><CardDescription>Secrets are accepted but never returned by the API.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Values (JSON)</Label><MonacoEditor value={configValues} onChange={setConfigValues} height="160px" /></div><div className="space-y-2"><Label>Secrets (JSON)</Label><MonacoEditor value={configSecrets} onChange={setConfigSecrets} height="120px" /></div><Button onClick={() => void handleConfigure()} disabled={configureTool.isPending}><Save className="h-4 w-4" />Save configuration</Button></CardContent></Card></PermissionGate></TabsContent>
              <TabsContent value="metrics"><Card><CardHeader><CardTitle>Execution metrics</CardTitle><CardDescription>Aggregated metrics for this tool</CardDescription></CardHeader><CardContent><JsonViewer data={toolMetrics?.metrics ?? {}} /></CardContent></Card></TabsContent>
              <TabsContent value="health"><Card><CardHeader><CardTitle>Health status</CardTitle><CardDescription>Latest registry health report</CardDescription></CardHeader><CardContent><JsonViewer data={toolHealth?.health ?? tool.health ?? { status: "UNKNOWN" }} /></CardContent></Card></TabsContent>
              <TabsContent value="executions"><Card><CardHeader><CardTitle>Execution history</CardTitle><CardDescription>Recent executions for {tool.name}</CardDescription></CardHeader><CardContent><ExecutionTable executions={executionsQuery.data?.executions ?? []} /></CardContent></Card></TabsContent>
              <TabsContent value="permissions" className="space-y-6"><PermissionGate minRole="developer"><Card><CardHeader><CardTitle>Grant permission</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-4"><Input value={principal} onChange={(event) => setPrincipal(event.target.value)} placeholder="Principal" /><Select value={principalType} onValueChange={(value) => setPrincipalType(value as typeof principalType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="USER">User</SelectItem><SelectItem value="ROLE">Role</SelectItem><SelectItem value="AGENT">Agent</SelectItem><SelectItem value="SERVICE">Service</SelectItem></SelectContent></Select><Input value={permission} onChange={(event) => setPermission(event.target.value)} placeholder="Permission" /><Button onClick={() => void handleGrant()} disabled={grantPermission.isPending}><ShieldPlus className="h-4 w-4" />Grant</Button></CardContent></Card></PermissionGate><Card><CardHeader><CardTitle>Assigned permissions</CardTitle></CardHeader><CardContent>{(permissionsQuery.data?.permissions.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No permissions assigned.</p> : <JsonViewer data={permissionsQuery.data?.permissions} />}</CardContent></Card></TabsContent>
              <TabsContent value="audit"><Card><CardHeader><CardTitle>Audit trail</CardTitle><CardDescription>Recorded lifecycle and access events</CardDescription></CardHeader><CardContent>{(auditQuery.data?.records.length ?? 0) === 0 ? <p className="text-sm text-muted-foreground">No audit records.</p> : <JsonViewer data={auditQuery.data?.records} />}</CardContent></Card></TabsContent>
            </Tabs>
            <PermissionGate minRole="developer"><Card className="mt-6"><CardHeader><CardTitle>Execute</CardTitle><CardDescription>Run this tool against the mesh tool engine</CardDescription></CardHeader><CardContent className="space-y-4"><div className="space-y-2"><Label>Input (JSON)</Label><MonacoEditor value={execInput} onChange={setExecInput} height="180px" /></div><Button onClick={() => void handleExecute()} disabled={executeTool.isPending}><Play className="h-4 w-4" />Execute</Button>{execResult !== null && <div className="space-y-2"><Label>Result</Label><JsonViewer data={execResult} /></div>}</CardContent></Card></PermissionGate>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-lg">{value}</CardTitle></CardHeader></Card>;
}

function ExecutionTable({ executions }: { executions: Array<{ id: string; status: string; startedAt: string; latencyMs?: number; attempts?: number }> }) {
  if (executions.length === 0) return <p className="text-sm text-muted-foreground">No executions recorded.</p>;
  return <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Status</TableHead><TableHead>Started</TableHead><TableHead>Latency</TableHead><TableHead>Attempts</TableHead></TableRow></TableHeader><TableBody>{executions.map((execution) => <TableRow key={execution.id}><TableCell><Badge variant={execution.status === "SUCCEEDED" ? "success" : execution.status === "FAILED" ? "error" : "neutral"}>{execution.status}</Badge></TableCell><TableCell>{new Date(execution.startedAt).toLocaleString()}</TableCell><TableCell>{execution.latencyMs == null ? "—" : `${execution.latencyMs} ms`}</TableCell><TableCell>{execution.attempts ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>;
}
