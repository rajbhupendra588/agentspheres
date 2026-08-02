import { envFlag, optional, resolveJwtSecret } from "@agentsphere/common";
import { PORTS } from "@agentsphere/contracts";

export const config = {
  port: Number(optional("AS_PORT", String(PORTS.gateway))),
  authUrl: optional("AS_AUTH_URL", "http://localhost:8081"),
  registryUrl: optional("AS_REGISTRY_URL", "http://localhost:8082"),
  discoveryUrl: optional("AS_DISCOVERY_URL", "http://localhost:8083"),
  runtimeUrl: optional("AS_RUNTIME_URL", "http://localhost:8084"),
  workflowUrl: optional("AS_WORKFLOW_URL", "http://localhost:8085"),
  toolEngineUrl: optional("AS_TOOL_ENGINE_URL", "http://localhost:8086"),
  memoryUrl: optional("AS_MEMORY_URL", "http://localhost:8087"),
  notificationUrl: optional("AS_NOTIFICATION_URL", "http://localhost:8088"),
  /** Fail-closed by default; local compose sets AS_GATEWAY_OPEN=true. */
  gatewayOpen: envFlag("AS_GATEWAY_OPEN", false),
  jwtSecret: resolveJwtSecret(),
  rateLimitMax: Number(optional("AS_RATE_LIMIT_MAX", "200")),
  rateLimitWindowMs: Number(optional("AS_RATE_LIMIT_WINDOW_MS", "60000")),
  /** Upstream proxy timeout for /mesh/* fan-out (ms). */
  proxyTimeoutMs: Number(optional("AS_PROXY_TIMEOUT_MS", "60000")),
  /** Optional absolute path override for OpenAPI YAML. */
  openApiPath: optional("AS_OPENAPI_PATH", "") || undefined,
} as const;

export const downstreamServices = [
  { name: "auth", url: config.authUrl },
  { name: "registry", url: config.registryUrl },
  { name: "discovery", url: config.discoveryUrl },
  { name: "runtime", url: config.runtimeUrl },
  { name: "workflow", url: config.workflowUrl },
  { name: "tool-engine", url: config.toolEngineUrl },
  { name: "memory", url: config.memoryUrl },
  { name: "notification", url: config.notificationUrl },
] as const;
