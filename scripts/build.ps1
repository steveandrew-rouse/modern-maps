$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $Root 'frontend')
if (-not (Test-Path 'node_modules')) { npm install }
npm run build
Write-Host "Frontend build created at frontend\dist" -ForegroundColor Green
