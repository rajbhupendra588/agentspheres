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
