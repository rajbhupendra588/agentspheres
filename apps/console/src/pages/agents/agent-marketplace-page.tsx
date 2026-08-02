import { Link } from "react-router-dom";
import { Store } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { ApiClientError } from "@/api/client";
import type { AgentInstance } from "@/models/agent";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";

interface AgentGroup {
  agentName: string;
  instances: AgentInstance[];
  healthyCount: number;
  capabilities: string[];
  versions: string[];
}

function groupAgents(agents: AgentInstance[]): AgentGroup[] {
  const map = new Map<string, AgentInstance[]>();

  for (const agent of agents) {
    const list = map.get(agent.agentName) ?? [];
    list.push(agent);
    map.set(agent.agentName, list);
  }

  return [...map.entries()]
    .map(([agentName, instances]) => ({
      agentName,
      instances,
      healthyCount: instances.filter((i) => i.status === "HEALTHY").length,
      capabilities: [...new Set(instances.flatMap((i) => i.capabilities))].sort(),
      versions: [...new Set(instances.map((i) => i.version))].sort(),
    }))
    .sort((a, b) => a.agentName.localeCompare(b.agentName));
}

export function AgentMarketplacePage() {
  const { data, isLoading, isError, error, refetch } = useAgents();
  const groups = groupAgents(data?.agents ?? []);

  if (isLoading) {
    return (
      <PageContainer>
        <LoadingState variant="cards" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer>
        <ErrorState
          message={error instanceof ApiClientError ? error.message : "Registry unavailable"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Marketplace"
          description="Logical agents grouped from live registry instances — not a separate catalog API."
        />

        {groups.length === 0 ? (
          <EmptyState
            icon={Store}
            title="No agents in registry"
            description="Run demo agents or register sidecars to populate the marketplace view."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => (
              <Card key={group.agentName} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">{group.agentName}</CardTitle>
                      <CardDescription>
                        {group.instances.length} instance
                        {group.instances.length === 1 ? "" : "s"} · {group.healthyCount} healthy
                      </CardDescription>
                    </div>
                    <AgentStatusBadge
                      status={group.healthyCount > 0 ? "HEALTHY" : "UNHEALTHY"}
                    />
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Versions
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {group.versions.map((v) => (
                        <Badge key={v} variant="outline">
                          v{v}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Capabilities
                    </p>
                    {group.capabilities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">None advertised</p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {group.capabilities.map((cap) => (
                          <Badge key={cap} variant="secondary" className="font-mono text-[10px]">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    <Button variant="default" size="sm" asChild>
                      <Link to={`/agents?search=${encodeURIComponent(group.agentName)}`}>
                        View instances
                      </Link>
                    </Button>
                    {group.instances[0] && (
                      <Button variant="outline" size="sm" asChild>
                        <Link to={`/agents/${group.instances[0].instanceId}`}>Open latest</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </PageMotion>
    </PageContainer>
  );
}
