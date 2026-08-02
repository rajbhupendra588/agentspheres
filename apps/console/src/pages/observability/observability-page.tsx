import { Link } from "react-router-dom";
import {
  Activity,
  GitBranch,
  HeartPulse,
  LayoutGrid,
  Network,
} from "lucide-react";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { LoadingState } from "@/components/loading-state";
import { PageMotion } from "@/pages/shared/page-motion";
import { useAgents } from "@/hooks/use-agents";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatNumber } from "@/utils/format";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";

const LINKS = [
  {
    href: "/metrics",
    title: "Metrics",
    description: "Agent, service, and workflow counts",
    icon: Activity,
  },
  {
    href: "/tracing",
    title: "Tracing",
    description: "Workflow step timelines",
    icon: GitBranch,
  },
  {
    href: "/health",
    title: "Health",
    description: "Per-service mesh health",
    icon: HeartPulse,
  },
  {
    href: "/topology",
    title: "Topology",
    description: "Agent graph and service nodes",
    icon: Network,
  },
] as const;

export function ObservabilityPage() {
  const { data: health, isLoading: healthLoading } = useMeshHealth();
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: workflows, isLoading: workflowsLoading } = useWorkflows();

  const isLoading = healthLoading || agentsLoading || workflowsLoading;
  const servicesUp = health?.services.filter((s) => s.status === "ok").length ?? 0;
  const servicesTotal = health?.services.length ?? 0;
  const healthyAgents = agents?.agents.filter((a) => a.status === "HEALTHY").length ?? 0;

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="Observability"
          description="Unified view of mesh health, agents, and workflows."
        />

        {isLoading ? (
          <LoadingState variant="cards" />
        ) : (
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile
              label="Mesh status"
              value={health?.status === "ok" ? "Healthy" : "Degraded"}
            />
            <MetricTile label="Services up" value={`${servicesUp}/${servicesTotal}`} />
            <MetricTile
              label="Healthy agents"
              value={`${healthyAgents}/${agents?.count ?? 0}`}
            />
            <MetricTile label="Workflow runs" value={formatNumber(workflows?.workflows.length ?? 0)} />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map(({ href, title, description, icon: Icon }) => (
            <Link key={href} to={href} className="group block">
              <Card className="transition-colors hover:border-primary/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{title}</CardTitle>
                      <CardDescription>{description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <span className="text-sm text-primary">Open →</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LayoutGrid className="h-4 w-4" />
              Event topics
            </CardTitle>
            <CardDescription>NATS subjects documented on the Event Topics page</CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/kafka" className="text-sm text-primary hover:underline">
              View Event Topics (NATS) →
            </Link>
          </CardContent>
        </Card>
      </PageMotion>
    </PageContainer>
  );
}
