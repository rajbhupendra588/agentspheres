import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useToolsHealth } from "@/hooks/use-tools";
import { ApiClientError } from "@/api/client";
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";

function healthVariant(status: string): "success" | "warning" | "error" | "neutral" {
  return status === "HEALTHY" ? "success" : status === "DEGRADED" ? "warning" : status === "UNHEALTHY" ? "error" : "neutral";
}

export function ToolsHealthPage() {
  const query = useToolsHealth();
  return <PageContainer><PageMotion><PageHeader title="Tool health" description="Latest health checks for tools in the active tenant." actions={<Button variant="outline" asChild><Link to="/tools">Tool marketplace</Link></Button>} />
    {query.isLoading && <LoadingState variant="table" />}
    {query.isError && <ErrorState title="Tool health unavailable" message={query.error instanceof ApiClientError ? query.error.message : "Could not load tool health."} onRetry={() => void query.refetch()} />}
    {query.data && (query.data.tools.length === 0 ? <EmptyState icon={HeartPulse} title="No tool health reports" description="Register tools or wait for their health checks to be recorded." /> : <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Tool</TableHead><TableHead>Version</TableHead><TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Checked</TableHead><TableHead>Message</TableHead></TableRow></TableHeader><TableBody>{query.data.tools.map((tool) => <TableRow key={tool.id}><TableCell><Link className="font-medium text-primary hover:underline" to={`/tools/${encodeURIComponent(tool.id)}`}>{tool.name}</Link></TableCell><TableCell>{tool.version}</TableCell><TableCell><Badge variant={healthVariant(tool.health.status)}>{tool.health.status}</Badge></TableCell><TableCell>{tool.health.latencyMs == null ? "—" : `${tool.health.latencyMs} ms`}</TableCell><TableCell>{new Date(tool.health.checkedAt).toLocaleString()}</TableCell><TableCell className="max-w-xs truncate text-muted-foreground">{tool.health.message ?? "—"}</TableCell></TableRow>)}</TableBody></Table></div>)}
  </PageMotion></PageContainer>;
}
