# Visual Bug Corroboration

This setup gives you a visual runner similar to Cypress style debugging.

## Quick Start

```powershell
npm run hunter:quick
```

Esto ejecuta el escaneo automáticamente, captura pasos con screenshots, y abre un reporte visual HTML en tu navegador.

## User-friendly mode

```powershell
npm run hunter
```

This opens a guided flow:
- asks for the target URL
- lets you choose quick scan, UI mode, or open the last report

Quick shortcuts:

```powershell
npm run hunter:quick        # Fast scan + auto-open HTML report
npm run hunter:ui           # Interactive runner mode
npm run hunter:report       # Open last HTML report
```

## What you see

The HTML report shows:
- **Step-by-step screenshots** of your user walkthrough
- **Telemetry summary**: URLs visited, console errors, failed requests
- **Click to zoom** any screenshot to inspect details
- **Organized layout** similar to Cypress Test Runner

### Accessing the report

The report opens automatically after `npm run hunter:quick`, but if you need to re-open it:

```powershell
npm run serve:report
```

This starts a local server at `http://localhost:8765/report.html` and opens it in your browser.

## 1) Install dependencies

```powershell
npm install
npx playwright install chromium
```

## 2) Run in interactive UI mode (Playwright Test UI)

```powershell
$env:TARGET_URL='https://fobalfoca5.vercel.app/'
npm run test:ui
```

## 3) Run and generate report/trace

```powershell
$env:TARGET_URL='https://fobalfoca5.vercel.app/'
npm run test:trace
npm run show:report
```

## Configuration

Adjust the pause between actions:

```powershell
$env:ACTION_DELAY_MS='2000'  # Slower walkthrough
npm run hunter:quick
```

## Files Generated

- `artifacts/report.html` - Main visual report (opens in browser)
- `artifacts/telemetry.json` - Raw test data
- `artifacts/steps/` - Screenshots for each step
- `test-results/` - Playwright test artifacts (trace, video, etc.)

