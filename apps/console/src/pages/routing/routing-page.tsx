import * as React from "react";
import { Link } from "react-router-dom";
import type { DiscoveryQuery } from "@agentsphere/contracts";
import { Route } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAgents } from "@/hooks/use-agents";
import { useDiscovery } from "@/hooks/use-discovery";
import { useRoutingStore } from "@/stores/routing-store";
import { formatRelative } from "@/utils/format";
import type { DiscoveryInstance } from "@agentsphere/contracts";
import { PageMotion } from "@/pages/shared/page-motion";

function totalWeight(instances: DiscoveryInstance[]): number {
  return instances.reduce((sum, i) => sum + i.weight, 0);
}

export function RoutingPage() {
  const agentsQuery = useAgents();
  const { preferredVersions, defaultLimit, setPreferredVersion, removePreferredVersion, setDefaultLimit } =
    useRoutingStore();

  const [capability, setCapability] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [submittedQuery, setSubmittedQuery] = React.useState<DiscoveryQuery | undefined>();

  const discoveryQuery = useDiscovery(submittedQuery, Boolean(submittedQuery));

  const capabilityOptions = React.useMemo(
    () => [...new Set((agentsQuery.data?.agents ?? []).flatMap((a) => a.capabilities))].sort(),
    [agentsQuery.data?.agents],
  );

  const handleResolve = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = capability.trim();
    if (!trimmed) return;
    const preferred = preferredVersions[trimmed];
    setSubmittedQuery({
      capability: trimmed,
      version: version.trim() || preferred || undefined,
      limit: defaultLimit,
    });
  };

  const instances = discoveryQuery.data?.instances ?? [];
  const weightSum = totalWeight(instances);

  const columns: DataTableColumn<DiscoveryInstance & { share: number }>[] = [
    {
      id: "agentName",
      header: "Instance",
      accessor: (row) => (
        <div>
          <p className="font-medium">{row.agentName}</p>
          <p className="text-xs text-muted-foreground">{row.instanceId}</p>
        </div>
      ),
    },
    { id: "version", header: "Version", accessor: (row) => row.version },
    {
      id: "status",
      header: "Status",
      accessor: (row) => <AgentStatusBadge status={row.status} />,
    },
    { id: "weight", header: "Weight", accessor: (row) => row.weight },
    {
      id: "share",
      header: "Traffic share",
      accessor: (row) =>
        weightSum > 0 ? `${((row.weight / weightSum) * 100).toFixed(1)}%` : "—",
    },
  ];

  const tableData = instances.map((row) => ({
    ...row,
    share: weightSum > 0 ? row.weight / weightSum : 0,
  }));

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Routing"
          description="Capability routing is enforced by the discovery service. Use the resolver below to preview which instances would be selected and their weights."
        />

        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base">How routing works</CardTitle>
            <CardDescription>
              Invoke and runtime traffic resolve capabilities through discovery. Instances are
              filtered to healthy agents, then selected using weighted round-robin based on each
              instance&apos;s <code className="text-xs">weight</code>. Policy edits are not
              exposed via this console — adjust weights on agent registration or set local version
              preferences below.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resolve capability</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleResolve} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="routing-capability">Capability</Label>
                  <Input
                    id="routing-capability"
                    value={capability}
                    onChange={(e) => setCapability(e.target.value)}
                    list="routing-capabilities"
                    placeholder="e.g. synthesize"
                    required
                  />
                  <datalist id="routing-capabilities">
                    {capabilityOptions.map((cap) => (
                      <option key={cap} value={cap} />
                    ))}
                  </datalist>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="routing-version">Version override</Label>
                  <Input
                    id="routing-version"
                    value={version}
                    onChange={(e) => setVersion(e.target.value)}
                    placeholder={
                      capability.trim() && preferredVersions[capability.trim()]
                        ? `Default: ${preferredVersions[capability.trim()]}`
                        : "Optional"
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="routing-limit">Discovery limit</Label>
                  <Input
                    id="routing-limit"
                    type="number"
                    min={1}
                    value={defaultLimit}
                    onChange={(e) => setDefaultLimit(Number.parseInt(e.target.value, 10) || 10)}
                  />
                </div>
                <Button type="submit">Resolve</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Local version preferences</CardTitle>
              <CardDescription>
                Stored in your browser only. Applied as the default version when resolving a
                capability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(preferredVersions).length === 0 ? (
                <p className="text-sm text-muted-foreground">No preferences saved yet.</p>
              ) : (
                <ul className="space-y-2">
                  {Object.entries(preferredVersions).map(([cap, ver]) => (
                    <li
                      key={cap}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <span>
                        <Badge variant="outline" className="mr-2 font-mono">
                          {cap}
                        </Badge>
                        v{ver}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePreferredVersion(cap)}
                      >
                        Remove
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {capability.trim() && version.trim() && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPreferredVersion(capability.trim(), version.trim())}
                >
                  Save preference for &quot;{capability.trim()}&quot;
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="mt-6">
          {!submittedQuery ? (
            <EmptyState
              icon={Route}
              title="Preview routing"
              description="Enter a capability to see weighted instance selection from live discovery."
            />
          ) : discoveryQuery.isLoading ? (
            <LoadingState variant="table" />
          ) : discoveryQuery.isError ? (
            <ErrorState
              message={
                discoveryQuery.error instanceof Error
                  ? discoveryQuery.error.message
                  : "Failed to resolve routing"
              }
              onRetry={() => void discoveryQuery.refetch()}
            />
          ) : instances.length === 0 ? (
            <EmptyState
              title="No routable instances"
              description={`Discovery returned no healthy instances for "${submittedQuery.capability}".`}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span>
                  Resolved {discoveryQuery.data?.capability} ·{" "}
                  {discoveryQuery.data?.resolvedAt
                    ? formatRelative(discoveryQuery.data.resolvedAt)
                    : ""}
                </span>
                <Badge variant="info">Weighted round-robin</Badge>
                <span>
                  Total weight: {weightSum} across {instances.length} instance
                  {instances.length === 1 ? "" : "s"}
                </span>
              </div>
              <DataTable
                data={tableData}
                columns={columns}
                getRowKey={(row) => row.instanceId}
              />
              <p className="text-xs text-muted-foreground">
                Higher weight increases selection probability on each invoke. Tie-breaking follows
                discovery service ordering.
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link to="/discovery">Open full discovery</Link>
              </Button>
            </div>
          )}
        </div>
      </PageMotion>
    </PageContainer>
  );
}
