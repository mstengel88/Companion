$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "Starting Emily v5.6.1 at http://127.0.0.1:3000" -ForegroundColor Green
npm start
