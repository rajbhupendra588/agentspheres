import path from "node:path";
import type { IncomingMessage } from "node:http";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const gatewayUrl = (process.env.AS_GATEWAY_URL ?? "http://localhost:8080").replace(/\/$/, "");
const bootstrapSecret = process.env.AS_BOOTSTRAP_SECRET ?? "";

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/** Serve /config.js and proxy /api/auth/token with server-side bootstrap. */
function consoleDevPlugin(): Plugin {
  return {
    name: "agentsphere-console-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === "/config.js") {
          res.setHeader("Content-Type", "application/javascript");
          res.end(`window.AGENTSPHERE_GATEWAY = "";\n`);
          return;
        }
        next();
      });

      server.middlewares.use("/api/auth/token", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }

        try {
          const body = await readBody(req);
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
          };
          if (bootstrapSecret) {
            headers["x-agentsphere-bootstrap"] = bootstrapSecret;
          }

          const upstream = await fetch(`${gatewayUrl}/mesh/auth/v1/token`, {
            method: "POST",
            headers,
            body,
          });
          const text = await upstream.text();
          res.statusCode = upstream.status;
          res.setHeader(
            "Content-Type",
            upstream.headers.get("content-type") ?? "application/json",
          );
          res.end(text);
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: {
                code: "GATEWAY_UNREACHABLE",
                message: err instanceof Error ? err.message : "Gateway unreachable",
              },
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), consoleDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/mesh": {
        target: gatewayUrl,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-flow": ["@xyflow/react"],
          "vendor-charts": ["recharts"],
        },
      },
    },
  },
});
