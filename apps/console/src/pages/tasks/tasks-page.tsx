import * as React from "react";
import { Link } from "react-router-dom";
import { ListTodo } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterBarGroup } from "@/components/filter-bar";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatRelative } from "@/utils/format";
import { statusColor } from "@/utils/status";
import { cn } from "@/lib/utils";
import type { WorkflowStepStatus, WorkflowRun } from "@/models/mesh";
import { PageMotion } from "@/pages/shared/page-motion";

const ALL = "__all__";

interface FlatTask {
  id: string;
  runId: string;
  workflowType: string;
  stepName: string;
  status: WorkflowStepStatus;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

function flattenSteps(workflows: WorkflowRun[] | undefined): FlatTask[] {
  const tasks: FlatTask[] = [];
  for (const run of workflows ?? []) {
    for (const step of run.steps) {
      tasks.push({
        id: `${run.runId}-${step.name}`,
        runId: run.runId,
        workflowType: run.workflowType,
        stepName: step.name,
        status: step.status,
        error: step.error,
        startedAt: step.startedAt,
        completedAt: step.completedAt,
      });
    }
  }
  return tasks.sort((a, b) => {
    const aTime = a.startedAt ?? a.completedAt ?? "";
    const bTime = b.startedAt ?? b.completedAt ?? "";
    return bTime.localeCompare(aTime);
  });
}

export function TasksPage() {
  const { data, isLoading, isError, error, refetch } = useWorkflows();
  const [statusFilter, setStatusFilter] = React.useState(ALL);

  const tasks = React.useMemo(() => flattenSteps(data?.workflows), [data?.workflows]);

  const filtered = React.useMemo(() => {
    if (statusFilter === ALL) return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const statuses = React.useMemo(
    () => [...new Set(tasks.map((t) => t.status))].sort(),
    [tasks],
  );

  const columns: DataTableColumn<FlatTask>[] = [
    {
      id: "stepName",
      header: "Step",
      accessor: (row) => <span className="font-medium">{row.stepName}</span>,
    },
    {
      id: "workflowType",
      header: "Workflow",
      accessor: (row) => row.workflowType,
    },
    {
      id: "runId",
      header: "Run ID",
      accessor: (row) => (
        <span className="font-mono text-xs text-muted-foreground">{row.runId}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      accessor: (row) => (
        <Badge variant="outline" className={cn("capitalize", statusColor(row.status))}>
          {row.status.toLowerCase()}
        </Badge>
      ),
    },
    {
      id: "startedAt",
      header: "Started",
      accessor: (row) =>
        row.startedAt ? (
          <span className="text-sm text-muted-foreground">{formatRelative(row.startedAt)}</span>
        ) : (
          "—"
        ),
    },
    {
      id: "error",
      header: "Error",
      accessor: (row) =>
        row.error ? (
          <span className="max-w-xs truncate text-sm text-destructive">{row.error}</span>
        ) : (
          "—"
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
          message={error instanceof Error ? error.message : "Failed to load tasks"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Tasks"
          description="Workflow steps across all runs — flattened from live workflow history."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/workflows">View workflows</Link>
            </Button>
          }
        />

        {tasks.length === 0 ? (
          <EmptyState
            icon={ListTodo}
            title="No tasks yet"
            description="Start a workflow run to see step-level tasks here."
            action={
              <Button variant="outline" asChild>
                <Link to="/workflows">Go to workflows</Link>
              </Button>
            }
          />
        ) : (
          <>
            <FilterBar className="mb-4">
              <FilterBarGroup label="Status">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
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
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState title="No matching tasks" description="Try a different status filter." />
            ) : (
              <DataTable data={filtered} columns={columns} getRowKey={(row) => row.id} />
            )}
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
