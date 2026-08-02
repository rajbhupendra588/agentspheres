import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, HeartPulse, Plus, Play, Wrench } from "lucide-react";
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
import { useDiscoverTools, useExecuteTool, useRegisterTool } from "@/hooks/use-tools";
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
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@/components/ui";

const DEFAULT_INPUT_SCHEMA = '{\n  "type": "object",\n  "properties": {}\n}';
const CATEGORIES = [
  "CORE_MESH", "DATABASE", "FILESYSTEM", "GIT", "GITHUB", "BROWSER", "DOCKER",
  "KUBERNETES", "CLOUD", "MESSAGING", "OBSERVABILITY", "MONITORING", "SECURITY",
  "IDENTITY", "AI_MODELS", "DOCUMENTS", "IMAGES", "AUDIO", "VIDEO", "FINANCE",
  "PRODUCTIVITY", "KNOWLEDGE", "ENTERPRISE", "CUSTOM",
] as const;

function healthVariant(health?: string): "success" | "warning" | "error" | "neutral" {
  if (health === "HEALTHY") return "success";
  if (health === "DEGRADED") return "warning";
  if (health === "UNHEALTHY") return "error";
  return "neutral";
}

export function ToolsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tag, setTag] = useState("");
  const [health, setHealth] = useState("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [executeOpen, setExecuteOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [regName, setRegName] = useState("");
  const [regDescription, setRegDescription] = useState("");
  const [regCategory, setRegCategory] = useState<string>("CUSTOM");
  const [regOwner, setRegOwner] = useState("");
  const [regVersion, setRegVersion] = useState("1.0.0");
  const [regSchema, setRegSchema] = useState(DEFAULT_INPUT_SCHEMA);
  const [execInput, setExecInput] = useState('{\n  \n}');
  const [execResult, setExecResult] = useState<unknown>(null);

  const query = useMemo(
    () => ({
      category: category === "all" ? undefined : category as (typeof CATEGORIES)[number],
      tags: tag.trim() ? tag.split(",").map((item) => item.trim()).filter(Boolean) : undefined,
      health: health === "all" ? undefined : health as "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN",
      limit: 100,
      offset: 0,
    }),
    [category, tag, health],
  );
  const { data, isLoading, isError, error, refetch } = useDiscoverTools(query);
  const registerTool = useRegisterTool();
  const executeTool = useExecuteTool();
  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return data?.tools ?? [];
    return (data?.tools ?? []).filter((tool) =>
      [tool.name, tool.description, tool.owner, ...tool.tags, ...tool.capabilities.map((capability) => capability.name)]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalized)),
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
        category: regCategory as (typeof CATEGORIES)[number],
        owner: regOwner.trim() || undefined,
        version: regVersion.trim() || undefined,
        inputSchema,
      });
      toast.success(`Tool "${regName}" registered`);
      setRegisterOpen(false);
      setRegName("");
      setRegDescription("");
      setRegCategory("CUSTOM");
      setRegOwner("");
      setRegVersion("1.0.0");
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
      const result = await executeTool.mutateAsync({ tool: selectedTool, input, mode: "SYNC" });
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
          description="Discover, govern, and operate tools registered in the active tenant."
          actions={
            <div className="flex gap-2">
              <Button variant="outline" asChild><Link to="/tools/health"><HeartPulse className="h-4 w-4" />Health</Link></Button>
              <Button variant="outline" asChild><Link to="/tools/metrics"><BarChart3 className="h-4 w-4" />Metrics</Link></Button>
              <PermissionGate minRole="developer"><Button onClick={() => setRegisterOpen(true)}><Plus className="h-4 w-4" />Register tool</Button></PermissionGate>
            </div>
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
            <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px]">
              <SearchInput value={search} onValueChange={setSearch} placeholder="Search tools, owners, or capabilities…" />
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All categories</SelectItem>{CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={health} onValueChange={setHealth}>
                <SelectTrigger><SelectValue placeholder="Health" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All health</SelectItem><SelectItem value="HEALTHY">Healthy</SelectItem><SelectItem value="DEGRADED">Degraded</SelectItem><SelectItem value="UNHEALTHY">Unhealthy</SelectItem><SelectItem value="UNKNOWN">Unknown</SelectItem></SelectContent>
              </Select>
              <Input className="md:col-span-3" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Filter by tags (comma separated)" />
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={search || category !== "all" || health !== "all" || tag.trim() ? "No matching tools" : "No tools registered"}
                description={
                  search || category !== "all" || health !== "all" || tag.trim()
                    ? "Try clearing filters or a different search term."
                    : "Platform tools are seeded per tenant on first access. Refresh after tool-engine is up, or register a custom tool (developer+)."
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
                      <TableHead>Category</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Lifecycle</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((tool) => (
                      <TableRow key={tool.id}>
                        <TableCell>
                          <Link
                            to={`/tools/${encodeURIComponent(tool.id)}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {tool.name}
                          </Link>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-muted-foreground">{tool.description}</TableCell>
                        <TableCell><Badge variant="outline">{tool.category.replaceAll("_", " ")}</Badge></TableCell>
                        <TableCell>{tool.version ?? "—"}</TableCell>
                        <TableCell><Badge variant={tool.lifecycle === "ACTIVE" ? "success" : tool.lifecycle === "DEPRECATED" ? "warning" : "neutral"}>{tool.lifecycle}</Badge></TableCell>
                        <TableCell><Badge variant={healthVariant(tool.health?.status)}>{tool.health?.status ?? "UNKNOWN"}</Badge></TableCell>
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
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Category</Label><Select value={regCategory} onValueChange={setRegCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((value) => <SelectItem key={value} value={value}>{value.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label htmlFor="tool-owner">Owner</Label><Input id="tool-owner" value={regOwner} onChange={(event) => setRegOwner(event.target.value)} placeholder="platform-team" /></div>
                <div className="space-y-2"><Label htmlFor="tool-version">Version</Label><Input id="tool-version" value={regVersion} onChange={(event) => setRegVersion(event.target.value)} placeholder="1.0.0" /></div>
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
