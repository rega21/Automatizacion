# Bug Hunter - Documentación Completa

## 📋 Descripción General

**Bug Hunter** es un sistema automatizado para encontrar y corroborar bugs en aplicaciones web. Combina:

- Un **agente personalizado de Copilot** para análisis de bugs
- **Tests automáticos con Playwright** que recorren la UI y capturan pasos
- Un **reporte visual interactivo** estilo Cypress
- **Scrips amigables** que simplifican toda la complejidad técnica

## 🚀 Instalación (Una sola vez)

```powershell
npm install
npx playwright install chromium
```

## 📌 Uso Rápido

### Opción 1: Escaneo automático + reporte visual (RECOMENDADO)

```powershell
npm run hunter:quick
```

Esto:
1. Escanea la URL por defecto (`https://fobalfoca5.vercel.app/`)
2. Captura 10 pasos del recorrido con screenshots
3. Detecta errores de consola y requests fallidas
4. Abre automáticamente el reporte visual en tu navegador

### Opción 2: Menú guiado interactivo

```powershell
npm run hunter
```

Te pregunta:
- La URL a escanear
- Si quieres escaneo rápido, modo UI interactivo, o solo ver el último reporte

### Opción 3: Modo desarrollo (Playwright UI)

```powershell
$env:TARGET_URL='https://tu-url.com'
npm run test:ui
```

Abre el Playwright Test Runner con controles paso a paso.

### Opción 4: Abrir servidor local

Si necesitas ver el reporte de nuevo sin ejecutar un escaneo:

```powershell
npm run serve:report
```

Abre `http://localhost:8765/report.html` automáticamente.

## 📊 Qué se reporta

El reporte visual muestra:

| Métrica | Descripción |
|---------|-------------|
| **Pasos Capturados** | Número total de interacciones registradas |
| **Errores de Consola** | Warnings y errors detectados en la consola del navegador |
| **Requests Fallidas** | Llamadas HTTP que no completaron exitosamente |

### Dentro del recorrido:

Cada paso captura:
- **Screenshot completo** de cómo se veía la página
- **Nombre de la acción** (ej: "Open Partido tab", "Close menu with Escape")
- **URL donde ocurrió** (ruta relativa)
- **Click para ampliar** cualquier imagen

### Secciones adicionales:

- **Errores de Consola**: Lista de todos los `console.error()` y `console.warn()` capturados
- **Requests Fallidas**: URLs que no pudieron cargarse con motivo específico

## ⚙️ Configuración Avanzada

### Cambiar velocidad del recorrido

La pausa predeterminada es `1500ms` entre acciones. Para cambiarla:

```powershell
$env:ACTION_DELAY_MS='3000'
npm run hunter:quick
```

Valores sugeridos:
- `800` - muy rápido (difícil de seguir)
- `1500` - normal (actual)
- `2500` - lento (muy cómodo para ver)
- `4000` - muy lento

### Cambiar URL objetivo

```powershell
$env:TARGET_URL='https://mi-app.com'
npm run hunter:quick
```

### Habilitar acciones mutables (VOTAR)

Por defecto el test **no ejecuta** `VOTAR` para no modificar datos en producción. Para habilitarlo:

```powershell
$env:ALLOW_MUTATIONS='true'
npm run hunter:quick
```

## 📁 Estructura de archivos generados

```
artifacts/
├── report.html              # 📊 Reporte visual (abre en navegador)
├── telemetry.json           # 📋 Datos brutos en JSON
└── steps/
    ├── 01-open-home-page.png
    ├── 02-open-partido-tab.png
    ├── 03-open-historial-tab.png
    ├── 04-return-to-jugadores-tab.png
    ├── 05-open-menu.png
    ├── 06-close-menu-with-escape.png
    ├── 07-open-search.png
    ├── 08-close-search-with-escape.png
    ├── 09-open-add-flow.png
    └── 10-close-add-flow-with-escape.png

test-results/
├── site-walk-visual-walkthrough-and-telemetry-capture/
│   ├── trace.zip            # 🎬 Traza completa para Playwright
│   ├── video.webm           # 🎥 Video de la ejecución
│   └── test-failed-1.png    # 📷 Screenshot del resultado

playwright-report/
└── index.html               # 📈 Reporte HTML de Playwright
```

## 🔍 Qué prueba el test

El test `tests/site-walk.spec.ts` ejecuta este recorrido **real**:

1. **Abre home** y verifica que exista la navegación inferior
2. **Navega tabs**: Partido → Historial → Jugadores
3. **Interactúa controles**: Menú, Búsqueda, Agregar
4. **Cierra controles**: Escape en cada uno
5. **Captura todo**: Screenshots, errores, requests fallidas

**No ejecuta**: VOTAR ni otras mutaciones (por seguridad en producción)

## 🐛 Interpretación de resultados

### Si ves errores de consola

```
[error] Failed to load resource: the server responded with a status of 404 ()
```

Significa que la página intentó cargar un recurso que no existe. Ejemplos:
- CSS/JS que falta
- API endpoint que devolvió 404
- Imagen rota

**Acción**: Revisar si es intencional o un bug real.

### Si ves requests fallidas

```
GET https://fobalfoca5.vercel.app/config.js :: net::ERR_ABORTED
```

Significa que la solicitud fue abortada (cancelada). Posibles causas:
- El navegador canceló a propósito
- Timeout de conexión
- El servidor rechazó

**Acción**: Revisar logs del servidor o red.

## 🛠️ Archivos modificados/creados

| Archivo | Propósito |
|---------|-----------|
| `.github/agents/bug-hunter.agent.md` | Agente personalizado de Copilot |
| `tests/site-walk.spec.ts` | Test que recorre la UI con Playwright |
| `playwright.config.ts` | Configuración de Playwright (trazas, ui, etc) |
| `tsconfig.json` | TypeScript config para el proyecto |
| `package.json` | Scripts npm y dependencias |
| `artifacts/report.html` | Reporte visual generado |
| `scripts/bug-hunter.ps1` | Script PowerShell que orquesta todo |
| `scripts/serve-report.ps1` | Script para servir el reporte locally |
| `scripts/open-report.ps1` | Script helper para abrir reportes |

## 📚 Notas técnicas

- **Lenguaje del test**: TypeScript
- **Framework**: Playwright Test (`@playwright/test`)
- **Configuración**: `playwright.config.ts` + `tsconfig.json`
- **Servidor local**: `npx http-server` (sin dependencias adicionales)
- **Orquestación**: PowerShell scripts en Windows
- **Generación de reportes**: HTML estático + JavaScript vanilla (sin frameworks)

## 🎯 Próximos pasos sugeridos

Si quieres expandir el sistema:

1. **Agregar más pasos de prueba**: Edita `tests/site-walk.spec.ts` para probar más flujos
2. **Filtrar errores conocidos**: Ignora `config.js` si no es crítico
3. **Integración CI/CD**: Corre los tests en cada deploy
4. **Alertas**: Envía resultados por email si hay bugs críticos
5. **Comparación de reportes**: Guarda reportes históricos para ver regresiones

## 🆘 Troubleshooting

### El reporte no carga en el navegador

```powershell
npm run serve:report
# Abre http://localhost:8765/report.html manualmente
```

### Playwright no encuentra un elemento

Edita [tests/site-walk.spec.ts](tests/site-walk.spec.ts) y ajusta los selectores:

```ts
await clickAndRecord('Open menu', page.getByRole('button', { name: 'Abrir menú' }));
// Cambiar 'Abrir menú' si el texto es diferente
```

### El test corre demasiado rápido/lento

```powershell
$env:ACTION_DELAY_MS='2000'
npm run hunter:quick
```

### Error: "Python not found"

El servidor local usa `npx http-server`, no depende de Python. Si no funciona:

```powershell
npx --yes http-server ./artifacts --port 8765 --open
```

## 📞 Contacto / Soporte

Este sistema fue creado como solución personalizada para detección de bugs en `https://fobalfoca5.vercel.app/`.

Para cambios, contacta al equipo de automatización.

---

**Última actualización**: 11 de Marzo de 2026
