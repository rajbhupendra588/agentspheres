import { optional } from "@agentsphere/common";
import { PORTS } from "@agentsphere/contracts";

export const config = {
  port: Number(optional("AS_PORT", String(PORTS.notification))),
} as const;
