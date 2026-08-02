import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-border bg-background/60 p-3 backdrop-blur-sm sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface FilterBarGroupProps {
  label?: string;
  children: ReactNode;
  className?: string;
}

export function FilterBarGroup({ label, children, className }: FilterBarGroupProps) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs", className)}>
      {label && (
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

export function FilterBarActions({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("ml-auto flex items-center gap-2", className)}>{children}</div>
  );
}
