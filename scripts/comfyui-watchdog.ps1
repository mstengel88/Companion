param(
  [string]$ComfyUrl = "http://100.118.33.47:8188",
  [string]$RendererTask = "EmilyComfyUI"
)

$ErrorActionPreference = "SilentlyContinue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "data\logs"
$LogFile = Join-Path $LogDir "comfyui-watchdog.log"
$FailureState = Join-Path $LogDir "comfyui-watchdog-failures.txt"
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

function Write-WatchdogLog([string]$Message) {
  Add-Content -Path $LogFile -Value "$(Get-Date -Format o) $Message"
}

$healthy = $false
for ($attempt = 1; $attempt -le 2; $attempt += 1) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$ComfyUrl/system_stats" -TimeoutSec 5
    if ($response.StatusCode -eq 200) { $healthy = $true; break }
  } catch {}
  if ($attempt -lt 2) { Start-Sleep -Seconds 10 }
}

if ($healthy) {
  Set-Content -Path $FailureState -Value "0"
  exit 0
}

$failures = 0
if (Test-Path $FailureState) { $failures = [int](Get-Content $FailureState -ErrorAction SilentlyContinue) }
$failures += 1
Set-Content -Path $FailureState -Value $failures

try {
  $queue = Invoke-WebRequest -UseBasicParsing -Uri "$ComfyUrl/queue" -TimeoutSec 3
  Write-WatchdogLog "Health failure $failures. Queue: $($queue.Content)"
} catch {
  Write-WatchdogLog "Health failure $failures. Queue unavailable: $($_.Exception.Message)"
}

try {
  $gpu = & nvidia-smi --query-gpu=driver_version,memory.total,memory.used,utilization.gpu,temperature.gpu --format=csv,noheader 2>&1
  Write-WatchdogLog "GPU before recovery: $gpu"
} catch {}

Write-WatchdogLog "Health failed twice; restarting scheduled task $RendererTask."
try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ComfyUrl/interrupt" -ContentType "application/json" -Body "{}" -TimeoutSec 3 | Out-Null } catch {}
try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$ComfyUrl/queue" -ContentType "application/json" -Body '{"clear":true}' -TimeoutSec 3 | Out-Null } catch {}
Stop-ScheduledTask -TaskName $RendererTask -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match "ComfyUI.*main\.py" } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-ScheduledTask -TaskName $RendererTask -ErrorAction SilentlyContinue
Write-WatchdogLog "Restart requested."
