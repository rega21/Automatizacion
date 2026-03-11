param(
  [string]$Url = '',
  [string]$Profile = '',
  [string]$ProfileFile = '',
  [ValidateSet('menu', 'quick', 'ui', 'report')]
  [string]$Mode = 'menu',
  [switch]$OpenReportAfterScan
)

function Resolve-TargetUrl([string]$TargetUrl) {
  if (-not [string]::IsNullOrWhiteSpace($TargetUrl)) {
    return $TargetUrl
  }

  if (-not [string]::IsNullOrWhiteSpace($env:TARGET_URL)) {
    return $env:TARGET_URL
  }

  return ''
}

function Resolve-TargetProfile([string]$TargetProfile) {
  if (-not [string]::IsNullOrWhiteSpace($TargetProfile)) {
    return $TargetProfile
  }

  if (-not [string]::IsNullOrWhiteSpace($env:TARGET_PROFILE)) {
    return $env:TARGET_PROFILE
  }

  return 'fobalfoca'
}

function Resolve-TargetProfileFile([string]$TargetProfileFile) {
  if (-not [string]::IsNullOrWhiteSpace($TargetProfileFile)) {
    return $TargetProfileFile
  }

  if (-not [string]::IsNullOrWhiteSpace($env:TARGET_PROFILE_FILE)) {
    return $env:TARGET_PROFILE_FILE
  }

  return ''
}

function Set-TargetUrlEnv([string]$TargetUrl) {
  if ([string]::IsNullOrWhiteSpace($TargetUrl)) {
    Remove-Item Env:TARGET_URL -ErrorAction SilentlyContinue
    return
  }

  $env:TARGET_URL = $TargetUrl
}

function Set-ProfileFileEnv([string]$TargetProfileFile) {
  if ([string]::IsNullOrWhiteSpace($TargetProfileFile)) {
    Remove-Item Env:TARGET_PROFILE_FILE -ErrorAction SilentlyContinue
    return
  }

  $env:TARGET_PROFILE_FILE = $TargetProfileFile
}

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

function Run-QuickScan([string]$TargetUrl, [string]$TargetProfile, [string]$TargetProfileFile, [bool]$ShouldPromptForReport) {
  $effectiveUrl = Resolve-TargetUrl -TargetUrl $TargetUrl
  $effectiveProfile = Resolve-TargetProfile -TargetProfile $TargetProfile
  $effectiveProfileFile = Resolve-TargetProfileFile -TargetProfileFile $TargetProfileFile

  # If a profile file is provided and URL was not explicitly passed, prefer profile defaultUrl.
  if ((-not [string]::IsNullOrWhiteSpace($effectiveProfileFile)) -and [string]::IsNullOrWhiteSpace($TargetUrl)) {
    $effectiveUrl = ''
  }

  Set-TargetUrlEnv -TargetUrl $effectiveUrl
  $env:TARGET_PROFILE = $effectiveProfile
  Set-ProfileFileEnv -TargetProfileFile $effectiveProfileFile

  $urlLabel = if ([string]::IsNullOrWhiteSpace($effectiveUrl)) { 'auto (desde perfil)' } else { $effectiveUrl }
  Write-Host "Escaneando: $urlLabel (perfil: $effectiveProfile)" -ForegroundColor Cyan

  # Avoid showing stale data from previous runs when current run fails early.
  Remove-Item 'artifacts/telemetry.json' -ErrorAction SilentlyContinue
  Remove-Item 'artifacts/report.html' -ErrorAction SilentlyContinue

  npm run test:trace
  $testExitCode = $LASTEXITCODE

  Print-TelemetrySummary

  if ($testExitCode -ne 0) {
    Write-Host ''
    Write-Host 'El escaneo fallo. Se omitira abrir reporte HTML para evitar datos antiguos.' -ForegroundColor Yellow
    return $false
  }

  if ($OpenReportAfterScan) {
    Open-LocalReport
    return $true
  }

  if ($ShouldPromptForReport) {
    Write-Host ''
    $openNow = Read-Host 'Abrir reporte visual ahora? (s/n)'
    if ($openNow -match '^[sS]') {
      Open-LocalReport
    }
  }

  return $true
}

function Run-UIMode([string]$TargetUrl, [string]$TargetProfile, [string]$TargetProfileFile) {
  $effectiveUrl = Resolve-TargetUrl -TargetUrl $TargetUrl
  $effectiveProfile = Resolve-TargetProfile -TargetProfile $TargetProfile
  $effectiveProfileFile = Resolve-TargetProfileFile -TargetProfileFile $TargetProfileFile

  # If a profile file is provided and URL was not explicitly passed, prefer profile defaultUrl.
  if ((-not [string]::IsNullOrWhiteSpace($effectiveProfileFile)) -and [string]::IsNullOrWhiteSpace($TargetUrl)) {
    $effectiveUrl = ''
  }

  Set-TargetUrlEnv -TargetUrl $effectiveUrl
  $env:TARGET_PROFILE = $effectiveProfile
  Set-ProfileFileEnv -TargetProfileFile $effectiveProfileFile

  $urlLabel = if ([string]::IsNullOrWhiteSpace($effectiveUrl)) { 'auto (desde perfil)' } else { $effectiveUrl }
  Write-Host "Modo UI para: $urlLabel (perfil: $effectiveProfile)" -ForegroundColor Cyan
  npm run test:ui
}

Show-Banner

if ($Mode -eq 'quick') {
  $scanOk = Run-QuickScan -TargetUrl $Url -TargetProfile $Profile -TargetProfileFile $ProfileFile -ShouldPromptForReport $false
  if (-not $scanOk) {
    exit 1
  }

  Write-Host ''
  Write-Host 'Abriendo reporte visual...' -ForegroundColor Cyan
  Open-LocalReport
  exit 0
}

if ($Mode -eq 'ui') {
  Run-UIMode -TargetUrl $Url -TargetProfile $Profile -TargetProfileFile $ProfileFile
  exit 0
}

if ($Mode -eq 'report') {
  Open-LocalReport
  exit 0
}

$defaultUrl = Resolve-TargetUrl -TargetUrl $Url
$defaultUrlLabel = if ([string]::IsNullOrWhiteSpace($defaultUrl)) { 'auto (desde perfil)' } else { $defaultUrl }
$selectedUrl = Read-Host "URL objetivo (Enter para default: $defaultUrlLabel)"
if ([string]::IsNullOrWhiteSpace($selectedUrl)) {
  $selectedUrl = $defaultUrl
}

$defaultProfile = Resolve-TargetProfile -TargetProfile $Profile
$selectedProfile = Read-Host "Perfil de selectores (Enter para default: $defaultProfile)"
if ([string]::IsNullOrWhiteSpace($selectedProfile)) {
  $selectedProfile = $defaultProfile
}

$defaultProfileFile = Resolve-TargetProfileFile -TargetProfileFile $ProfileFile
$defaultProfileFileLabel = if ([string]::IsNullOrWhiteSpace($defaultProfileFile)) { 'ninguno' } else { $defaultProfileFile }
$selectedProfileFile = Read-Host "Archivo de perfil JSON (Enter para default: $defaultProfileFileLabel)"
if ([string]::IsNullOrWhiteSpace($selectedProfileFile)) {
  $selectedProfileFile = $defaultProfileFile
}

Write-Host ''
Write-Host 'Elige una opcion:' -ForegroundColor Cyan
Write-Host '1) Escaneo rapido + resumen + opcion de reporte (recomendado)'
Write-Host '2) Modo UI interactivo (tipo runner)'
Write-Host '3) Abrir ultimo reporte visual'
$choice = Read-Host 'Opcion'

switch ($choice) {
  '2' { Run-UIMode -TargetUrl $selectedUrl -TargetProfile $selectedProfile -TargetProfileFile $selectedProfileFile }
  '3' { Open-LocalReport }
  default {
    Run-QuickScan -TargetUrl $selectedUrl -TargetProfile $selectedProfile -TargetProfileFile $selectedProfileFile -ShouldPromptForReport $true
  }
}

exit 0
