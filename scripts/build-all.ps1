$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "[1/4] Installing dependencies" -ForegroundColor Cyan
& .\scripts\setup.ps1

Write-Host "[2/4] Running backend tests" -ForegroundColor Cyan
$env:PYTHONPATH = "backend"
& .\.venv\Scripts\python.exe -m pytest -q backend\tests
Remove-Item Env:\PYTHONPATH
if ($LASTEXITCODE -ne 0) { throw "Backend tests failed." }

Write-Host "[3/4] Building frontend" -ForegroundColor Cyan
Push-Location frontend
npm run build
$frontendExit = $LASTEXITCODE
Pop-Location
if ($frontendExit -ne 0) { throw "Frontend build failed." }

Write-Host "[4/4] Build summary" -ForegroundColor Cyan
Write-Host "Backend: tested" -ForegroundColor Green
Write-Host "Frontend: frontend\dist" -ForegroundColor Green
Write-Host "Reminder: external data connectors remain disabled; the dashboard uses synthetic scenarios only." -ForegroundColor Yellow
