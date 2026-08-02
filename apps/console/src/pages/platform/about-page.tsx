import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { PageContainer } from "@/layouts/page-container";
import { PageHeader } from "@/components/page-header";
import { MetricTile } from "@/components/metric-tile";
import { PageMotion } from "@/pages/shared/page-motion";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { resolveAbsoluteGatewayUrl } from "@/api/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button } from "@/components/ui";

export function AboutPage() {
  const { data: health } = useMeshHealth();
  const healthUrl = resolveAbsoluteGatewayUrl("/mesh/health");

  return (
    <PageContainer>
      <PageMotion>
        <PageHeader
          title="About AgentSphere"
          description="Enterprise AI Agent Service Mesh — control plane and data plane for agent identity, discovery, governed invoke, tools, memory, and workflows."
          actions={<BrandLogo variant="full" className="max-w-[180px]" />}
        />

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <MetricTile label="Version" value="0.1.0" />
          <MetricTile label="Mesh status" value={health?.status === "ok" ? "Healthy" : "—"} />
          <MetricTile label="Services" value={health?.services.length ?? "—"} />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Product</CardTitle>
            <CardDescription>From the AgentSphere README</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              AgentSphere is an enterprise AI Agent Service Mesh providing a control plane and data
              plane for agent identity, discovery, governed A2A invoke, tools, memory, and
              multi-agent workflows.
            </p>
            <p>
              Mesh layers include Gateway (edge), Auth/Registry/Discovery (control plane),
              Runtime/Tool Engine/Memory (data plane), Workflow orchestration, and SDK sidecar agents.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <Link to="/health">Mesh health in console</Link>
            </Button>
            <Button variant="outline" asChild>
              <a href={healthUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                Open /mesh/health
              </a>
            </Button>
          </CardContent>
        </Card>
      </PageMotion>
    </PageContainer>
  );
}
