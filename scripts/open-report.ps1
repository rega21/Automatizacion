param(
  [string]$ReportPath = 'artifacts/report.html'
)

if (-not (Test-Path $ReportPath)) {
  Write-Host "Report not found at $ReportPath" -ForegroundColor Red
  exit 1
}

$absolutePath = (Resolve-Path $ReportPath).Path
$fileUrl = "file:///$($absolutePath -replace '\\', '/')"

Write-Host "Opening report: $fileUrl" -ForegroundColor Cyan
Start-Process $fileUrl
