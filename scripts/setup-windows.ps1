param(
  [switch]$SkipSoftwareInstall,
  [string]$Model = "qwen2.5:7b"
)
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Write-Host "Emily v5.6.1 Windows setup" -ForegroundColor Magenta
if (-not $SkipSoftwareInstall) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "Windows Package Manager (winget) is required, or rerun with -SkipSoftwareInstall after installing Node and Ollama manually."
  }
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  winget install --id Ollama.Ollama --exact --accept-package-agreements --accept-source-agreements
  Write-Host "If Node or Ollama was newly installed, close this window, reopen PowerShell, and rerun with -SkipSoftwareInstall."
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not available in this PowerShell session." }
if ([int](node -p "process.versions.node.split('.')[0]") -lt 20) { throw "Node.js 20 or newer is required." }
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

npm ci
npm run build

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  Write-Host "Downloading the default conversational model ($Model)..."
  ollama pull $Model
} else {
  Write-Warning "Ollama was not detected. Install it from https://ollama.com/download/windows"
}

Write-Host "App setup is complete." -ForegroundColor Green
Write-Host "Install ComfyUI Desktop for NVIDIA from https://www.comfy.org/download"
Write-Host "Then run .\scripts\test-host.ps1 and .\scripts\start-windows.ps1"
