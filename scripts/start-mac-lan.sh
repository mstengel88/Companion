#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

lan_address="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$lan_address" ]; then
  echo "No active Wi-Fi address was found. Connect this Mac to Wi-Fi and retry."
  exit 1
fi

npm run build
echo "Emily is available on this Mac: http://127.0.0.1:${PORT:-3000}"
echo "Emily is available on your Wi-Fi: http://${lan_address}:${PORT:-3000}"
exec env HOST=0.0.0.0 npm start
