#!/usr/bin/env bash
set -euo pipefail

if ! command -v tailscale >/dev/null 2>&1; then
  echo "Tailscale is not installed."
  exit 1
fi

tailscale status --json | node -e '
let s="";
process.stdin.on("data",d=>s+=d).on("end",()=>{
  const x=JSON.parse(s);
  const dns=(x.Self?.DNSName||"").replace(/\.$/,"");
  console.log(`Tailscale: ${x.BackendState}${x.Self?.Online?" and online":""}`);
  if(dns) console.log(`Private URL: https://${dns}/`);
});'
tailscale serve status
