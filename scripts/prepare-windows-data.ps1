param(
  [Parameter(Mandatory = $true)]
  [string]$ComfyInputPath
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$References = Join-Path $ProjectRoot "data\references"

if (-not (Test-Path $ComfyInputPath -PathType Container)) {
  throw "ComfyUI input folder not found: $ComfyInputPath"
}

$Files = Get-ChildItem $References -File | Where-Object { $_.Name -like "emily-reference-*" }
if ($Files.Count -lt 2) {
  throw "Expected two Emily reference files in $References"
}

foreach ($File in $Files) {
  Copy-Item $File.FullName (Join-Path $ComfyInputPath $File.Name) -Force
  Write-Host "Copied $($File.Name) to ComfyUI input" -ForegroundColor Green
}

Write-Host "Emily's portable data and ComfyUI references are ready." -ForegroundColor Green
