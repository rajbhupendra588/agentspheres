import { createLogger } from "@agentsphere/common";
import { startServer } from "./server.js";

const log = createLogger("gateway");

startServer().catch((err: unknown) => {
  log.error("failed to start gateway", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
