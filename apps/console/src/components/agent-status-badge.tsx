import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type AgentHealthStatus = "HEALTHY" | "UNHEALTHY" | "DRAINING" | "REGISTERED" | "UNKNOWN";

const statusConfig: Record<
  AgentHealthStatus,
  { label: string; variant: BadgeProps["variant"] }
> = {
  HEALTHY: { label: "Healthy", variant: "success" },
  UNHEALTHY: { label: "Unhealthy", variant: "error" },
  DRAINING: { label: "Draining", variant: "warning" },
  REGISTERED: { label: "Registered", variant: "info" },
  UNKNOWN: { label: "Unknown", variant: "neutral" },
};

export interface AgentStatusBadgeProps {
  status: AgentHealthStatus | string;
  className?: string;
}

export function AgentStatusBadge({ status, className }: AgentStatusBadgeProps) {
  const key = (status in statusConfig ? status : "UNKNOWN") as AgentHealthStatus;
  const config = statusConfig[key];

  return (
    <Badge variant={config.variant} className={cn("font-medium", className)}>
      {config.label}
    </Badge>
  );
}
