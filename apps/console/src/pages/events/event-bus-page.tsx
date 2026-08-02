import { useMemo } from "react";
import { Radio } from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { LiveFeed } from "@/components/live-feed";
import { EmptyState } from "@/components/empty-state";
import { StatusIndicator } from "@/components/status-indicator";
import { PageMotion } from "@/pages/shared/page-motion";
import { useEventsStore } from "@/stores/events-store";
import { usePreferencesStore } from "@/stores/preferences-store";
import { Button, Switch, Label } from "@/components/ui";

export function EventBusPage() {
  const events = useEventsStore((s) => s.events);
  const clear = useEventsStore((s) => s.clear);
  const liveFeedEnabled = usePreferencesStore((s) => s.liveFeedEnabled);
  const setLiveFeedEnabled = usePreferencesStore((s) => s.setLiveFeedEnabled);

  const connectionStatus = useMemo(() => {
    if (!liveFeedEnabled) return "disabled" as const;
    if (events.length === 0) return "waiting" as const;
    const latest = new Date(events[0]!.ts).getTime();
    const ageMs = Date.now() - latest;
    return ageMs < 60_000 ? ("connected" as const) : ("stale" as const);
  }, [events, liveFeedEnabled]);

  const statusLabel = {
    connected: "Receiving events",
    waiting: "Connected — waiting for events",
    stale: "Connected — no recent events",
    disabled: "Live feed disabled",
  }[connectionStatus];

  const statusVariant = {
    connected: "success" as const,
    waiting: "warning" as const,
    stale: "warning" as const,
    disabled: "neutral" as const,
  }[connectionStatus];

  return (
    <PageContainer size="wide">
      <PageMotion>
        <PageHeader
          title="Event Bus"
          description="Live mesh event stream from the notification service (NATS-backed)."
          actions={
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="live-feed"
                  checked={liveFeedEnabled}
                  onCheckedChange={setLiveFeedEnabled}
                />
                <Label htmlFor="live-feed" className="text-sm">
                  Live feed
                </Label>
              </div>
              <Button variant="outline" size="sm" onClick={clear} disabled={events.length === 0}>
                Clear
              </Button>
            </div>
          }
        />

        <div className="mb-4">
          <StatusIndicator
            tone={statusVariant}
            label={statusLabel}
            pulse={connectionStatus === "connected"}
          />
        </div>

        {!liveFeedEnabled ? (
          <EmptyState
            icon={Radio}
            title="Live feed is off"
            description="Enable the live feed toggle to subscribe to mesh events via Server-Sent Events from /mesh/notify/v1/events."
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No events yet"
            description="Events appear when agents register, heartbeat, invoke completes, or workflows update. Run pnpm demo to generate activity."
          />
        ) : (
          <LiveFeed events={events} maxHeight="32rem" />
        )}
      </PageMotion>
    </PageContainer>
  );
}
