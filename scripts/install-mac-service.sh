#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
service_label="com.local.emily-companion"
user_id="$(id -u)"
launch_agents_dir="${HOME}/Library/LaunchAgents"
plist_path="${launch_agents_dir}/${service_label}.plist"
log_dir="${project_root}/data/logs"
npm_path="$(command -v npm || true)"

if [ -z "$npm_path" ]; then
  echo "npm was not found. Install Node.js 20 or newer first."
  exit 1
fi

cd "$project_root"
npm run build
mkdir -p "$launch_agents_dir" "$log_dir"

if launchctl print "gui/${user_id}/${service_label}" >/dev/null 2>&1; then
  launchctl bootout "gui/${user_id}/${service_label}"
fi

if [ -f "$plist_path" ]; then
  cp -p "$plist_path" "${plist_path}.backup"
fi

plutil -create xml1 "$plist_path"
plutil -insert Label -string "$service_label" "$plist_path"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments array" "$plist_path"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments:0 string $npm_path" "$plist_path"
/usr/libexec/PlistBuddy -c "Add :ProgramArguments:1 string start" "$plist_path"
plutil -insert WorkingDirectory -string "$project_root" "$plist_path"
plutil -insert RunAtLoad -bool true "$plist_path"
plutil -insert KeepAlive -bool true "$plist_path"
plutil -insert ProcessType -string Background "$plist_path"
plutil -insert ThrottleInterval -integer 10 "$plist_path"
plutil -insert StandardOutPath -string "${log_dir}/service.log" "$plist_path"
plutil -insert StandardErrorPath -string "${log_dir}/service-error.log" "$plist_path"
/usr/libexec/PlistBuddy -c "Add :EnvironmentVariables dict" "$plist_path"
/usr/libexec/PlistBuddy -c "Add :EnvironmentVariables:PATH string /opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" "$plist_path"
plutil -lint "$plist_path"

launchctl bootstrap "gui/${user_id}" "$plist_path"
launchctl kickstart -k "gui/${user_id}/${service_label}"

echo "Emily is installed as a login service."
echo "Status: ./scripts/status-mac-lan.sh"
echo "Logs: ${log_dir}"
