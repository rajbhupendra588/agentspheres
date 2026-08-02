import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { AgentFlow } from "@/components/graph/agent-flow";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { ApiClientError } from "@/api/client";
import { formatNumber } from "@/utils/format";
import { Network, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Label,
} from "@/components/ui";
import * as React from "react";

export function AgentGraphPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAgents();
  const [showHubs, setShowHubs] = React.useState(true);

  const agents = (data?.agents ?? []).map((a) => ({
    instanceId: a.instanceId,
    agentName: a.agentName,
    status: a.status,
    capabilities: a.capabilities,
  }));

  const healthyCount = agents.filter((a) => a.status === "HEALTHY").length;
  const capabilityCount = new Set(agents.flatMap((a) => a.capabilities ?? [])).size;
  const sharedCapabilities = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const agent of agents) {
      for (const cap of agent.capabilities ?? []) {
        map.set(cap, (map.get(cap) ?? 0) + 1);
      }
    }
    return [...map.values()].filter((count) => count > 1).length;
  }, [agents]);

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <LoadingState />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer size="wide">
        <ErrorState
          message={error instanceof ApiClientError ? error.message : "Failed to load agents"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Agent Graph"
          description="Visual agent topology from the registry — nodes linked by shared capabilities."
          actions={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="capability-hubs" checked={showHubs} onCheckedChange={setShowHubs} />
                <Label htmlFor="capability-hubs" className="text-sm">
                  Capability hubs
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          }
        />

        {agents.length === 0 ? (
          <EmptyState
            icon={Network}
            title="No agents"
            description="Register agents to build the capability graph."
          />
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile label="Instances" value={formatNumber(agents.length)} />
              <MetricTile label="Healthy" value={formatNumber(healthyCount)} />
              <MetricTile label="Capabilities" value={formatNumber(capabilityCount)} />
              <MetricTile
                label="Shared capabilities"
                value={formatNumber(sharedCapabilities)}
                hint="Capabilities with 2+ instances"
              />
            </div>

            <Card className="mb-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Topology</CardTitle>
                <CardDescription>
                  Agents with overlapping capabilities are connected. Animated edges indicate
                  healthy instances. Toggle capability hubs to group multi-instance capabilities.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                <AgentFlow
                  agents={agents}
                  height="calc(100vh - 12rem)"
                  showCapabilityHubs={showHubs}
                />
              </CardContent>
            </Card>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
