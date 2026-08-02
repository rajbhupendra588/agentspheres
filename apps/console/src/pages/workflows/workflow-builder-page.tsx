import * as React from "react";
import { toast } from "sonner";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  Handle,
  Position,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { JsonViewer } from "@/components/json-viewer";
import { PermissionGate } from "@/components/permission-gate";
import { PageMotion } from "@/pages/shared/page-motion";
import { useRunResearchSynthesize } from "@/hooks/use-workflows";
import { ApiClientError } from "@/api/client";
import { cn } from "@/lib/utils";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

function WorkflowStepNode({
  data,
}: {
  data: { label: string; description: string; tone: "research" | "synthesize" };
}) {
  const toneClass =
    data.tone === "research"
      ? "border-sky-500/40 bg-sky-500/5"
      : "border-violet-500/40 bg-violet-500/5";

  return (
    <div className={cn("min-w-[180px] rounded-lg border-2 px-4 py-3 shadow-sm", toneClass)}>
      <Handle type="target" position={Position.Left} className="!bg-border" />
      <p className="text-sm font-semibold">{data.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{data.description}</p>
      <Handle type="source" position={Position.Right} className="!bg-border" />
    </div>
  );
}

const nodeTypes = { workflowStep: WorkflowStepNode };

const initialNodes: Node[] = [
  {
    id: "research",
    type: "workflowStep",
    position: { x: 80, y: 120 },
    data: {
      label: "Research",
      description: "research.web capability",
      tone: "research",
    },
  },
  {
    id: "synthesize",
    type: "workflowStep",
    position: { x: 380, y: 120 },
    data: {
      label: "Synthesize",
      description: "synthesize.text capability",
      tone: "synthesize",
    },
  },
];

const initialEdges: Edge[] = [
  {
    id: "research-synthesize",
    source: "research",
    target: "synthesize",
    type: "smoothstep",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
    label: "findings → synthesis",
    style: { stroke: "hsl(var(--primary))" },
  },
];

export function WorkflowBuilderPage() {
  const [topic, setTopic] = React.useState("AgentSphere mesh architecture");
  const [sessionId, setSessionId] = React.useState("");
  const runWorkflow = useRunResearchSynthesize();

  const handleExecute = async () => {
    const trimmed = topic.trim();
    if (!trimmed) {
      toast.error("Topic is required");
      return;
    }
    if (trimmed.length < 3) {
      toast.error("Topic must be at least 3 characters");
      return;
    }

    try {
      const result = await runWorkflow.mutateAsync({
        topic: trimmed,
        sessionId: sessionId.trim() || undefined,
      });
      toast.success(`Workflow started: ${result.runId}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Workflow execution failed");
    }
  };

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Workflow Builder"
          description="Visual DAG for the research-synthesize workflow — execute against live mesh agents."
        />

        <div className="mb-6 overflow-hidden rounded-lg border border-border bg-background/60">
          <ReactFlow
            nodes={initialNodes}
            edges={initialEdges}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            zoomOnScroll={false}
            style={{ height: 280 }}
          >
            <Background gap={16} size={1} color="hsl(var(--border))" />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Execute workflow</CardTitle>
              <CardDescription>
                Requires invoke permission — routes through discovery to healthy agents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="builder-topic">Topic</Label>
                <Input
                  id="builder-topic"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="What should agents research and synthesize?"
                />
                {topic.trim().length > 0 && topic.trim().length < 3 && (
                  <p className="text-xs text-destructive">Topic must be at least 3 characters.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="builder-session">Session ID (optional)</Label>
                <Input
                  id="builder-session"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Optional correlation session"
                />
              </div>

              <PermissionGate
                minRole="developer"
                fallback={
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    Developer role or higher is required to invoke workflows.
                  </p>
                }
              >
                <Button
                  onClick={() => void handleExecute()}
                  disabled={runWorkflow.isPending || topic.trim().length < 3}
                >
                  {runWorkflow.isPending ? "Executing…" : "Execute research → synthesize"}
                </Button>
              </PermissionGate>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Last result</CardTitle>
              <CardDescription>Response from the most recent execution</CardDescription>
            </CardHeader>
            <CardContent>
              {runWorkflow.data ? (
                <JsonViewer data={runWorkflow.data} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Run the workflow to see the API response here.
                </p>
              )}
              {runWorkflow.isError && (
                <p className="mt-3 text-sm text-destructive">
                  {runWorkflow.error instanceof ApiClientError
                    ? runWorkflow.error.message
                    : "Execution failed"}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageMotion>
    </PageContainer>
  );
}
