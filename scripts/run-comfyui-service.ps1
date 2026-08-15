param(
  [string]$ComfyRoot = "E:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI",
  [string]$ListenAddress = "100.118.33.47",
  [int]$Port = 8188,
  [double]$ReserveVramGb = 1.5
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $ProjectRoot "data\logs"
$LogFile = Join-Path $LogDir "comfyui-service.log"
$PreviousLog = Join-Path $LogDir "comfyui-service.previous.log"
$ConsoleLog = Join-Path $LogDir "comfyui-console.log"
$ErrorLog = Join-Path $LogDir "comfyui-console-error.log"
$Python = Join-Path $ComfyRoot ".venv\Scripts\python.exe"
$Main = Join-Path $ComfyRoot "main.py"

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
if (-not (Test-Path $Python)) { throw "ComfyUI Python was not found: $Python" }
if (-not (Test-Path $Main)) { throw "ComfyUI main.py was not found: $Main" }

if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 20MB) {
  Move-Item -Path $LogFile -Destination $PreviousLog -Force
}

Remove-Item -Path $ConsoleLog, $ErrorLog -Force -ErrorAction SilentlyContinue

$started = Get-Date
Add-Content -Path $LogFile -Value "`n$(Get-Date -Format o) Starting ComfyUI with $ReserveVramGb GB reserved VRAM."

try {
  $arguments = @(
    $Main,
    "--listen", $ListenAddress,
    "--port", $Port,
    "--reserve-vram", $ReserveVramGb,
    "--cpu-vae",
    "--preview-method", "none"
  )
  $process = Start-Process `
    -FilePath $Python `
    -ArgumentList $arguments `
    -WorkingDirectory $ComfyRoot `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $ConsoleLog `
    -RedirectStandardError $ErrorLog
  $exitCode = $process.ExitCode
} catch {
  Add-Content -Path $LogFile -Value "$(Get-Date -Format o) Launcher exception: $($_.Exception.Message)"
  $exitCode = 1
}

Add-Content -Path $LogFile -Value "$(Get-Date -Format o) ComfyUI exited with code $exitCode after $([math]::Round(((Get-Date) - $started).TotalSeconds)) seconds."
exit $exitCode
