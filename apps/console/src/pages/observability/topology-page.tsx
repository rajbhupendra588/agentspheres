import { useMemo } from "react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { AgentFlow } from "@/components/graph/agent-flow";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { StatusIndicator } from "@/components/status-indicator";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { ApiClientError } from "@/api/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { Network } from "lucide-react";

export function TopologyPage() {
  const agentsQuery = useAgents();
  const healthQuery = useMeshHealth();

  const graphAgents = useMemo(
    () =>
      (agentsQuery.data?.agents ?? []).map((a) => ({
        instanceId: a.instanceId,
        agentName: a.agentName,
        status: a.status,
        capabilities: a.capabilities,
      })),
    [agentsQuery.data?.agents],
  );

  const isLoading = agentsQuery.isLoading || healthQuery.isLoading;

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Topology"
          description="Agent relationships and mesh service nodes from live registry and health."
        />

        {isLoading && <LoadingState />}

        {agentsQuery.isError && healthQuery.isError && (
          <ErrorState
            title="Topology unavailable"
            message="Could not load agents or mesh health."
            onRetry={() => {
              void agentsQuery.refetch();
              void healthQuery.refetch();
            }}
          />
        )}

        {!isLoading && graphAgents.length === 0 && (
          <EmptyState
            icon={Network}
            title="No agents registered"
            description="Register agent sidecars to populate the topology graph."
          />
        )}

        {graphAgents.length > 0 && (
          <AgentFlow agents={graphAgents} height={420} showCapabilityHubs />
        )}

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Mesh services</CardTitle>
            <CardDescription>Control plane and data plane nodes from /mesh/health</CardDescription>
          </CardHeader>
          <CardContent>
            {healthQuery.isError ? (
              <p className="text-sm text-muted-foreground">
                Health endpoint unavailable:{" "}
                {healthQuery.error instanceof ApiClientError
                  ? healthQuery.error.message
                  : "unknown error"}
              </p>
            ) : (healthQuery.data?.services.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No services reported.</p>
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {healthQuery.data!.services.map((svc) => (
                      <TableRow key={svc.name}>
                        <TableCell className="font-medium">{svc.name}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {svc.url}
                        </TableCell>
                        <TableCell>
                          <StatusIndicator
                            tone={svc.status === "ok" ? "success" : "error"}
                            label={svc.status === "ok" ? "Up" : "Down"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </PageMotion>
    </PageContainer>
  );
}
