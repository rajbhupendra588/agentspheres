import { useMemo } from "react";
import { ClipboardList } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LiveFeed } from "@/components/live-feed";
import { EmptyState } from "@/components/empty-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useEventsStore } from "@/stores/events-store";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatRelative } from "@/utils/format";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from "@/components/ui";

export function AuditPage() {
  const events = useEventsStore((s) => s.events);
  const { data: workflows } = useWorkflows();

  const workflowEntries = useMemo(
    () =>
      (workflows?.workflows ?? []).map((wf) => ({
        id: wf.runId,
        type: "workflow.run",
        ts: wf.updatedAt,
        summary: `${wf.workflowType} · ${wf.status}`,
      })),
    [workflows?.workflows],
  );

  const hasData = events.length > 0 || workflowEntries.length > 0;

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Audit Logs"
          description="Audit trail from live mesh events and workflow run history — no synthetic entries."
        />

        {!hasData && (
          <EmptyState
            icon={ClipboardList}
            title="No audit entries"
            description="Enable the live event feed and run mesh operations to populate the audit trail."
          />
        )}

        {workflowEntries.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Workflow history</CardTitle>
              <CardDescription>From GET /mesh/workflow/v1/workflows</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workflowEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-xs">{entry.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{entry.summary}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatRelative(entry.ts)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Live events</CardTitle>
              <CardDescription>From mesh notification SSE stream</CardDescription>
            </CardHeader>
            <CardContent>
              <LiveFeed events={events} maxHeight="28rem" />
            </CardContent>
          </Card>
        )}
      </PageMotion>
    </PageContainer>
  );
}
