import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { JsonViewer } from "@/components/json-viewer";
import { StatusIndicator } from "@/components/status-indicator";
import { PageMotion } from "@/pages/shared/page-motion";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { formatRelative } from "@/utils/format";
import { ApiClientError } from "@/api/client";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Switch,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";

const AUTO_REFRESH_MS = 8_000;

export function HealthPage() {
  const { data, isLoading, isError, error, refetch, isFetching, dataUpdatedAt } = useMeshHealth();
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => void refetch(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, refetch]);

  const servicesUp = data?.services.filter((s) => s.status === "ok").length ?? 0;
  const servicesTotal = data?.services.length ?? 0;

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Health"
          description="Aggregate and per-service health from the mesh gateway."
          actions={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <Label htmlFor="auto-refresh" className="text-sm">
                  Auto-refresh
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          }
        />

        {isLoading && <LoadingState variant="cards" />}

        {isError && (
          <ErrorState
            title="Health check failed"
            message={
              error instanceof ApiClientError
                ? error.message
                : "Could not reach GET /mesh/health. Ensure the gateway is running."
            }
            onRetry={() => void refetch()}
          />
        )}

        {data && (
          <>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricTile
                label="Aggregate"
                value={data.status === "ok" ? "OK" : "Degraded"}
              />
              <MetricTile label="Services up" value={`${servicesUp}/${servicesTotal}`} />
              <MetricTile
                label="Last check"
                value={dataUpdatedAt ? formatRelative(new Date(dataUpdatedAt)) : "—"}
              />
              <MetricTile label="Reported at" value={formatRelative(data.ts)} />
            </div>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Services</CardTitle>
                <CardDescription>Individual mesh microservice health probes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.services.map((svc) => (
                        <TableRow key={svc.name}>
                          <TableCell className="font-medium">{svc.name}</TableCell>
                          <TableCell className="font-mono text-xs">{svc.url}</TableCell>
                          <TableCell>
                            <StatusIndicator
                              tone={svc.status === "ok" ? "success" : "error"}
                              label={svc.status}
                            />
                          </TableCell>
                          <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                            {svc.detail ? JSON.stringify(svc.detail).slice(0, 80) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Raw response</CardTitle>
              </CardHeader>
              <CardContent>
                <JsonViewer data={data} />
              </CardContent>
            </Card>
          </>
        )}
      </PageMotion>
    </PageContainer>
  );
}
