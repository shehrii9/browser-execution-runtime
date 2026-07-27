#!/usr/bin/env bash
# Zero-dependency demo against a running daemon. No API key required.
set -euo pipefail
BASE="${BER_URL:-http://127.0.0.1:8787}"

echo "== health =="
curl -s "$BASE/health"
echo

echo "== attach =="
curl -s -X POST "$BASE/attach" \
  -H 'content-type: application/json' \
  -d '{"startUrl":"https://example.com"}' | head -c 400
echo

echo "== run plan =="
curl -s -X POST "$BASE/run" \
  -H 'content-type: application/json' \
  -d '{"plan":{"goal":"open example","steps":[{"action":{"type":"navigate","url":"https://example.com"}},{"action":{"type":"extract","target":{"role":"heading","name":"Example Domain"},"key":"heading"}}]}}'
echo
