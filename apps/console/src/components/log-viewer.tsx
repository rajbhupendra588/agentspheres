import * as React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchInput } from "@/components/search-input";
import { cn } from "@/lib/utils";

export interface LogLine {
  id?: string;
  timestamp?: string;
  level?: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface LogViewerProps {
  lines: LogLine[];
  className?: string;
  maxHeight?: string;
  stickySearch?: boolean;
}

const levelColors: Record<NonNullable<LogLine["level"]>, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground",
  warn: "text-amber-600 dark:text-amber-400",
  error: "text-destructive",
};

export function LogViewer({
  lines,
  className,
  maxHeight = "24rem",
  stickySearch = true,
}: LogViewerProps) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter(
      (line) =>
        line.message.toLowerCase().includes(q) ||
        line.level?.toLowerCase().includes(q) ||
        line.timestamp?.toLowerCase().includes(q),
    );
  }, [lines, query]);

  return (
    <div className={cn("flex flex-col rounded-lg border border-border bg-muted/30", className)}>
      <div
        className={cn(
          "border-b border-border p-2",
          stickySearch && "sticky top-0 z-10 bg-background/95 backdrop-blur-sm",
        )}
      >
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Filter logs…"
          aria-label="Filter logs"
        />
      </div>
      <ScrollArea style={{ maxHeight }}>
        <div className="font-mono text-xs leading-relaxed" role="log" aria-live="polite">
          {filtered.length === 0 ? (
            <p className="p-4 text-muted-foreground">No log lines match your filter.</p>
          ) : (
            filtered.map((line, index) => (
              <div
                key={line.id ?? `${index}-${line.message.slice(0, 24)}`}
                className="flex gap-3 border-b border-border/50 px-3 py-1.5 last:border-0 hover:bg-muted/50"
              >
                {line.timestamp && (
                  <span className="shrink-0 text-muted-foreground">{line.timestamp}</span>
                )}
                {line.level && (
                  <span
                    className={cn("w-12 shrink-0 uppercase", levelColors[line.level])}
                  >
                    {line.level}
                  </span>
                )}
                <span className={cn("min-w-0 break-all", line.level && levelColors[line.level])}>
                  {line.message}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
