param(
  [string]$Url = 'https://fobalfoca5.vercel.app/',
  [ValidateSet('menu', 'quick', 'ui', 'report')]
  [string]$Mode = 'menu',
  [switch]$OpenReportAfterScan
)

function Show-Banner {
  Write-Host ''
  Write-Host '=== Bug Hunter Runner ===' -ForegroundColor Cyan
  Write-Host 'Flujo simplificado para corroborar bugs web con interfaz visual.' -ForegroundColor DarkCyan
  Write-Host ''
}

function Print-TelemetrySummary {
  $telemetryPath = 'artifacts/telemetry.json'
  if (-not (Test-Path $telemetryPath)) {
    Write-Host 'No se encontro telemetry.json. Ejecuta un escaneo primero.' -ForegroundColor Yellow
    return
  }

  $telemetry = Get-Content $telemetryPath -Raw | ConvertFrom-Json

  $visitedCount = @($telemetry.visited).Count
  $consoleCount = @($telemetry.consoleIssues).Count
  $failedCount = @($telemetry.failedRequests).Count

  Write-Host ''
  Write-Host 'Resumen rapido:' -ForegroundColor Cyan
  Write-Host "- URL objetivo: $($telemetry.targetUrl)"
  Write-Host "- Paginas visitadas: $visitedCount"
  Write-Host "- Errores/Warnings de consola: $consoleCount"
  Write-Host "- Requests fallidas: $failedCount"

  if ($failedCount -gt 0) {
    Write-Host ''
    Write-Host 'Requests fallidas detectadas:' -ForegroundColor Yellow
    foreach ($item in $telemetry.failedRequests) {
      Write-Host "- $item"
    }
  }

  if ($consoleCount -gt 0) {
    Write-Host ''
    Write-Host 'Errores de consola detectados:' -ForegroundColor Yellow
    foreach ($item in $telemetry.consoleIssues) {
      Write-Host "- $item"
    }
  }
}

function Open-Report {
  $reportPath = 'playwright-report/index.html'
  if (-not (Test-Path $reportPath)) {
    Write-Host 'No hay reporte generado todavia.' -ForegroundColor Yellow
    return
  }

  Start-Process powershell -ArgumentList '-NoProfile', '-Command', 'npx playwright show-report --host 127.0.0.1 --port 9323'
  Start-Sleep -Seconds 2
  Start-Process 'http://127.0.0.1:9323'
  Write-Host 'Reporte visual abierto en http://127.0.0.1:9323' -ForegroundColor Green
}

function Open-LocalReport {
  $reportPath = 'artifacts/report.html'
  if (-not (Test-Path $reportPath)) {
    Write-Host 'No hay reporte HTML generado todavia.' -ForegroundColor Yellow
    return
  }

  $absolutePath = (Resolve-Path $reportPath).Path
  $fileUrl = "file:///$($absolutePath -replace '\\', '/')"
  Write-Host "Abriendo reporte visual: $reportPath" -ForegroundColor Green
  Start-Process $fileUrl
}

function Run-QuickScan([string]$TargetUrl, [bool]$ShouldPromptForReport) {
  $env:TARGET_URL = $TargetUrl
  Write-Host "Escaneando: $TargetUrl" -ForegroundColor Cyan
  npm run test:trace

  Print-TelemetrySummary

  if ($OpenReportAfterScan) {
    Open-LocalReport
    return
  }

  if ($ShouldPromptForReport) {
    Write-Host ''
    $openNow = Read-Host 'Abrir reporte visual ahora? (s/n)'
    if ($openNow -match '^[sS]') {
      Open-LocalReport
    }
  }
}

function Run-UIMode([string]$TargetUrl) {
  $env:TARGET_URL = $TargetUrl
  Write-Host "Modo UI para: $TargetUrl" -ForegroundColor Cyan
  npm run test:ui
}

Show-Banner

if ($Mode -eq 'quick') {
  $env:TARGET_URL = $Url
  Write-Host "Escaneando: $Url" -ForegroundColor Cyan
  npm run test:trace
  Print-TelemetrySummary
  Write-Host ''
  Write-Host 'Abriendo reporte visual...' -ForegroundColor Cyan
  Open-LocalReport
  exit 0
}

if ($Mode -eq 'ui') {
  Run-UIMode -TargetUrl $Url
  exit 0
}

if ($Mode -eq 'report') {
  Open-LocalReport
  exit 0
}

$selectedUrl = Read-Host "URL objetivo (Enter para default: $Url)"
if ([string]::IsNullOrWhiteSpace($selectedUrl)) {
  $selectedUrl = $Url
}

Write-Host ''
Write-Host 'Elige una opcion:' -ForegroundColor Cyan
Write-Host '1) Escaneo rapido + resumen + opcion de reporte (recomendado)'
Write-Host '2) Modo UI interactivo (tipo runner)'
Write-Host '3) Abrir ultimo reporte visual'
$choice = Read-Host 'Opcion'

switch ($choice) {
  '2' { Run-UIMode -TargetUrl $selectedUrl }
  '3' { Open-LocalReport }
  default { Run-QuickScan -TargetUrl $selectedUrl -ShouldPromptForReport $true }
}

exit 0
