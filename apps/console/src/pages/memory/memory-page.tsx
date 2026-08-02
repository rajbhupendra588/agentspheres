import { useState } from "react";
import { toast } from "sonner";
import type { MemoryScope } from "@agentsphere/contracts";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { JsonViewer } from "@/components/json-viewer";
import { MonacoEditor } from "@/components/monaco-editor";
import { PageMotion } from "@/pages/shared/page-motion";
import { memoryGet, memorySet, memorySearch } from "@/api/mesh";
import { ApiClientError } from "@/api/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

export function MemoryPage() {
  const [scope, setScope] = useState<MemoryScope>("session");
  const [key, setKey] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [agentName, setAgentName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [valueJson, setValueJson] = useState('{\n  "note": ""\n}');
  const [searchQuery, setSearchQuery] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const scopeFields = (): {
    scope: MemoryScope;
    sessionId?: string;
    agentName?: string;
    workspaceId?: string;
  } => {
    const base: {
      scope: MemoryScope;
      sessionId?: string;
      agentName?: string;
      workspaceId?: string;
    } = { scope };
    if (scope === "session" && sessionId) base.sessionId = sessionId;
    if (scope === "agent" && agentName) base.agentName = agentName;
    if (scope === "workspace" && workspaceId) base.workspaceId = workspaceId;
    return base;
  };

  const handleGet = async () => {
    if (!key.trim()) {
      toast.error("Key is required");
      return;
    }
    setLoading(true);
    try {
      const response = await memoryGet({ key: key.trim(), ...scopeFields() });
      setResult(response);
      toast.success("Memory record retrieved");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to get memory";
      toast.error(message);
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const handleSet = async () => {
    if (!key.trim()) {
      toast.error("Key is required");
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(valueJson);
    } catch {
      toast.error("Value must be valid JSON");
      return;
    }
    setLoading(true);
    try {
      const record = await memorySet({ key: key.trim(), value, ...scopeFields() });
      setResult(record);
      toast.success("Memory record saved");
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to set memory";
      toast.error(message);
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error("Search query is required");
      return;
    }
    setLoading(true);
    try {
      const response = await memorySearch({
        query: searchQuery.trim(),
        scope,
        workspaceId: workspaceId || undefined,
        limit: 20,
      });
      setResult(response);
      toast.success(`Found ${response.count} record(s)`);
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : "Failed to search memory";
      toast.error(message);
      setResult({ error: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Memory"
          description="Session, agent, and workspace memory via the mesh memory service."
        />

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Scope</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as MemoryScope)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="session">Session</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="workspace">Workspace</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "session" && (
            <div className="space-y-2">
              <Label>Session ID</Label>
              <Input value={sessionId} onChange={(e) => setSessionId(e.target.value)} />
            </div>
          )}
          {scope === "agent" && (
            <div className="space-y-2">
              <Label>Agent name</Label>
              <Input value={agentName} onChange={(e) => setAgentName(e.target.value)} />
            </div>
          )}
          {scope === "workspace" && (
            <div className="space-y-2">
              <Label>Workspace ID</Label>
              <Input value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} />
            </div>
          )}
        </div>

        <Tabs defaultValue="get">
          <TabsList>
            <TabsTrigger value="get">Get</TabsTrigger>
            <TabsTrigger value="set">Set</TabsTrigger>
            <TabsTrigger value="search">Search</TabsTrigger>
          </TabsList>

          <TabsContent value="get" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="context.summary" />
            </div>
            <Button onClick={() => void handleGet()} disabled={loading}>
              Get record
            </Button>
          </TabsContent>

          <TabsContent value="set" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="context.summary" />
            </div>
            <div className="space-y-2">
              <Label>Value (JSON)</Label>
              <MonacoEditor value={valueJson} onChange={setValueJson} height="160px" />
            </div>
            <Button onClick={() => void handleSet()} disabled={loading}>
              Set record
            </Button>
          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Query</Label>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Semantic or keyword search"
              />
            </div>
            <Button onClick={() => void handleSearch()} disabled={loading}>
              Search
            </Button>
          </TabsContent>
        </Tabs>

        {result !== null && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>Response from the mesh memory service</CardDescription>
            </CardHeader>
            <CardContent>
              <JsonViewer data={result} />
            </CardContent>
          </Card>
        )}
      </PageMotion>
    </PageContainer>
  );
}
