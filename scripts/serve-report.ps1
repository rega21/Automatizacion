param(
  [int]$Port = 8765
)

$reportDir = (Resolve-Path 'artifacts').Path

Write-Host "Starting local server for Bug Hunter Report..." -ForegroundColor Cyan
Write-Host "Serving: $reportDir" -ForegroundColor DarkCyan
Write-Host "Open: http://localhost:$Port/report.html" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Use Python if available, otherwise Node
if (Get-Command python -ErrorAction SilentlyContinue) {
  Push-Location $reportDir
  python -m http.server $Port
  Pop-Location
} elseif (Get-Command node -ErrorAction SilentlyContinue) {
  npm install -g http-server 2>$null
  Push-Location $reportDir
  http-server -p $Port
  Pop-Location
} else {
  Write-Host "No Python or Node found. Please install one of them." -ForegroundColor Red
  exit 1
}
