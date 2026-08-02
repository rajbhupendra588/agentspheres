import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3 } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatLatency, formatNumber } from "@/utils/format";
import { ApiClientError } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

const STATUS_COLORS: Record<string, string> = {
  HEALTHY: "#10b981",
  UNHEALTHY: "#ef4444",
  DRAINING: "#f59e0b",
  ok: "#10b981",
  error: "#ef4444",
  RUNNING: "#3b82f6",
  SUCCEEDED: "#10b981",
  FAILED: "#ef4444",
};

function computeStepLatencies(workflows: { steps: { startedAt?: string; completedAt?: string; name: string }[] }[]) {
  const latencies: { name: string; ms: number }[] = [];
  for (const wf of workflows) {
    for (const step of wf.steps) {
      if (step.startedAt && step.completedAt) {
        const ms =
          new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime();
        if (ms >= 0) latencies.push({ name: step.name, ms });
      }
    }
  }
  return latencies;
}

export function MetricsPage() {
  const agentsQuery = useAgents();
  const healthQuery = useMeshHealth();
  const workflowsQuery = useWorkflows();

  const isLoading = agentsQuery.isLoading || healthQuery.isLoading || workflowsQuery.isLoading;
  const isError = agentsQuery.isError && healthQuery.isError;

  const agents = agentsQuery.data?.agents ?? [];
  const services = healthQuery.data?.services ?? [];
  const workflows = workflowsQuery.data?.workflows ?? [];

  const agentStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const agent of agents) {
      counts.set(agent.status, (counts.get(agent.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [agents]);

  const serviceStatusData = useMemo(() => {
    const up = services.filter((s) => s.status === "ok").length;
    const down = services.length - up;
    return [
      { name: "Up", value: up },
      { name: "Down", value: down },
    ].filter((d) => d.value > 0);
  }, [services]);

  const workflowStatusData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const wf of workflows) {
      counts.set(wf.status, (counts.get(wf.status) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [workflows]);

  const stepLatencies = useMemo(() => computeStepLatencies(workflows), [workflows]);
  const avgLatency =
    stepLatencies.length > 0
      ? stepLatencies.reduce((sum, s) => sum + s.ms, 0) / stepLatencies.length
      : null;

  const hasChartData =
    agentStatusData.length > 0 || serviceStatusData.length > 0 || workflowStatusData.length > 0;

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Metrics"
          description="Derived metrics from live mesh agents, health, and workflow runs — no synthetic time series."
        />

        {isLoading && <LoadingState variant="cards" />}

        {isError && (
          <ErrorState
            title="Metrics unavailable"
            message="Could not load mesh data. Ensure the gateway and core services are running."
            onRetry={() => {
              void agentsQuery.refetch();
              void healthQuery.refetch();
              void workflowsQuery.refetch();
            }}
          />
        )}

        {!isLoading && !isError && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Agents" value={formatNumber(agents.length)} />
              <MetricTile
                label="Services up"
                value={`${services.filter((s) => s.status === "ok").length}/${services.length}`}
              />
              <MetricTile label="Workflow runs" value={formatNumber(workflows.length)} />
              <MetricTile
                label="Avg step latency"
                value={avgLatency !== null ? formatLatency(avgLatency) : "—"}
                hint={avgLatency === null ? "Run a workflow to collect step timings" : undefined}
              />
            </div>

            {!hasChartData ? (
              <EmptyState
                icon={BarChart3}
                title="Insufficient data for charts"
                description="Register agents and run workflows via the mesh to populate metrics. Charts reflect only live registry and workflow data."
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {agentStatusData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Agents by status</CardTitle>
                      <CardDescription>From registry</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={agentStatusData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {agentStatusData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={STATUS_COLORS[entry.name] ?? "#94a3b8"}
                              />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {serviceStatusData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Mesh services</CardTitle>
                      <CardDescription>From /mesh/health</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={serviceStatusData}>
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value">
                            {serviceStatusData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={entry.name === "Up" ? STATUS_COLORS.ok : STATUS_COLORS.error}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {workflowStatusData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Workflows by status</CardTitle>
                      <CardDescription>From workflow service</CardDescription>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={workflowStatusData}>
                          <XAxis dataKey="name" />
                          <YAxis allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="value">
                            {workflowStatusData.map((entry) => (
                              <Cell
                                key={entry.name}
                                fill={STATUS_COLORS[entry.name] ?? "#94a3b8"}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {stepLatencies.length > 0 && (
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>Workflow step durations</CardTitle>
                      <CardDescription>Computed from step startedAt / completedAt timestamps</CardDescription>
                    </CardHeader>
                    <CardContent className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stepLatencies.slice(0, 20)} layout="vertical">
                          <XAxis type="number" tickFormatter={(v) => formatLatency(v)} />
                          <YAxis type="category" dataKey="name" width={120} />
                          <Tooltip formatter={(v: number) => formatLatency(v)} />
                          <Bar dataKey="ms" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {agentsQuery.isError && (
              <p className="mt-4 text-sm text-muted-foreground">
                Agent registry unavailable:{" "}
                {agentsQuery.error instanceof ApiClientError
                  ? agentsQuery.error.message
                  : "unknown error"}
              </p>
            )}
          </>
        )}

        <p className="mt-6 text-xs text-muted-foreground">
          For invoke latency, use{" "}
          <Link to="/api-explorer" className="text-primary hover:underline">
            API Explorer
          </Link>{" "}
          to run POST /mesh/runtime/v1/invoke and inspect latencyMs in the response.
        </p>
      </PageMotion>
    </PageContainer>
  );
}
