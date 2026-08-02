import { optional } from "@agentsphere/common";
import { PORTS } from "@agentsphere/contracts";

export const config = {
  port: Number(optional("AS_PORT", String(PORTS.workflow))),
  runtimeUrl: optional("AS_RUNTIME_URL", "http://localhost:8084"),
  natsUrl: process.env.AS_NATS_URL,
  temporalAddress: process.env.AS_TEMPORAL_ADDRESS,
} as const;
