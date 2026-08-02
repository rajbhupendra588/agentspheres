import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricTileProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: {
    value: number;
    label?: string;
  };
  className?: string;
}

export function MetricTile({ label, value, hint, trend, className }: MetricTileProps) {
  const trendUp = trend && trend.value >= 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-b border-border pb-4 sm:border-b-0 sm:border-r sm:pr-6 last:border-0 last:pr-0",
        className,
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-brand text-2xl font-semibold tabular-nums tracking-tight">{value}</span>
      {(hint || trend) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-medium",
                trendUp ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
              )}
            >
              {trendUp ? (
                <TrendingUp className="h-3 w-3" aria-hidden />
              ) : (
                <TrendingDown className="h-3 w-3" aria-hidden />
              )}
              {Math.abs(trend.value)}%
              {trend.label && <span className="font-normal text-muted-foreground">{trend.label}</span>}
            </span>
          )}
          {hint && !trend && <span>{hint}</span>}
          {hint && trend && <span>{hint}</span>}
        </div>
      )}
    </div>
  );
}
