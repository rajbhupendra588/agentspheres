import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Play, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { SearchInput } from "@/components/search-input";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { PermissionGate } from "@/components/permission-gate";
import { MonacoEditor } from "@/components/monaco-editor";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { useTools, useRegisterTool, useExecuteTool } from "@/hooks/use-tools";
import { ApiClientError } from "@/api/client";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";

const DEFAULT_INPUT_SCHEMA = '{\n  "type": "object",\n  "properties": {}\n}';

export function ToolsPage() {
  const { data, isLoading, isError, error, refetch } = useTools();
  const registerTool = useRegisterTool();
  const executeTool = useExecuteTool();

  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const [regName, setRegName] = useState("");
  const [regDescription, setRegDescription] = useState("");
  const [regSchema, setRegSchema] = useState(DEFAULT_INPUT_SCHEMA);

  const [execInput, setExecInput] = useState('{\n  \n}');
  const [execResult, setExecResult] = useState<unknown>(null);

  const filtered = useMemo(() => {
    const tools = data?.tools ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return tools;
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }, [data?.tools, search]);

  const openExecute = (toolName: string) => {
    setSelectedTool(toolName);
    setExecInput('{\n  \n}');
    setExecResult(null);
    setExecuteOpen(true);
  };

  const handleRegister = async () => {
    if (!regName.trim()) {
      toast.error("Tool name is required");
      return;
    }

    let inputSchema: Record<string, unknown>;
    try {
      inputSchema = JSON.parse(regSchema) as Record<string, unknown>;
    } catch {
      toast.error("Input schema must be valid JSON");
      return;
    }

    try {
      await registerTool.mutateAsync({
        name: regName.trim(),
        description: regDescription.trim() || undefined,
        inputSchema,
      });
      toast.success(`Tool "${regName}" registered`);
      setRegisterOpen(false);
      setRegName("");
      setRegDescription("");
      setRegSchema(DEFAULT_INPUT_SCHEMA);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to register tool";
      toast.error(message);
    }
  };

  const handleExecute = async () => {
    if (!selectedTool) return;

    let input: unknown;
    try {
      input = JSON.parse(execInput);
    } catch {
      toast.error("Input must be valid JSON");
      return;
    }

    try {
      const result = await executeTool.mutateAsync({ tool: selectedTool, input });
      setExecResult(result);
      toast.success(`Tool executed in ${result.latencyMs} ms`);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to execute tool";
      toast.error(message);
    }
  };

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Tools"
          description="Mesh tool registry — register and execute agent tools."
          actions={
            <PermissionGate minRole="developer">
              <Button onClick={() => setRegisterOpen(true)}>
                <Plus className="h-4 w-4" />
                Register tool
              </Button>
            </PermissionGate>
          }
        />

        {isLoading && <LoadingState variant="table" />}

        {isError && (
          <ErrorState
            title="Tool registry unavailable"
            message={
              error instanceof ApiClientError
                ? error.message
                : "Could not reach the mesh tool engine. Ensure the gateway and tool service are deployed."
            }
            onRetry={() => void refetch()}
          />
        )}

        {!isLoading && !isError && (
          <>
            <div className="mb-4 max-w-sm">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search tools…"
              />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={search ? "No matching tools" : "No tools registered"}
                description={
                  search
                    ? "Try a different search term."
                    : "Register a tool via the mesh tool engine or use the Register tool button (developer+)."
                }
                action={
                  !search ? (
                    <PermissionGate minRole="developer">
                      <Button variant="outline" onClick={() => setRegisterOpen(true)}>
                        Register tool
                      </Button>
                    </PermissionGate>
                  ) : undefined
                }
              />
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tool) => (
                      <TableRow key={tool.name}>
                        <TableCell>
                          <Link
                            to={`/tools/${encodeURIComponent(tool.name)}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {tool.name}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">
                          {tool.description ?? "—"}
                        </TableCell>
                        <TableCell>{tool.version ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <PermissionGate minRole="developer">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openExecute(tool.name)}
                            >
                              <Play className="h-3.5 w-3.5" />
                              Execute
                            </Button>
                          </PermissionGate>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}

        <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Register tool</DialogTitle>
              <DialogDescription>
                Define a tool with name, description, and JSON Schema for inputs.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tool-name">Name</Label>
                <Input
                  id="tool-name"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="web.search"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-desc">Description</Label>
                <Textarea
                  id="tool-desc"
                  value={regDescription}
                  onChange={(e) => setRegDescription(e.target.value)}
                  placeholder="Search the web for a query"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Input schema (JSON)</Label>
                <MonacoEditor value={regSchema} onChange={setRegSchema} height="200px" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRegisterOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleRegister()} disabled={registerTool.isPending}>
                Register
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={executeOpen} onOpenChange={setExecuteOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Execute {selectedTool}</DialogTitle>
              <DialogDescription>Provide JSON input for the tool execution.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <MonacoEditor value={execInput} onChange={setExecInput} height="200px" />
              {execResult !== null && (
                <div className="space-y-2">
                  <Label>Result</Label>
                  <JsonViewer data={execResult} />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExecuteOpen(false)}>
                Close
              </Button>
              <Button onClick={() => void handleExecute()} disabled={executeTool.isPending}>
                Execute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageMotion>
    </PageContainer>
  );
}
