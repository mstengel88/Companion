#!/usr/bin/env bash
set -euo pipefail

service_label="com.local.emily-companion"
user_id="$(id -u)"
plist_path="${HOME}/Library/LaunchAgents/${service_label}.plist"

if launchctl print "gui/${user_id}/${service_label}" >/dev/null 2>&1; then
  launchctl bootout "gui/${user_id}/${service_label}"
fi

if [ -f "$plist_path" ]; then
  trash_target="${HOME}/.Trash/${service_label}-$(date +%Y%m%d-%H%M%S).plist"
  mv "$plist_path" "$trash_target"
  echo "The service definition was moved to Trash: $trash_target"
else
  echo "No installed Emily service definition was found."
fi

echo "Conversation data, photos, references, logs, and the project were left untouched."
