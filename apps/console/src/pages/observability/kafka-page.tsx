import { useMemo } from "react";
import { subjects } from "@agentsphere/contracts";
import { Radio } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LiveFeed } from "@/components/live-feed";
import { PageMotion } from "@/pages/shared/page-motion";
import { useEventsStore } from "@/stores/events-store";
import { usePreferencesStore } from "@/stores/preferences-store";
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
} from "@/components/ui";

const SUBJECT_ENTRIES = Object.entries(subjects).map(([key, subject]) => ({
  key,
  subject,
}));

export function KafkaPage() {
  const events = useEventsStore((s) => s.events);
  const liveFeedEnabled = usePreferencesStore((s) => s.liveFeedEnabled);

  const filteredEvents = useMemo(() => {
    const subjectValues = new Set(Object.values(subjects));
    return events.filter((e) => {
      const type = e.type.toLowerCase();
      return Array.from(subjectValues).some(
        (s) => type.includes(s) || type.includes(s.split(".").pop() ?? ""),
      );
    });
  }, [events]);

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Event Topics (NATS)"
          description="AgentSphere uses NATS (not Kafka) for the event bus. Subjects are defined in @agentsphere/contracts."
        />

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Contract subjects</CardTitle>
            <CardDescription>
              Published NATS subjects from the shared contracts package — documentation, not a live
              topic browser API.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Subject</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SUBJECT_ENTRIES.map(({ key, subject }) => (
                    <TableRow key={key}>
                      <TableCell className="font-medium">{key}</TableCell>
                      <TableCell className="font-mono text-sm">{subject}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Live events (filtered)
            </CardTitle>
            <CardDescription>
              Events from the SSE feed that match contract subject patterns
              {!liveFeedEnabled && " — enable live feed in Event Bus or Settings"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveFeed
              events={filteredEvents.length > 0 ? filteredEvents : events}
              maxHeight="24rem"
            />
          </CardContent>
        </Card>
      </PageMotion>
    </PageContainer>
  );
}
