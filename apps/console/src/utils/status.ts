const STATUS_COLOR_MAP: Record<string, string> = {
  HEALTHY:
    "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-900",
  UNHEALTHY:
    "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/50 dark:border-red-900",
  DRAINING:
    "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-900",
  OK: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-900",
  DEGRADED:
    "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/50 dark:border-amber-900",
  ERROR:
    "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/50 dark:border-red-900",
  RUNNING:
    "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/50 dark:border-sky-900",
  SUCCEEDED:
    "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/50 dark:border-emerald-900",
  FAILED:
    "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/50 dark:border-red-900",
  PENDING:
    "text-muted-foreground bg-muted border-border",
};

const DEFAULT_STATUS_COLOR =
  "text-muted-foreground bg-muted border-border";

export function statusColor(status: string): string {
  const normalized = status.trim().toUpperCase();
  return STATUS_COLOR_MAP[normalized] ?? DEFAULT_STATUS_COLOR;
}
