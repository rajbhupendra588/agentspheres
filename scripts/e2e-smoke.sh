#!/usr/bin/env bash
set -euo pipefail

GATEWAY="${AS_GATEWAY_PUBLIC_URL:-http://localhost:8080}"

echo "==> Gateway root"
curl -fsS "$GATEWAY/" | tee /tmp/as-root.json >/dev/null

echo "==> Mesh health"
curl -fsS "$GATEWAY/mesh/health" | tee /tmp/as-health.json >/dev/null

echo "==> Wait for agents (up to 60s)"
for i in $(seq 1 30); do
  agents=$(curl -fsS "$GATEWAY/mesh/registry/v1/agents" || echo '{}')
  count=$(node -e "const d=JSON.parse(process.argv[1]); const a=d.agents||d||[]; console.log(Array.isArray(a)?a.length:0)" "$agents")
  if [[ "$count" -ge 2 ]]; then
    echo "Found $count agents"
    break
  fi
  sleep 2
  if [[ "$i" -eq 30 ]]; then
    echo "Timed out waiting for agents" >&2
    echo "$agents" >&2
    exit 1
  fi
done

echo "==> ToolSphere list tools"
curl -fsS "$GATEWAY/mesh/tools/v1/tools" | tee /tmp/as-tools.json >/dev/null

echo "==> ToolSphere discover (capability mesh.tracing)"
curl -fsS "$GATEWAY/mesh/tools/v1/tools/discover?capability=mesh.tracing" | tee /tmp/as-tool-discover.json >/dev/null

echo "==> ToolSphere execute mesh.tracing"
curl -fsS -X POST "$GATEWAY/mesh/tools/v1/execute" \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: default' \
  -d '{"tool":"mesh.tracing","input":{}}' \
  | tee /tmp/as-tool-execute.json >/dev/null

echo "==> Discover research.web"
curl -fsS "$GATEWAY/mesh/discovery/v1/discover?capability=research.web" | tee /tmp/as-discover.json >/dev/null

echo "==> Invoke research.web"
curl -fsS -X POST "$GATEWAY/mesh/runtime/v1/invoke" \
  -H 'content-type: application/json' \
  -d '{"capability":"research.web","input":{"topic":"agent service mesh"}}' \
  | tee /tmp/as-invoke.json >/dev/null

echo "==> Workflow research-synthesize"
curl -fsS -X POST "$GATEWAY/mesh/workflow/v1/workflows/research-synthesize" \
  -H 'content-type: application/json' \
  -d '{"topic":"AgentSphere E2E"}' \
  | tee /tmp/as-workflow.json >/dev/null

echo "SMOKE OK"
