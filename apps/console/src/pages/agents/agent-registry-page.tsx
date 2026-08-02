import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Bot, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterBarActions, FilterBarGroup } from "@/components/filter-bar";
import { SearchInput } from "@/components/search-input";
import { DataTable, type DataTableColumn, type SortDirection } from "@/components/data-table";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { ApiClientError } from "@/api/client";
import { formatRelative } from "@/utils/format";
import type { AgentInstance } from "@/models/agent";
import {
  Badge,
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

const PAGE_SIZE = 20;
const ALL = "__all__";

function matchesSearch(agent: AgentInstance, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  return (
    agent.agentName.toLowerCase().includes(q) ||
    agent.instanceId.toLowerCase().includes(q) ||
    agent.owner.toLowerCase().includes(q) ||
    agent.version.toLowerCase().includes(q) ||
    agent.capabilities.some((c) => c.toLowerCase().includes(q))
  );
}

function CapabilityChips({ capabilities }: { capabilities: string[] }) {
  const visible = capabilities.slice(0, 3);
  const extra = capabilities.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((cap) => (
        <Badge key={cap} variant="outline" className="font-mono text-[10px]">
          {cap}
        </Badge>
      ))}
      {extra > 0 && (
        <Badge variant="neutral" className="text-[10px]">
          +{extra}
        </Badge>
      )}
    </div>
  );
}

export function AgentRegistryPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useAgents();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = React.useState(() => searchParams.get("search") ?? "");
  const [statusFilter, setStatusFilter] = React.useState(ALL);
  const [capabilityFilter, setCapabilityFilter] = React.useState("");
  const [ownerFilter, setOwnerFilter] = React.useState("");
  const [sortKey, setSortKey] = React.useState("agentName");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("asc");
  const [page, setPage] = React.useState(0);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const updateSearch = React.useCallback(
    (value: string) => {
      setSearch(value);
      const next = new URLSearchParams(searchParams);
      const trimmed = value.trim();
      if (trimmed) {
        next.set("search", trimmed);
      } else {
        next.delete("search");
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  React.useEffect(() => {
    setPage(0);
  }, [search, statusFilter, capabilityFilter, ownerFilter]);

  const agents = data?.agents ?? [];

  const statuses = React.useMemo(
    () => [...new Set(agents.map((a) => a.status))].sort(),
    [agents],
  );

  const filtered = React.useMemo(() => {
    const capQ = capabilityFilter.trim().toLowerCase();
    const ownerQ = ownerFilter.trim().toLowerCase();

    return agents.filter((agent) => {
      if (!matchesSearch(agent, search)) return false;
      if (statusFilter !== ALL && agent.status !== statusFilter) return false;
      if (capQ && !agent.capabilities.some((c) => c.toLowerCase().includes(capQ))) return false;
      if (ownerQ && !agent.owner.toLowerCase().includes(ownerQ)) return false;
      return true;
    });
  }, [agents, search, statusFilter, capabilityFilter, ownerFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageSlice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const allPageSelected =
    pageSlice.length > 0 && pageSlice.every((a) => selected.has(a.instanceId));

  const toggleAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const a of pageSlice) next.delete(a.instanceId);
      } else {
        for (const a of pageSlice) next.add(a.instanceId);
      }
      return next;
    });
  };

  const toggleRow = (instanceId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const copySelectedIds = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      toast.error("No instances selected");
      return;
    }
    try {
      await navigator.clipboard.writeText(ids.join("\n"));
      toast.success(`Copied ${ids.length} instance ID${ids.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const columns: DataTableColumn<AgentInstance>[] = [
    {
      id: "select",
      header: "",
      className: "w-10",
      accessor: (row) => (
        <Checkbox
          checked={selected.has(row.instanceId)}
          onCheckedChange={() => toggleRow(row.instanceId)}
          aria-label={`Select ${row.instanceId}`}
        />
      ),
    },
    {
      id: "agentName",
      header: "Agent",
      sortValue: (row) => row.agentName,
      accessor: (row) => (
        <div>
          <Link
            to={`/agents/${row.instanceId}`}
            className="font-medium text-primary hover:underline"
          >
            {row.agentName}
          </Link>
          <p className="font-mono text-[10px] text-muted-foreground">{row.instanceId}</p>
        </div>
      ),
    },
    {
      id: "version",
      header: "Version",
      sortValue: (row) => row.version,
      accessor: (row) => row.version,
    },
    {
      id: "status",
      header: "Status",
      sortValue: (row) => row.status,
      accessor: (row) => <AgentStatusBadge status={row.status} />,
    },
    {
      id: "capabilities",
      header: "Capabilities",
      accessor: (row) => <CapabilityChips capabilities={row.capabilities} />,
    },
    {
      id: "owner",
      header: "Owner",
      sortValue: (row) => row.owner,
      accessor: (row) => row.owner,
    },
    {
      id: "lastHeartbeat",
      header: "Last heartbeat",
      sortValue: (row) => row.lastHeartbeat,
      accessor: (row) => (
        <span className="text-sm text-muted-foreground">{formatRelative(row.lastHeartbeat)}</span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "text-right",
      accessor: (row) => (
        <Button variant="ghost" size="sm" asChild>
          <Link to={`/agents/${row.instanceId}`}>View</Link>
        </Button>
      ),
    },
  ];

  if (isLoading) {
    return (
      <PageContainer size="wide">
        <LoadingState variant="table" />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer size="wide">
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
          title="Agent Registry"
          description="Registered agent instances from the mesh registry."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/agents/register">Register agent</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          }
        />

        {agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title="No agents in this tenant"
            description="Register an agent into the active tenant, or start an SDK sidecar with AS_TENANT_ID."
            action={
              <Button asChild>
                <Link to="/agents/register">Register agent</Link>
              </Button>
            }
          />
        ) : (
          <>
            <FilterBar className="mb-4">
              <FilterBarGroup label="Search" className="sm:max-w-md">
                <SearchInput
                  value={search}
                  onValueChange={updateSearch}
                  placeholder="Search name, instance, owner, capability…"
                  aria-label="Search agents"
                />
              </FilterBarGroup>
              <FilterBarGroup label="Status">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All statuses</SelectItem>
                    {statuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterBarGroup>
              <FilterBarGroup label="Capability">
                <Input
                  value={capabilityFilter}
                  onChange={(e) => setCapabilityFilter(e.target.value)}
                  placeholder="Filter capability…"
                />
              </FilterBarGroup>
              <FilterBarGroup label="Owner">
                <Input
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  placeholder="Filter owner…"
                />
              </FilterBarGroup>
              <FilterBarActions>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copySelectedIds()}
                  disabled={selected.size === 0}
                >
                  <Copy className="h-4 w-4" />
                  Copy IDs ({selected.size})
                </Button>
              </FilterBarActions>
            </FilterBar>

            <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={allPageSelected}
                onCheckedChange={toggleAllPage}
                aria-label="Select all on page"
              />
              <span>
                {filtered.length} result{filtered.length === 1 ? "" : "s"}
                {filtered.length !== agents.length && ` of ${agents.length}`}
              </span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No matching agents" description="Try adjusting your filters." />
            ) : (
              <>
                <DataTable
                  data={pageSlice}
                  columns={columns}
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSortChange={(key, direction) => {
                    setSortKey(key);
                    setSortDirection(direction);
                  }}
                  getRowKey={(row) => row.instanceId}
                />

                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {safePage + 1} of {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage === 0}
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= pageCount - 1}
                      onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
