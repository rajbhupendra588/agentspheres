import { useMemo } from "react";
import { GitBranch } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatLatency, formatRelative } from "@/utils/format";
import { ApiClientError } from "@/api/client";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import type { WorkflowRun, WorkflowStep } from "@/models/mesh";

function StepTimeline({ steps }: { steps: WorkflowStep[] }) {
  const timedSteps = steps.filter((s) => s.startedAt);

  if (timedSteps.length === 0) {
    return <p className="text-sm text-muted-foreground">No step timestamps recorded.</p>;
  }

  const startMs = Math.min(...timedSteps.map((s) => new Date(s.startedAt!).getTime()));
  const endMs = Math.max(
    ...timedSteps.map((s) =>
      s.completedAt ? new Date(s.completedAt).getTime() : new Date(s.startedAt!).getTime(),
    ),
  );
  const totalMs = Math.max(endMs - startMs, 1);

  return (
    <div className="space-y-3">
      {timedSteps.map((step) => {
        const stepStart = new Date(step.startedAt!).getTime();
        const stepEnd = step.completedAt
          ? new Date(step.completedAt).getTime()
          : stepStart + 1;
        const left = ((stepStart - startMs) / totalMs) * 100;
        const width = Math.max(((stepEnd - stepStart) / totalMs) * 100, 2);
        const duration = step.completedAt
          ? stepEnd - stepStart
          : null;

        return (
          <div key={step.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{step.name}</span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{step.status}</Badge>
                {duration !== null && (
                  <span className="text-xs text-muted-foreground">{formatLatency(duration)}</span>
                )}
              </div>
            </div>
            <div className="relative h-6 rounded bg-muted">
              <div
                className="absolute top-1 h-4 rounded bg-primary/80"
                style={{ left: `${left}%`, width: `${width}%` }}
                title={
                  step.startedAt
                    ? `${step.startedAt}${step.completedAt ? ` → ${step.completedAt}` : ""}`
                    : undefined
                }
              />
            </div>
            {step.startedAt && (
              <p className="text-xs text-muted-foreground">
                Started {formatRelative(step.startedAt)}
                {step.completedAt && ` · completed ${formatRelative(step.completedAt)}`}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WorkflowTraceCard({ run }: { run: WorkflowRun }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="font-mono text-base">{run.runId}</CardTitle>
            <CardDescription>
              {run.workflowType}
              {run.topic && ` · ${run.topic}`}
            </CardDescription>
          </div>
          <Badge>{run.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <StepTimeline steps={run.steps} />
      </CardContent>
    </Card>
  );
}

export function TracingPage() {
  const { data, isLoading, isError, error, refetch } = useWorkflows();

  const runsWithSteps = useMemo(
    () => (data?.workflows ?? []).filter((w) => w.steps.length > 0),
    [data?.workflows],
  );

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Tracing"
          description="Workflow run timelines from real step timestamps — correlation via runId."
        />

        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            title="Workflow service unavailable"
            message={
              error instanceof ApiClientError
                ? error.message
                : "Could not load workflow runs from the mesh."
            }
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && runsWithSteps.length === 0 && (
          <EmptyState
            icon={GitBranch}
            title="No workflow runs"
            description="Run POST /mesh/workflow/v1/workflows/research-synthesize to generate traceable workflow steps with timestamps."
          />
        )}

        {!isLoading && !isError && runsWithSteps.length > 0 && (
          <div className="space-y-4">
            {runsWithSteps.map((run) => (
              <WorkflowTraceCard key={run.runId} run={run} />
            ))}
          </div>
        )}
      </PageMotion>
    </PageContainer>
  );
}
