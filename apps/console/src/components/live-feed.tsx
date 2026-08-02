import { formatDistanceToNow } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { MeshEvent } from "@/types/events";
import { cn } from "@/lib/utils";

export interface LiveFeedProps {
  events: MeshEvent[];
  className?: string;
  maxHeight?: string;
  onEventClick?: (event: MeshEvent) => void;
}

export function LiveFeed({
  events,
  className,
  maxHeight = "20rem",
  onEventClick,
}: LiveFeedProps) {
  return (
    <ScrollArea className={cn("rounded-lg border border-border", className)} style={{ maxHeight }}>
      <ul className="divide-y divide-border">
        {events.length === 0 ? (
          <li className="p-4 text-sm text-muted-foreground">No events yet.</li>
        ) : (
          events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={() => onEventClick?.(event)}
              >
                <Badge variant="outline" className="shrink-0 font-mono text-[10px] uppercase">
                  {event.type}
                </Badge>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {typeof event.payload === "string"
                      ? event.payload
                      : JSON.stringify(event.payload).slice(0, 120)}
                  </p>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={event.ts}
                    title={event.ts}
                  >
                    {formatDistanceToNow(new Date(event.ts), { addSuffix: true })}
                  </time>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </ScrollArea>
  );
}
