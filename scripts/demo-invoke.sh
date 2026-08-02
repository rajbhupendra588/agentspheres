#!/usr/bin/env bash
set -euo pipefail

GATEWAY="${AS_GATEWAY_PUBLIC_URL:-http://localhost:8080}"
TOPIC="${1:-enterprise AI agent service mesh}"

echo "Token (optional demo)"
TENANT="${AS_TENANT_ID:-default}"

BOOTSTRAP_ARGS=()
if [[ -n "${AS_BOOTSTRAP_SECRET:-}" ]]; then
  BOOTSTRAP_ARGS=(-H "x-agentsphere-bootstrap: ${AS_BOOTSTRAP_SECRET}")
fi

TOKEN=$(curl -fsS -X POST "$GATEWAY/mesh/auth/v1/token" \
  -H 'content-type: application/json' \
  "${BOOTSTRAP_ARGS[@]}" \
  -d "{\"subject\":\"demo\",\"role\":\"developer\",\"tenantId\":\"$TENANT\"}" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.parse(s).accessToken||JSON.parse(s).token||''))")

AUTH=()
if [[ -n "${TOKEN}" ]]; then
  AUTH=(-H "Authorization: Bearer $TOKEN")
fi

echo "Invoking research.web for: $TOPIC (tenant=$TENANT)"
curl -fsS -X POST "$GATEWAY/mesh/runtime/v1/invoke" \
  "${AUTH[@]}" \
  -H 'content-type: application/json' \
  -H "x-tenant-id: $TENANT" \
  -d "{\"capability\":\"research.web\",\"tenantId\":\"$TENANT\",\"input\":{\"topic\":$(node -e "console.log(JSON.stringify(process.argv[1]))" "$TOPIC")}}" \
  | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s),null,2)))"
