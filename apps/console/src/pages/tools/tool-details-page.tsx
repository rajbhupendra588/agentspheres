import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Play } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PermissionGate } from "@/components/permission-gate";
import { MonacoEditor } from "@/components/monaco-editor";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { useTools, useExecuteTool } from "@/hooks/use-tools";
import { ApiClientError } from "@/api/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
} from "@/components/ui";

export function ToolDetailsPage() {
  const { toolName } = useParams<{ toolName: string }>();
  const decodedName = toolName ? decodeURIComponent(toolName) : "";
  const { data, isLoading, isError, error, refetch } = useTools();
  const executeTool = useExecuteTool();

  const [execInput, setExecInput] = useState('{\n  \n}');
  const [execResult, setExecResult] = useState<unknown>(null);

  const tool = data?.tools.find((t) => t.name === decodedName);

  const handleExecute = async () => {
    if (!decodedName) return;

    let input: unknown;
    try {
      input = JSON.parse(execInput);
    } catch {
      toast.error("Input must be valid JSON");
      return;
    }

    try {
      const result = await executeTool.mutateAsync({ tool: decodedName, input });
      setExecResult(result);
      toast.success(`Executed in ${result.latencyMs} ms`);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to execute tool";
      toast.error(message);
    }
  };

  return (
    <PageContainer>
      <PageMotion>
        <div className="mb-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tools">
              <ArrowLeft className="h-4 w-4" />
              Back to tools
            </Link>
          </Button>
        </div>

        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            title="Tool registry unavailable"
            message={
              error instanceof ApiClientError
                ? error.message
                : "Could not reach the mesh tool engine."
            }
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && !tool && (
          <EmptyState
            title="Tool not found"
            description={`No tool named "${decodedName}" is registered on the mesh.`}
            action={
              <Button variant="outline" asChild>
                <Link to="/tools">Browse tools</Link>
              </Button>
            }
          />
        )}

        {!isLoading && !isError && tool && (
          <>
            <PageHeader
              title={tool.name}
              description={tool.description ?? "Mesh tool definition"}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Input schema</CardTitle>
                  <CardDescription>JSON Schema for tool inputs</CardDescription>
                </CardHeader>
                <CardContent>
                  <JsonViewer data={tool.inputSchema} />
                </CardContent>
              </Card>

              {tool.outputSchema && (
                <Card>
                  <CardHeader>
                    <CardTitle>Output schema</CardTitle>
                    <CardDescription>Expected output shape</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <JsonViewer data={tool.outputSchema} />
                  </CardContent>
                </Card>
              )}
            </div>

            <PermissionGate minRole="developer">
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle>Execute</CardTitle>
                  <CardDescription>Run this tool against the mesh tool engine</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Input (JSON)</Label>
                    <MonacoEditor value={execInput} onChange={setExecInput} height="180px" />
                  </div>
                  <Button onClick={() => void handleExecute()} disabled={executeTool.isPending}>
                    <Play className="h-4 w-4" />
                    Execute
                  </Button>
                  {execResult !== null && (
                    <div className="space-y-2">
                      <Label>Result</Label>
                      <JsonViewer data={execResult} />
                    </div>
                  )}
                </CardContent>
              </Card>
            </PermissionGate>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
