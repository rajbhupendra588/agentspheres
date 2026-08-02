import { Link } from "react-router-dom";
import { BarChart3 } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useToolsMetrics } from "@/hooks/use-tools";
import { ApiClientError } from "@/api/client";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui";
import { formatLatency, formatNumber } from "@/utils/format";

export function ToolsMetricsPage() {
  const query = useToolsMetrics();
  return <PageContainer><PageMotion><PageHeader title="Tool metrics" description="Execution volume, reliability, and latency for the active tenant." actions={<Button variant="outline" asChild><Link to="/tools">Tool marketplace</Link></Button>} />
    {query.isLoading && <LoadingState variant="table" />}
    {query.isError && <ErrorState title="Tool metrics unavailable" message={query.error instanceof ApiClientError ? query.error.message : "Could not load tool metrics."} onRetry={() => void query.refetch()} />}
    {query.data && (query.data.tools.length === 0 ? <EmptyState icon={BarChart3} title="No tool metrics yet" description="Metrics appear after registered tools execute." /> : <div className="rounded-lg border"><Table><TableHeader><TableRow><TableHead>Tool</TableHead><TableHead>Total</TableHead><TableHead>Success</TableHead><TableHead>Failed</TableHead><TableHead>Error rate</TableHead><TableHead>Average latency</TableHead><TableHead>P95 latency</TableHead></TableRow></TableHeader><TableBody>{query.data.tools.map((tool) => <TableRow key={tool.id}><TableCell><Link className="font-medium text-primary hover:underline" to={`/tools/${encodeURIComponent(tool.id)}`}>{tool.name}<span className="ml-1 text-muted-foreground">v{tool.version}</span></Link></TableCell><TableCell>{formatNumber(tool.metrics.executionsTotal)}</TableCell><TableCell>{formatNumber(tool.metrics.executionsSuccess)}</TableCell><TableCell>{formatNumber(tool.metrics.executionsFailed)}</TableCell><TableCell>{tool.metrics.errorRate == null ? "—" : formatNumber(tool.metrics.errorRate, { style: "percent", maximumFractionDigits: 1 })}</TableCell><TableCell>{tool.metrics.avgLatencyMs == null ? "—" : formatLatency(tool.metrics.avgLatencyMs)}</TableCell><TableCell>{tool.metrics.p95LatencyMs == null ? "—" : formatLatency(tool.metrics.p95LatencyMs)}</TableCell></TableRow>)}</TableBody></Table></div>)}
  </PageMotion></PageContainer>;
}
