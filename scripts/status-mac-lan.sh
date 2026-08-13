#!/usr/bin/env bash
set -euo pipefail
lan_address="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
port="${PORT:-3000}"

if curl -fsS "http://127.0.0.1:${port}/api/health" >/dev/null; then
  echo "Emily is online locally at http://127.0.0.1:${port}"
  [ -n "$lan_address" ] && echo "Phone URL: http://${lan_address}:${port}"
else
  echo "Emily is not responding on port ${port}."
  exit 1
fi
