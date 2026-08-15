#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required: https://nodejs.org/"
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 20 ]; then
  echo "Node.js 20 or newer is required. Found $(node --version)."
  exit 1
fi

[ -f .env ] || cp .env.example .env
npm install
echo "Ready. Run: npm run dev"
