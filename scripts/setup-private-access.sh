#!/usr/bin/env bash
set -euo pipefail

port="${PORT:-3000}"
if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not installed. Use the official macOS installer: https://tailscale.com/download/mac"
  exit 1
fi

state="$(tailscale status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(JSON.parse(s).BackendState||""))')"
if [ "$state" != "Running" ]; then
  echo "Tailscale is installed but not connected. Open Tailscale, sign in, then rerun this script."
  exit 1
fi

if ! curl -fsS "http://127.0.0.1:${port}/api/auth/status" >/dev/null; then
  echo "Emily is not responding locally on port ${port}. Start the app or install the Mac service first."
  exit 1
fi

tailscale serve --bg --yes "http://127.0.0.1:${port}"
dns_name="$(tailscale status --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write((JSON.parse(s).Self?.DNSName||"").replace(/\.$/,"")))')"
echo "Private Emily URL: https://${dns_name}/"
echo "Install Tailscale on the phone and sign in to the same tailnet. This URL is not public."
