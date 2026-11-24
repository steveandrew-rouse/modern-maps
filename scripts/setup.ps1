$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "[India AI OS Maps] Checking prerequisites..." -ForegroundColor Cyan
try { $py = & py -3 --version 2>&1; $pyMinor = [int](& py -3 -c "import sys; print(sys.version_info.minor)") } catch { throw "Python 3.11+ is required. Install Python and enable the py launcher." }
try { $node = & node --version 2>&1; $nodeMajor = [int]((& node --version).TrimStart('v').Split('.')[0]) } catch { throw "Node.js 20+ is required. Install Node.js LTS." }
if ($pyMinor -lt 11) { throw "Python 3.11 or newer is required. Found: $py" }
if ($nodeMajor -lt 20) { throw "Node.js 20 or newer is required. Found: $node" }
Write-Host "Python: $py"
Write-Host "Node:   $node"

if (-not (Test-Path ".venv")) { & py -3 -m venv .venv }
& .\.venv\Scripts\python.exe -m pip install --upgrade pip
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
Push-Location frontend
npm install
Pop-Location

if (-not (Test-Path ".env")) { Copy-Item ".env.example" ".env" }
Write-Host "Setup complete. Run .\scripts\dev.ps1" -ForegroundColor Green
