import { useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MonacoEditor } from "@/components/monaco-editor";
import { JsonViewer } from "@/components/json-viewer";
import { PageMotion } from "@/pages/shared/page-motion";
import { axiosInstance } from "@/api/client";
import { ApiClientError } from "@/api/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";

type HttpMethod = "GET" | "POST" | "PUT";

interface ApiPreset {
  id: string;
  label: string;
  method: HttpMethod;
  path: string;
  body?: string;
}

const PRESETS: ApiPreset[] = [
  { id: "health", label: "Mesh health", method: "GET", path: "/mesh/health" },
  { id: "agents", label: "List agents", method: "GET", path: "/mesh/registry/v1/agents" },
  { id: "tools", label: "List tools", method: "GET", path: "/mesh/tools/v1/tools" },
  {
    id: "workflows",
    label: "List workflows",
    method: "GET",
    path: "/mesh/workflow/v1/workflows",
  },
  {
    id: "discover",
    label: "Discover capability",
    method: "GET",
    path: "/mesh/discovery/v1/discover?capability=research.web",
  },
  {
    id: "invoke",
    label: "Invoke runtime",
    method: "POST",
    path: "/mesh/runtime/v1/invoke",
    body: JSON.stringify(
      {
        capability: "research.web",
        input: { query: "AgentSphere mesh" },
      },
      null,
      2,
    ),
  },
  {
    id: "token",
    label: "Issue token",
    method: "POST",
    path: "/mesh/auth/v1/token",
    body: JSON.stringify({ subject: "api-explorer", role: "developer" }, null, 2),
  },
];

export function ApiExplorerPage() {
  const [presetId, setPresetId] = useState(PRESETS[0]!.id);
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [path, setPath] = useState("/mesh/health");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<unknown>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const applyPreset = (id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(id);
    setMethod(preset.method);
    setPath(preset.path);
    setBody(preset.body ?? "");
  };

  const handleSend = async () => {
    setLoading(true);
    setResponse(null);
    setStatus(null);

    try {
      let parsedBody: unknown;
      if (method !== "GET" && body.trim()) {
        parsedBody = JSON.parse(body);
      }

      const result = await axiosInstance.request({
        method: method.toLowerCase(),
        url: path,
        data: parsedBody,
      });

      setStatus(result.status);
      setResponse(result.data);
      toast.success(`${method} ${path} → ${result.status}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setStatus(err.status);
        setResponse({ error: err.message, code: err.code, details: err.details });
        toast.error(err.message);
      } else {
        setResponse({ error: String(err) });
        toast.error("Request failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="API Explorer"
          description="Send requests to real mesh routes via the authenticated axios client."
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
              <CardDescription>Select a preset or customize method and path</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Preset</Label>
                <Select value={presetId} onValueChange={applyPreset}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select value={method} onValueChange={(v) => setMethod(v as HttpMethod)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-2">
                  <Label>Path</Label>
                  <MonacoEditor
                    value={path}
                    onChange={setPath}
                    language="plaintext"
                    height="40px"
                    options={{ lineNumbers: "off", minimap: { enabled: false } }}
                  />
                </div>
              </div>

              {method !== "GET" && (
                <div className="space-y-2">
                  <Label>Body (JSON)</Label>
                  <MonacoEditor value={body} onChange={setBody} height="200px" />
                </div>
              )}

              <Button onClick={() => void handleSend()} disabled={loading}>
                <Send className="h-4 w-4" />
                Send
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Response</CardTitle>
              <CardDescription>
                {status !== null ? `HTTP ${status}` : "Awaiting request"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {response !== null ? (
                <JsonViewer data={response} />
              ) : (
                <p className="text-sm text-muted-foreground">Send a request to see the response.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </PageMotion>
    </PageContainer>
  );
}
