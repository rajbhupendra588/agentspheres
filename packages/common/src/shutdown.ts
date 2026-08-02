import { createLogger } from "./logger.js";

type Closeable = {
  close: () => Promise<unknown> | unknown;
};

const log = createLogger("shutdown");

/**
 * Register SIGINT/SIGTERM handlers that close Fastify (and optional resources)
 * with a hard timeout so containers exit cleanly under orchestration.
 */
export function registerGracefulShutdown(
  service: string,
  app: Closeable,
  extras: Array<Closeable | undefined> = [],
  timeoutMs = 10_000,
): void {
  let shuttingDown = false;

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log.info("received shutdown signal", { service, signal });

    const timer = setTimeout(() => {
      log.error("shutdown timed out; forcing exit", { service, timeoutMs });
      process.exit(1);
    }, timeoutMs);
    timer.unref?.();

    void (async () => {
      try {
        await app.close();
        for (const extra of extras) {
          if (extra) {
            await extra.close();
          }
        }
        clearTimeout(timer);
        log.info("shutdown complete", { service });
        process.exit(0);
      } catch (err) {
        clearTimeout(timer);
        log.error("shutdown failed", {
          service,
          error: err instanceof Error ? err.message : String(err),
        });
        process.exit(1);
      }
    })();
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}
