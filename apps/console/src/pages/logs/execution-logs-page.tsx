import * as React from "react";
import { ScrollText } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { FilterBar, FilterBarGroup } from "@/components/filter-bar";
import { LogViewer, type LogLine } from "@/components/log-viewer";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useWorkflows } from "@/hooks/use-workflows";
import { useEventsStore } from "@/stores/events-store";
import { ApiClientError } from "@/api/client";
import type { MeshEvent, WorkflowRun } from "@/models/mesh";
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

const ALL = "__all__";

function inferEventLevel(type: string): LogLine["level"] {
  const lower = type.toLowerCase();
  if (lower.includes("error") || lower.includes("failed")) return "error";
  if (lower.includes("warn")) return "warn";
  return "info";
}

function eventToLogLine(event: MeshEvent): LogLine {
  const payload =
    typeof event.payload === "string"
      ? event.payload
      : JSON.stringify(event.payload);

  return {
    id: `event-${event.id}`,
    timestamp: event.ts,
    level: inferEventLevel(event.type),
    message: `[event:${event.type}] ${payload}`,
  };
}

function workflowStepsToLogLines(workflows: WorkflowRun[]): LogLine[] {
  const lines: LogLine[] = [];

  for (const run of workflows) {
    for (const step of run.steps) {
      const prefix = `[workflow:${run.runId}] ${run.workflowType}/${step.name}`;
      const timestamp = step.completedAt ?? step.startedAt ?? run.updatedAt;

      if (step.error) {
        lines.push({
          id: `wf-${run.runId}-${step.name}-error`,
          timestamp,
          level: "error",
          message: `${prefix} FAILED: ${step.error}`,
        });
      } else {
        lines.push({
          id: `wf-${run.runId}-${step.name}`,
          timestamp,
          level: step.status === "FAILED" ? "error" : step.status === "RUNNING" ? "info" : "info",
          message: `${prefix} ${step.status}${step.output != null ? ` — ${JSON.stringify(step.output).slice(0, 120)}` : ""}`,
        });
      }
    }
  }

  return lines;
}

function isExecutionEvent(event: MeshEvent): boolean {
  const type = event.type.toLowerCase();
  return (
    type.includes("invoke") ||
    type.includes("workflow") ||
    type.includes("task") ||
    type.includes("execution")
  );
}

export function ExecutionLogsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useWorkflows();
  const events = useEventsStore((s) => s.events);
  const clearEvents = useEventsStore((s) => s.clear);

  const [sourceFilter, setSourceFilter] = React.useState(ALL);
  const [levelFilter, setLevelFilter] = React.useState(ALL);

  const workflowLines = React.useMemo(
    () => workflowStepsToLogLines(data?.workflows ?? []),
    [data?.workflows],
  );

  const eventLines = React.useMemo(
    () => events.filter(isExecutionEvent).map(eventToLogLine),
    [events],
  );

  const mergedLines = React.useMemo(() => {
    let lines: LogLine[] = [];

    if (sourceFilter === ALL || sourceFilter === "workflow") {
      lines = lines.concat(workflowLines);
    }
    if (sourceFilter === ALL || sourceFilter === "event") {
      lines = lines.concat(eventLines);
    }

    if (levelFilter !== ALL) {
      lines = lines.filter((line) => line.level === levelFilter);
    }

    return lines.sort((a, b) => {
      const aTs = a.timestamp ?? "";
      const bTs = b.timestamp ?? "";
      return bTs.localeCompare(aTs);
    });
  }, [workflowLines, eventLines, sourceFilter, levelFilter]);

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
          message={error instanceof ApiClientError ? error.message : "Failed to load workflow logs"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  const hasAnyData = workflowLines.length > 0 || eventLines.length > 0;

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Execution Logs"
          description="Merged workflow step output and live invoke/workflow events."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                Refresh workflows
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearEvents}
                disabled={eventLines.length === 0}
              >
                Clear events
              </Button>
            </div>
          }
        />

        {!hasAnyData ? (
          <EmptyState
            icon={ScrollText}
            title="No execution logs"
            description="Run invoke or workflow operations and enable the live feed to populate execution logs."
          />
        ) : (
          <>
            <FilterBar className="mb-4">
              <FilterBarGroup label="Source">
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All sources</SelectItem>
                    <SelectItem value="workflow">Workflow steps</SelectItem>
                    <SelectItem value="event">Live events</SelectItem>
                  </SelectContent>
                </Select>
              </FilterBarGroup>
              <FilterBarGroup label="Level">
                <Select value={levelFilter} onValueChange={setLevelFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="All levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>All levels</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </FilterBarGroup>
            </FilterBar>

            <p className="mb-3 text-sm text-muted-foreground">
              {mergedLines.length} line{mergedLines.length === 1 ? "" : "s"}
              {" · "}
              {workflowLines.length} from workflows, {eventLines.length} from events
            </p>

            {mergedLines.length === 0 ? (
              <EmptyState title="No matching logs" description="Try adjusting source or level filters." />
            ) : (
              <LogViewer lines={mergedLines} maxHeight="calc(100vh - 14rem)" />
            )}
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
