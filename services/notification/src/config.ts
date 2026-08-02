import { optional, ulid } from "@agentsphere/common";
import { PORTS } from "@agentsphere/contracts";

/** Unique durable per process so each replica gets a full live feed (not a queue share). */
const defaultDurable = `notification-sse-${process.env.HOSTNAME ?? "local"}-${process.pid}-${ulid().slice(-8)}`;

export const config = {
  port: Number(optional("AS_PORT", String(PORTS.notification))),
  natsUrl: optional("AS_NATS_URL", ""),
  consumerDurable: optional("AS_NOTIFY_DURABLE", defaultDurable),
} as const;
