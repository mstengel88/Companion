$ErrorActionPreference = "Continue"
Write-Host "`nNVIDIA" -ForegroundColor Cyan
if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) { nvidia-smi --query-gpu=name,driver_version,memory.total,memory.free --format=csv,noheader } else { Write-Warning "nvidia-smi not found" }

Write-Host "`nOllama" -ForegroundColor Cyan
try { Invoke-RestMethod http://127.0.0.1:11434/api/tags | ConvertTo-Json -Depth 5 } catch { Write-Warning "Ollama API unavailable: $($_.Exception.Message)" }

Write-Host "`nComfyUI" -ForegroundColor Cyan
try { Invoke-RestMethod http://127.0.0.1:8188/system_stats | ConvertTo-Json -Depth 5 } catch { Write-Warning "ComfyUI API unavailable: $($_.Exception.Message)" }

Write-Host "`nNode" -ForegroundColor Cyan
if (Get-Command node -ErrorAction SilentlyContinue) { node --version } else { Write-Warning "Node not found" }
