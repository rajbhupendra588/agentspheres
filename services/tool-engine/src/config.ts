import { optional, required } from "@agentsphere/common";
import { PORTS } from "@agentsphere/contracts";

export const toolEngineConfig = {
  port: Number(optional("PORT", String(PORTS.toolEngine))),
  databaseUrl: () => required("AS_DATABASE_URL"),
  natsUrl: () => optional("AS_NATS_URL", ""),
  defaultTimeoutMs: Number(optional("AS_TOOL_DEFAULT_TIMEOUT_MS", "30000")),
  maxConcurrentExecutions: Number(optional("AS_TOOL_MAX_CONCURRENT", "10000")),
  maxConcurrentPerTool: Number(optional("AS_TOOL_MAX_CONCURRENT_PER_TOOL", "500")),
  maxConcurrentPerTenant: Number(optional("AS_TOOL_MAX_CONCURRENT_PER_TENANT", "2000")),
  circuitBreakerFailureThreshold: Number(optional("AS_TOOL_CB_FAILURES", "20")),
  circuitBreakerResetMs: Number(optional("AS_TOOL_CB_RESET_MS", "30000")),
  metricsWindowMs: Number(optional("AS_TOOL_METRICS_WINDOW_MS", "60000")),
  healthProbeIntervalMs: Number(optional("AS_TOOL_HEALTH_INTERVAL_MS", "30000")),
};
