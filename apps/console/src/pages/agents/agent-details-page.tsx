import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { AgentStatusBadge } from "@/components/agent-status-badge";
import { JsonViewer } from "@/components/json-viewer";
import { StatusIndicator } from "@/components/status-indicator";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgent } from "@/hooks/use-agents";
import { ApiClientError } from "@/api/client";
import { formatRelative } from "@/utils/format";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

function getCardSpec(card: unknown): {
  tools?: string[];
  capabilities?: string[];
  endpoints?: { invoke?: string };
  resources?: { timeoutMs?: number };
  inputSchema?: unknown;
  outputSchema?: unknown;
} | null {
  if (!card || typeof card !== "object" || !("spec" in card)) return null;
  const spec = (card as { spec?: Record<string, unknown> }).spec;
  if (!spec || typeof spec !== "object") return null;
  return spec as {
    tools?: string[];
    capabilities?: string[];
    endpoints?: { invoke?: string };
    resources?: { timeoutMs?: number };
    inputSchema?: unknown;
    outputSchema?: unknown;
  };
}

function getCardMetadata(card: unknown): {
  name?: string;
  version?: string;
  owner?: string;
  labels?: Record<string, string>;
} | null {
  if (!card || typeof card !== "object" || !("metadata" in card)) return null;
  const metadata = (card as { metadata?: Record<string, unknown> }).metadata;
  if (!metadata || typeof metadata !== "object") return null;
  return metadata as {
    name?: string;
    version?: string;
    owner?: string;
    labels?: Record<string, string>;
  };
}

export function AgentDetailsPage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const { data, isLoading, isError, error, refetch } = useAgent(instanceId);

  const cardSpec = data ? getCardSpec(data.card) : null;
  const cardMetadata = data ? getCardMetadata(data.card) : null;
  const cardTools = cardSpec?.tools ?? [];

  return (
    <PageContainer>
      <PageMotion>
        <Button variant="ghost" size="sm" className="mb-4" asChild>
          <Link to="/agents">
            <ArrowLeft className="h-4 w-4" />
            Registry
          </Link>
        </Button>

        {isLoading && <LoadingState />}

        {isError && (
          <ErrorState
            message={error instanceof ApiClientError ? error.message : "Agent not found"}
            onRetry={() => void refetch()}
          />
        )}

        {data && (
          <>
            <PageHeader
              title={data.agentName}
              description={data.instanceId}
              actions={<AgentStatusBadge status={data.status} />}
            />

            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="card">Card</TabsTrigger>
                <TabsTrigger value="health">Health</TabsTrigger>
                <TabsTrigger value="tools">Tools</TabsTrigger>
                <TabsTrigger value="configuration">Configuration</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Version</CardDescription>
                      <CardTitle className="text-lg">{data.version}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Owner</CardDescription>
                      <CardTitle className="text-lg">{data.owner}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Weight</CardDescription>
                      <CardTitle className="text-lg">{data.weight}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Instance details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Base URL</span>
                      <a
                        href={data.baseUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-primary hover:underline"
                      >
                        {data.baseUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                    <Separator />
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Registered</span>
                      <span>{formatRelative(data.createdAt)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Updated</span>
                      <span>{formatRelative(data.updatedAt)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Last heartbeat</span>
                      <span>{formatRelative(data.lastHeartbeat)}</span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="capabilities">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Advertised capabilities</CardTitle>
                    <CardDescription>
                      Capabilities registered with the mesh discovery service
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.capabilities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No capabilities advertised.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {data.capabilities.map((cap) => (
                          <Badge key={cap} variant="outline" className="font-mono">
                            {cap}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="card">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Agent Card</CardTitle>
                    <CardDescription>
                      Portable identity payload from registration
                      {cardMetadata?.name && ` — ${cardMetadata.name}@${cardMetadata.version}`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.card == null ? (
                      <p className="text-sm text-muted-foreground">
                        No agent card attached to this instance.
                      </p>
                    ) : (
                      <JsonViewer data={data.card} />
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="health">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Health status</CardTitle>
                    <CardDescription>Registry-reported instance health</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3">
                      <AgentStatusBadge status={data.status} />
                      <StatusIndicator
                        tone={
                          data.status === "HEALTHY"
                            ? "success"
                            : data.status === "UNHEALTHY"
                              ? "error"
                              : "warning"
                        }
                        label={`Last heartbeat ${formatRelative(data.lastHeartbeat)}`}
                        pulse={data.status === "HEALTHY"}
                      />
                    </div>
                    <Separator />
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="font-medium">{data.status}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Last heartbeat</dt>
                        <dd>{formatRelative(data.lastHeartbeat)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Created</dt>
                        <dd>{formatRelative(data.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-muted-foreground">Updated</dt>
                        <dd>{formatRelative(data.updatedAt)}</dd>
                      </div>
                    </dl>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tools">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tools</CardTitle>
                    <CardDescription>
                      Tools declared on the agent card spec
                      {cardTools.length > 0 && ` (${cardTools.length})`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {cardTools.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {data.card == null
                          ? "No agent card — tools are defined on the card spec."
                          : "No tools listed in card.spec.tools."}
                      </p>
                    ) : (
                      <div className="rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Tool</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {cardTools.map((tool) => (
                              <TableRow key={tool}>
                                <TableCell className="font-mono text-sm">{tool}</TableCell>
                                <TableCell className="text-right">
                                  <Button variant="ghost" size="sm" asChild>
                                    <Link to={`/tools?search=${encodeURIComponent(tool)}`}>
                                      Browse
                                    </Link>
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="configuration">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Labels</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {Object.keys(data.labels).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No labels.</p>
                      ) : (
                        <dl className="space-y-2 text-sm">
                          {Object.entries(data.labels).map(([key, value]) => (
                            <div key={key} className="flex justify-between gap-4">
                              <dt className="font-mono text-muted-foreground">{key}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Card configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      {cardSpec ? (
                        <>
                          {cardSpec.endpoints?.invoke && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Invoke endpoint</span>
                              <span className="font-mono text-xs">{cardSpec.endpoints.invoke}</span>
                            </div>
                          )}
                          {cardSpec.resources?.timeoutMs != null && (
                            <div className="flex justify-between gap-4">
                              <span className="text-muted-foreground">Timeout</span>
                              <span>{cardSpec.resources.timeoutMs} ms</span>
                            </div>
                          )}
                          {cardSpec.inputSchema != null && (
                            <div>
                              <p className="mb-2 text-muted-foreground">Input schema</p>
                              <JsonViewer data={cardSpec.inputSchema} collapsed />
                            </div>
                          )}
                          {cardSpec.outputSchema != null && (
                            <div>
                              <p className="mb-2 text-muted-foreground">Output schema</p>
                              <JsonViewer data={cardSpec.outputSchema} collapsed />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground">
                          Card spec unavailable — instance may have registered without a card payload.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Raw instance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <JsonViewer data={data} />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
