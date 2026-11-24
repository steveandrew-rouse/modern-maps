$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
if (-not (Test-Path ".venv\Scripts\python.exe")) { throw "Environment missing. Run .\scripts\setup.ps1 first." }
if (-not (Test-Path "frontend\node_modules")) { throw "Frontend packages missing. Run .\scripts\setup.ps1 first." }

$backend = Start-Process -FilePath ".\.venv\Scripts\python.exe" -ArgumentList @("-m", "uvicorn", "app.main:app", "--app-dir", "backend", "--reload", "--host", "127.0.0.1", "--port", "8000") -WorkingDirectory $Root -PassThru -NoNewWindow
try {
    Write-Host "API:      http://127.0.0.1:8000/docs" -ForegroundColor Cyan
    Write-Host "Frontend: http://127.0.0.1:5173" -ForegroundColor Cyan
    Push-Location frontend
    npm run dev
} finally {
    Pop-Location -ErrorAction SilentlyContinue
    if ($backend -and -not $backend.HasExited) { Stop-Process -Id $backend.Id -Force }
}
