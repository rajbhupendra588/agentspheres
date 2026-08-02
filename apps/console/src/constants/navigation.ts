export type NavItem = {
  label: string;
  href: string;
  description?: string;
  keywords?: string[];
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Dashboard",
    items: [
      {
        label: "Dashboard",
        href: "/",
        description: "Mesh overview and live status",
        keywords: ["home", "overview"],
      },
    ],
  },
  {
    title: "Agents",
    items: [
      {
        label: "Registry",
        href: "/agents",
        description: "Registered agent instances",
        keywords: ["agents", "registry", "instances"],
      },
      {
        label: "Register Agent",
        href: "/agents/register",
        description: "Register an agent into the active tenant",
        keywords: ["register", "onboard", "agent card"],
      },
      {
        label: "Agent Graph",
        href: "/agents/graph",
        description: "Visual agent topology",
        keywords: ["graph", "topology", "relationships"],
      },
      {
        label: "Marketplace",
        href: "/agents/marketplace",
        description: "Discover and deploy agents",
        keywords: ["marketplace", "catalog"],
      },
      {
        label: "Cards",
        href: "/agents/cards",
        description: "Agent card definitions",
        keywords: ["cards", "specs"],
      },
      {
        label: "Discovery",
        href: "/discovery",
        description: "Capability-based agent discovery",
        keywords: ["discover", "capabilities"],
      },
    ],
  },
  {
    title: "Runtime",
    items: [
      {
        label: "Routing",
        href: "/routing",
        description: "Mesh routing policies",
        keywords: ["routing", "policies"],
      },
      {
        label: "Tasks",
        href: "/tasks",
        description: "Active and queued tasks",
        keywords: ["tasks", "queue"],
      },
      {
        label: "Workflows",
        href: "/workflows",
        description: "Workflow run history",
        keywords: ["workflows", "runs"],
      },
      {
        label: "Workflow Builder",
        href: "/workflows/builder",
        description: "Compose multi-agent workflows",
        keywords: ["builder", "compose", "dag"],
      },
      {
        label: "Execution Logs",
        href: "/logs",
        description: "Invocation and execution logs",
        keywords: ["logs", "execution", "history"],
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        label: "Tools",
        href: "/tools",
        description: "Tool registry and execution",
        keywords: ["tools", "mcp"],
      },
      {
        label: "Memory",
        href: "/memory",
        description: "Session and workspace memory",
        keywords: ["memory", "context"],
      },
      {
        label: "Event Bus",
        href: "/events",
        description: "Live mesh event stream",
        keywords: ["events", "nats", "bus"],
      },
    ],
  },
  {
    title: "Observability",
    items: [
      {
        label: "Metrics",
        href: "/metrics",
        description: "Prometheus-style metrics",
        keywords: ["metrics", "prometheus"],
      },
      {
        label: "Tracing",
        href: "/tracing",
        description: "Distributed traces",
        keywords: ["tracing", "otel", "spans"],
      },
      {
        label: "Observability",
        href: "/observability",
        description: "Unified observability dashboard",
        keywords: ["observability", "dashboard"],
      },
      {
        label: "Topology",
        href: "/topology",
        description: "Service mesh topology map",
        keywords: ["topology", "map"],
      },
      {
        label: "Health",
        href: "/health",
        description: "Service health checks",
        keywords: ["health", "status"],
      },
      {
        label: "Kafka Topics",
        href: "/kafka",
        description: "Kafka topic browser",
        keywords: ["kafka", "topics"],
      },
    ],
  },
  {
    title: "Security",
    items: [
      {
        label: "Tenants",
        href: "/tenants",
        description: "Create and manage organizations",
        keywords: ["tenants", "orgs", "multi-tenant"],
      },
      {
        label: "Security",
        href: "/security",
        description: "Security policies and posture",
        keywords: ["security", "policies"],
      },
      {
        label: "Users",
        href: "/users",
        description: "User accounts",
        keywords: ["users", "accounts"],
      },
      {
        label: "Roles",
        href: "/roles",
        description: "Role definitions",
        keywords: ["roles", "rbac"],
      },
      {
        label: "Permissions",
        href: "/permissions",
        description: "Permission matrix",
        keywords: ["permissions", "access"],
      },
      {
        label: "Audit Logs",
        href: "/audit",
        description: "Immutable audit trail",
        keywords: ["audit", "compliance"],
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        label: "API Explorer",
        href: "/api-explorer",
        description: "Interactive mesh API explorer",
        keywords: ["api", "explorer", "rest"],
      },
      {
        label: "Configuration",
        href: "/configuration",
        description: "Platform configuration",
        keywords: ["config", "settings"],
      },
      {
        label: "Settings",
        href: "/settings",
        description: "Console preferences",
        keywords: ["settings", "preferences"],
      },
      {
        label: "About",
        href: "/about",
        description: "AgentSphere version and info",
        keywords: ["about", "version"],
      },
    ],
  },
];

export const COMMAND_PALETTE_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    description: item.description ?? section.title,
  })),
);

export type KeyboardShortcut = {
  id: string;
  label: string;
  keys: string[];
  modifier: "meta" | "ctrl";
};

export const KEYBOARD_SHORTCUTS: KeyboardShortcut[] = [
  {
    id: "command-palette",
    label: "Open command palette",
    keys: ["k"],
    modifier: "meta",
  },
  {
    id: "toggle-sidebar",
    label: "Toggle sidebar",
    keys: ["b"],
    modifier: "meta",
  },
];
