import * as React from "react";
import { Link } from "react-router-dom";
import { GitBranch, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { useRunResearchSynthesize, useWorkflows } from "@/hooks/use-workflows";
import { ApiClientError } from "@/api/client";
import { formatRelative } from "@/utils/format";
import { statusColor } from "@/utils/status";
import { cn } from "@/lib/utils";
import type { WorkflowRun, WorkflowStep } from "@/models/mesh";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

function StepRow({ step }: { step: WorkflowStep }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{step.name}</TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("capitalize", statusColor(step.status))}>
          {step.status.toLowerCase()}
        </Badge>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {step.startedAt ? formatRelative(step.startedAt) : "—"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {step.completedAt ? formatRelative(step.completedAt) : "—"}
      </TableCell>
      <TableCell className="max-w-xs truncate text-sm text-destructive">
        {step.error ?? "—"}
      </TableCell>
    </TableRow>
  );
}

function WorkflowRunPanel({ workflow }: { workflow: WorkflowRun }) {
  return (
    <AccordionItem value={workflow.runId}>
      <AccordionTrigger className="hover:no-underline">
        <div className="flex flex-1 flex-wrap items-center gap-3 pr-4 text-left">
          <span className="font-mono text-xs">{workflow.runId}</span>
          <Badge variant="outline">{workflow.workflowType}</Badge>
          <Badge variant="outline" className={cn("capitalize", statusColor(workflow.status))}>
            {workflow.status.toLowerCase()}
          </Badge>
          <span className="text-sm text-muted-foreground">
            Updated {formatRelative(workflow.updatedAt)}
          </span>
          {workflow.topic && (
            <span className="truncate text-sm text-muted-foreground">Topic: {workflow.topic}</span>
          )}
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pb-2 pl-1">
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflow.steps.map((step) => (
                  <StepRow key={step.name} step={step} />
                ))}
              </TableBody>
            </Table>
          </div>

          {workflow.result != null && (
            <div>
              <p className="mb-2 text-sm font-medium">Result</p>
              <JsonViewer data={workflow.result} collapsed />
            </div>
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

export function WorkflowsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useWorkflows();
  const runWorkflow = useRunResearchSynthesize();

  const [topic, setTopic] = React.useState("AgentSphere mesh architecture");
  const [sessionId, setSessionId] = React.useState("");

  const workflows = React.useMemo(
    () =>
      [...(data?.workflows ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [data?.workflows],
  );

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) {
      toast.error("Topic is required");
      return;
    }

    try {
      const result = await runWorkflow.mutateAsync({
        topic: trimmed,
        sessionId: sessionId.trim() || undefined,
      });
      toast.success(`Workflow started: ${result.runId}`);
      void refetch();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to start workflow");
    }
  };

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
          message={error instanceof ApiClientError ? error.message : "Workflow service unavailable"}
          onRetry={() => void refetch()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Workflows"
          description="Workflow run history from the mesh workflow service."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/workflows/builder">Open builder</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          }
        />

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base">Start research-synthesize</CardTitle>
            <CardDescription>
              Run the built-in two-step workflow against live mesh agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void handleStart(e)} className="flex flex-wrap items-end gap-4">
              <div className="min-w-[240px] flex-1 space-y-2">
                <Label htmlFor="wf-topic">Topic</Label>
                <Input
                  id="wf-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Research topic…"
                  required
                />
              </div>
              <div className="min-w-[200px] space-y-2">
                <Label htmlFor="wf-session">Session ID (optional)</Label>
                <Input
                  id="wf-session"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Optional session"
                />
              </div>
              <Button type="submit" disabled={runWorkflow.isPending}>
                <Play className="h-4 w-4" />
                {runWorkflow.isPending ? "Starting…" : "Start workflow"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {workflows.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title="No workflow runs"
            description="Start a research-synthesize run using the form above or the workflow builder."
            action={
              <Button variant="outline" asChild>
                <Link to="/workflows/builder">Workflow builder</Link>
              </Button>
            }
          />
        ) : (
          <Accordion type="multiple" className="rounded-lg border border-border px-4">
            {workflows.map((wf) => (
              <WorkflowRunPanel key={wf.runId} workflow={wf} />
            ))}
          </Accordion>
        )}
      </PageMotion>
    </PageContainer>
  );
}
