param(
  [string]$ComfyUrl = "http://100.118.33.47:8188",
  [string]$RendererTask = "EmilyComfyUI"
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "data\logs"
$LogFile = Join-Path $LogDir "comfyui-watchdog.log"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-WatchdogLog([string]$Message) {
  Add-Content -Path $LogFile -Value "$(Get-Date -Format o) $Message"
}

$healthy = $false
for ($attempt = 1; $attempt -le 3; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$ComfyUrl/system_stats" -TimeoutSec 5
    if ($response.StatusCode -eq 200) { $healthy = $true; break }
  } catch {}
  if ($attempt -lt 3) { Start-Sleep -Seconds 15 }
}

if ($healthy) { exit 0 }

Write-WatchdogLog "Health failed three times; restarting scheduled task $RendererTask."
try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ComfyUrl/interrupt" -ContentType "application/json" -Body "{}" -TimeoutSec 3 | Out-Null } catch {}
try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ComfyUrl/queue" -ContentType "application/json" -Body '{"clear":true}' -TimeoutSec 3 | Out-Null } catch {}
Stop-ScheduledTask -TaskName $RendererTask -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-ScheduledTask -TaskName $RendererTask -ErrorAction SilentlyContinue
Write-WatchdogLog "Restart requested."
