# Stops the local India AI OS Maps API dev server (uvicorn) only.
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
  Where-Object { $_.CommandLine -like '*uvicorn*app.main*' } |
  ForEach-Object {
    Stop-Process -Id $_.ProcessId -Force
    Write-Output "stopped $($_.ProcessId)"
  }
