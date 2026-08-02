import * as React from "react";
import { Compass } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterBarGroup } from "@/components/filter-bar";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { useDiscovery } from "@/hooks/use-discovery";
import { ApiClientError } from "@/api/client";
import type { DiscoveryQuery } from "@agentsphere/contracts";
import type { DiscoveryInstance } from "@agentsphere/contracts";
import {
  Badge,
  Button,
  Input,
  Label,
} from "@/components/ui";

export function DiscoveryPage() {
  const agentsQuery = useAgents();

  const [capability, setCapability] = React.useState("");
  const [version, setVersion] = React.useState("");
  const [limit, setLimit] = React.useState("10");
  const [submittedQuery, setSubmittedQuery] = React.useState<DiscoveryQuery | undefined>();

  const discoveryQuery = useDiscovery(submittedQuery, Boolean(submittedQuery));

  const capabilityOptions = React.useMemo(
    () => [...new Set((agentsQuery.data?.agents ?? []).flatMap((a) => a.capabilities))].sort(),
    [agentsQuery.data?.agents],
  );

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = capability.trim();
    if (!trimmed) return;

    const parsedLimit = Number(limit);
    setSubmittedQuery({
      capability: trimmed,
      version: version.trim() || undefined,
      limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined,
    });
  };

  const instances = discoveryQuery.data?.instances ?? [];

  const columns: DataTableColumn<DiscoveryInstance>[] = [
    {
      id: "agentName",
      header: "Agent",
      accessor: (row) => (
        <div>
          <p className="font-medium">{row.agentName}</p>
          <p className="font-mono text-[10px] text-muted-foreground">{row.instanceId}</p>
        </div>
      ),
    },
    {
      id: "version",
      header: "Version",
      accessor: (row) => row.version,
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => <AgentStatusBadge status={row.status} />,
    },
    {
      id: "weight",
      header: "Weight",
      accessor: (row) => row.weight,
    },
    {
      id: "capabilities",
      header: "Capabilities",
      accessor: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.capabilities.map((cap) => (
            <Badge key={cap} variant="outline" className="font-mono text-[10px]">
              {cap}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "baseUrl",
      header: "Base URL",
      accessor: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.baseUrl}</span>
      ),
    },
  ];

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Discovery"
          description="Capability-based agent discovery via the mesh discovery service."
        />

        <form onSubmit={handleSubmit} className="mb-6 space-y-4">
          <FilterBar>
            <FilterBarGroup label="Capability" className="sm:max-w-sm">
              <Input
                value={capability}
                onChange={(e) => setCapability(e.target.value)}
                list="discovery-capabilities"
                placeholder="e.g. research.web"
                required
              />
              <datalist id="discovery-capabilities">
                {capabilityOptions.map((cap) => (
                  <option key={cap} value={cap} />
                ))}
              </datalist>
            </FilterBarGroup>
            <FilterBarGroup label="Version">
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="Optional"
              />
            </FilterBarGroup>
            <FilterBarGroup label="Limit">
              <Input
                type="number"
                min={1}
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </FilterBarGroup>
            <div className="flex items-end">
              <Button type="submit" disabled={discoveryQuery.isFetching || !capability.trim()}>
                {discoveryQuery.isFetching ? "Discovering…" : "Discover"}
              </Button>
            </div>
          </FilterBar>
        </form>

        {capabilityOptions.length > 0 && (
          <div className="mb-6">
            <Label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">
              Quick capabilities
            </Label>
            <div className="flex flex-wrap gap-2">
              {capabilityOptions.map((cap) => (
                <Button
                  key={cap}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => {
                    setCapability(cap);
                    setSubmittedQuery({
                      capability: cap,
                      version: version.trim() || undefined,
                      limit: Number(limit) > 0 ? Number(limit) : undefined,
                    });
                  }}
                >
                  {cap}
                </Button>
              ))}
            </div>
          </div>
        )}

        {agentsQuery.isLoading && <LoadingState variant="table" />}

        {discoveryQuery.isError && (
          <ErrorState
            message={
              discoveryQuery.error instanceof ApiClientError
                ? discoveryQuery.error.message
                : "Discovery request failed"
            }
            onRetry={() => void discoveryQuery.refetch()}
          />
        )}

        {submittedQuery && discoveryQuery.isFetching && !discoveryQuery.data && (
          <LoadingState variant="table" />
        )}

        {submittedQuery && !discoveryQuery.isFetching && !discoveryQuery.isError && instances.length === 0 && (
          <EmptyState
            icon={Compass}
            title="No instances found"
            description={`No healthy agents advertise capability "${submittedQuery.capability}".`}
          />
        )}

        {instances.length > 0 && discoveryQuery.data && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Resolved <strong>{instances.length}</strong> instance
              {instances.length === 1 ? "" : "s"} for{" "}
              <Badge variant="outline" className="font-mono">
                {discoveryQuery.data.capability}
              </Badge>
            </p>
            <DataTable
              data={instances}
              columns={columns}
              getRowKey={(row) => row.instanceId}
            />
          </div>
        )}

        {!submittedQuery && !agentsQuery.isLoading && (
          <EmptyState
            icon={Compass}
            title="Run a discovery query"
            description="Enter a capability and submit to resolve matching healthy agent instances."
          />
        )}
      </PageMotion>
    </PageContainer>
  );
}
