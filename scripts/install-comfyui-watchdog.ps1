param(
  [string]$ComfyUrl = "http://100.118.33.47:8188",
  [string]$RendererTask = "EmilyComfyUI"
)

$ErrorActionPreference = "Stop"
$Watchdog = Join-Path $PSScriptRoot "comfyui-watchdog.ps1"
if (-not (Test-Path $Watchdog)) { throw "Watchdog script was not found: $Watchdog" }

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Watchdog`" -ComfyUrl `"$ComfyUrl`" -RendererTask `"$RendererTask`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 2)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName "EmilyComfyUIWatchdog" -Action $action -Trigger $trigger -Settings $settings -Description "Records renderer and GPU diagnostics, then restarts Emily's ComfyUI task after two failed health checks." -Force | Out-Null
Write-Host "Emily ComfyUI watchdog installed. It checks every two minutes." -ForegroundColor Green
