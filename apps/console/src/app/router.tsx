import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/layouts/app-shell";
import { useMeshHealth } from "@/hooks/use-mesh-health";
import { useLiveEvents } from "@/hooks/use-live-events";

const DashboardPage = lazy(() =>
  import("@/pages/dashboard/dashboard-page").then((m) => ({ default: m.DashboardPage })),
);
const AgentRegistryPage = lazy(() =>
  import("@/pages/agents/agent-registry-page").then((m) => ({ default: m.AgentRegistryPage })),
);
const RegisterAgentPage = lazy(() =>
  import("@/pages/agents/register-agent-page").then((m) => ({ default: m.RegisterAgentPage })),
);
const TenantsPage = lazy(() =>
  import("@/pages/tenants/tenants-page").then((m) => ({ default: m.TenantsPage })),
);
const AgentDetailsPage = lazy(() =>
  import("@/pages/agents/agent-details-page").then((m) => ({ default: m.AgentDetailsPage })),
);
const AgentGraphPage = lazy(() =>
  import("@/pages/agents/agent-graph-page").then((m) => ({ default: m.AgentGraphPage })),
);
const AgentMarketplacePage = lazy(() =>
  import("@/pages/agents/agent-marketplace-page").then((m) => ({
    default: m.AgentMarketplacePage,
  })),
);
const AgentCardsPage = lazy(() =>
  import("@/pages/agents/agent-cards-page").then((m) => ({ default: m.AgentCardsPage })),
);
const DiscoveryPage = lazy(() =>
  import("@/pages/discovery/discovery-page").then((m) => ({ default: m.DiscoveryPage })),
);
const RoutingPage = lazy(() =>
  import("@/pages/routing/routing-page").then((m) => ({ default: m.RoutingPage })),
);
const TasksPage = lazy(() =>
  import("@/pages/tasks/tasks-page").then((m) => ({ default: m.TasksPage })),
);
const WorkflowsPage = lazy(() =>
  import("@/pages/workflows/workflows-page").then((m) => ({ default: m.WorkflowsPage })),
);
const WorkflowBuilderPage = lazy(() =>
  import("@/pages/workflows/workflow-builder-page").then((m) => ({
    default: m.WorkflowBuilderPage,
  })),
);
const ExecutionLogsPage = lazy(() =>
  import("@/pages/logs/execution-logs-page").then((m) => ({ default: m.ExecutionLogsPage })),
);
const ToolsPage = lazy(() =>
  import("@/pages/tools/tools-page").then((m) => ({ default: m.ToolsPage })),
);
const ToolDetailsPage = lazy(() =>
  import("@/pages/tools/tool-details-page").then((m) => ({ default: m.ToolDetailsPage })),
);
const MemoryPage = lazy(() =>
  import("@/pages/memory/memory-page").then((m) => ({ default: m.MemoryPage })),
);
const EventBusPage = lazy(() =>
  import("@/pages/events/event-bus-page").then((m) => ({ default: m.EventBusPage })),
);
const MetricsPage = lazy(() =>
  import("@/pages/observability/metrics-page").then((m) => ({ default: m.MetricsPage })),
);
const TracingPage = lazy(() =>
  import("@/pages/observability/tracing-page").then((m) => ({ default: m.TracingPage })),
);
const ObservabilityPage = lazy(() =>
  import("@/pages/observability/observability-page").then((m) => ({
    default: m.ObservabilityPage,
  })),
);
const TopologyPage = lazy(() =>
  import("@/pages/observability/topology-page").then((m) => ({ default: m.TopologyPage })),
);
const HealthPage = lazy(() =>
  import("@/pages/observability/health-page").then((m) => ({ default: m.HealthPage })),
);
const KafkaPage = lazy(() =>
  import("@/pages/observability/kafka-page").then((m) => ({ default: m.KafkaPage })),
);
const SecurityPage = lazy(() =>
  import("@/pages/security/security-page").then((m) => ({ default: m.SecurityPage })),
);
const UsersPage = lazy(() =>
  import("@/pages/security/users-page").then((m) => ({ default: m.UsersPage })),
);
const RolesPage = lazy(() =>
  import("@/pages/security/roles-page").then((m) => ({ default: m.RolesPage })),
);
const PermissionsPage = lazy(() =>
  import("@/pages/security/permissions-page").then((m) => ({ default: m.PermissionsPage })),
);
const AuditPage = lazy(() =>
  import("@/pages/security/audit-page").then((m) => ({ default: m.AuditPage })),
);
const ApiExplorerPage = lazy(() =>
  import("@/pages/platform/api-explorer-page").then((m) => ({ default: m.ApiExplorerPage })),
);
const ConfigurationPage = lazy(() =>
  import("@/pages/platform/configuration-page").then((m) => ({ default: m.ConfigurationPage })),
);
const SettingsPage = lazy(() =>
  import("@/pages/platform/settings-page").then((m) => ({ default: m.SettingsPage })),
);
const AboutPage = lazy(() =>
  import("@/pages/platform/about-page").then((m) => ({ default: m.AboutPage })),
);

function AppShellLayout() {
  const { data: health } = useMeshHealth();
  const meshHealthy = health?.status === "ok";
  useLiveEvents();

  return <AppShell meshHealthy={meshHealthy} />;
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShellLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="agents" element={<AgentRegistryPage />} />
          <Route path="agents/register" element={<RegisterAgentPage />} />
          <Route path="agents/graph" element={<AgentGraphPage />} />
          <Route path="agents/marketplace" element={<AgentMarketplacePage />} />
          <Route path="agents/cards" element={<AgentCardsPage />} />
          <Route path="agents/:instanceId" element={<AgentDetailsPage />} />
          <Route path="tenants" element={<TenantsPage />} />
          <Route path="discovery" element={<DiscoveryPage />} />
          <Route path="routing" element={<RoutingPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="workflows/builder" element={<WorkflowBuilderPage />} />
          <Route path="logs" element={<ExecutionLogsPage />} />
          <Route path="tools" element={<ToolsPage />} />
          <Route path="tools/:toolName" element={<ToolDetailsPage />} />
          <Route path="memory" element={<MemoryPage />} />
          <Route path="events" element={<EventBusPage />} />
          <Route path="metrics" element={<MetricsPage />} />
          <Route path="tracing" element={<TracingPage />} />
          <Route path="observability" element={<ObservabilityPage />} />
          <Route path="topology" element={<TopologyPage />} />
          <Route path="health" element={<HealthPage />} />
          <Route path="kafka" element={<KafkaPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="permissions" element={<PermissionsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="api-explorer" element={<ApiExplorerPage />} />
          <Route path="configuration" element={<ConfigurationPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="about" element={<AboutPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
