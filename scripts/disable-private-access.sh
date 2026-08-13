#!/usr/bin/env bash
set -euo pipefail

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not installed."
  exit 1
fi

tailscale serve --https=443 off
echo "Emily's private HTTPS proxy is disabled. Tailscale itself and the local Emily service remain running."
