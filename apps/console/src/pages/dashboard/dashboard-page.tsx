import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { LiveFeed } from "@/components/live-feed";
import { StatusIndicator } from "@/components/status-indicator";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { useWorkflows } from "@/hooks/use-workflows";
import { useEventsStore } from "@/stores/events-store";
import { formatNumber, formatRelative } from "@/utils/format";
import { ApiClientError } from "@/api/client";
import type { AgentInstance } from "@/models/agent";
import {
  Button,
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

function countByStatus(agents: AgentInstance[], status: string): number {
  return agents.filter((a) => a.status === status).length;
}

export function DashboardPage() {
  const healthQuery = useMeshHealth();
  const agentsQuery = useAgents();
  const workflowsQuery = useWorkflows();
  const events = useEventsStore((s) => s.events);

  const isLoading = healthQuery.isLoading || agentsQuery.isLoading || workflowsQuery.isLoading;
  const hasError = healthQuery.isError || agentsQuery.isError || workflowsQuery.isError;

  const refetchAll = () => {
    void healthQuery.refetch();
    void agentsQuery.refetch();
    void workflowsQuery.refetch();
  };

  const agents = agentsQuery.data?.agents ?? [];
  const healthyCount = countByStatus(agents, "HEALTHY");
  const unhealthyCount = countByStatus(agents, "UNHEALTHY");
  const servicesUp = healthQuery.data?.services.filter((s) => s.status === "ok").length ?? 0;
  const servicesTotal = healthQuery.data?.services.length ?? 0;
  const workflowRuns = workflowsQuery.data?.workflows.length ?? 0;
  const meshHealthy = healthQuery.data?.status === "ok";

  const recentAgents = [...agents]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 8);

  const recentEvents = events.slice(0, 25);

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Dashboard"
          description="Mesh overview, service health, and live activity."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={refetchAll}
              disabled={healthQuery.isFetching || agentsQuery.isFetching || workflowsQuery.isFetching}
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  healthQuery.isFetching || agentsQuery.isFetching || workflowsQuery.isFetching
                    ? "animate-spin"
                    : ""
                }`}
              />
              Refresh
            </Button>
          }
        />

        {isLoading && <LoadingState variant="cards" />}

        {hasError && !isLoading && (
          <ErrorState
            title="Dashboard data unavailable"
            message={
              healthQuery.error instanceof ApiClientError
                ? healthQuery.error.message
                : agentsQuery.error instanceof ApiClientError
                  ? agentsQuery.error.message
                  : workflowsQuery.error instanceof ApiClientError
                    ? workflowsQuery.error.message
                    : "Could not load mesh overview. Ensure the gateway and services are running."
            }
            onRetry={refetchAll}
          />
        )}

        {!isLoading && !hasError && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <MetricTile label="Agents" value={formatNumber(agents.length)} />
              <MetricTile label="Healthy" value={formatNumber(healthyCount)} />
              <MetricTile label="Unhealthy" value={formatNumber(unhealthyCount)} />
              <MetricTile label="Services up" value={`${servicesUp}/${servicesTotal}`} />
              <MetricTile label="Workflow runs" value={formatNumber(workflowRuns)} />
              <MetricTile
                label="Mesh status"
                value={meshHealthy ? "Healthy" : "Degraded"}
                hint={healthQuery.data ? formatRelative(healthQuery.data.ts) : undefined}
              />
            </div>

            <div className="mb-8 grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Service health</CardTitle>
                  <CardDescription>Per-service probes from the mesh gateway</CardDescription>
                </CardHeader>
                <CardContent>
                  {(healthQuery.data?.services.length ?? 0) === 0 ? (
                    <EmptyState title="No services reported" description="Health response did not include service entries." />
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {healthQuery.data!.services.map((svc) => (
                        <div
                          key={svc.name}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                        >
                          <span className="text-sm font-medium">{svc.name}</span>
                          <StatusIndicator
                            tone={svc.status === "ok" ? "success" : "error"}
                            label={svc.status}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Live feed</CardTitle>
                    <CardDescription>Recent mesh events from the notification stream</CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/events">View all</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {recentEvents.length === 0 ? (
                    <EmptyState
                      title="No events yet"
                      description="Events appear when agents register, invoke, or workflows update."
                      action={
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/events">Open event bus</Link>
                        </Button>
                      }
                    />
                  ) : (
                    <LiveFeed events={recentEvents} maxHeight="16rem" />
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">Recent agents</CardTitle>
                  <CardDescription>Latest registry updates by instance</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/agents">Full registry</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentAgents.length === 0 ? (
                  <EmptyState
                    title="No agents registered"
                    description="Start agent sidecars to populate the registry."
                    action={
                      <Button variant="outline" size="sm" asChild>
                        <Link to="/agents/graph">View graph</Link>
                      </Button>
                    }
                  />
                ) : (
                  <div className="rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Agent</TableHead>
                          <TableHead>Instance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last heartbeat</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentAgents.map((agent) => (
                          <TableRow key={agent.instanceId}>
                            <TableCell>
                              <Link
                                to={`/agents/${agent.instanceId}`}
                                className="font-medium text-primary hover:underline"
                              >
                                {agent.agentName}
                              </Link>
                              <p className="text-xs text-muted-foreground">v{agent.version}</p>
                            </TableCell>
                            <TableCell className="font-mono text-xs">{agent.instanceId}</TableCell>
                            <TableCell>
                              <AgentStatusBadge status={agent.status} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {formatRelative(agent.lastHeartbeat)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" asChild>
                                <Link to={`/agents/${agent.instanceId}`}>Details</Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
