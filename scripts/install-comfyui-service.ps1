param(
  [string]$ComfyRoot = "E:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI",
  [string]$ListenAddress = "100.118.33.47",
  [int]$Port = 8188,
  [double]$ReserveVramGb = 1.5,
  [string]$TaskName = "EmilyComfyUI"
)

$ErrorActionPreference = "Stop"
$Runner = Join-Path $PSScriptRoot "run-comfyui-service.ps1"
if (-not (Test-Path $Runner)) { throw "ComfyUI runner was not found: $Runner" }

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$Runner`" -ComfyRoot `"$ComfyRoot`" -ListenAddress `"$ListenAddress`" -Port $Port -ReserveVramGb $ReserveVramGb"
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $arguments
$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

if ($existing) {
  Set-ScheduledTask -TaskName $TaskName -Action $action | Out-Null
} else {
  $trigger = New-ScheduledTaskTrigger -AtLogOn
  $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Days 30)
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Runs Emily's ComfyUI renderer with guarded VRAM settings and persistent logs." | Out-Null
}

Write-Host "$TaskName now uses guarded VRAM settings and writes data\logs\comfyui-service.log." -ForegroundColor Green
