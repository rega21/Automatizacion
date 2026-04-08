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

### Opción 4: Servidor web interactivo (NUEVO)

Inicia un servidor local con interfaz para escanear cualquier URL sin tocar la terminal:

```powershell
npm run serve
```

Abre `http://localhost:3000` automáticamente. Desde ahí podés:
- Ver el último reporte generado
- Escribir cualquier URL en la barra inferior y lanzar un nuevo escaneo
- Ver el output del test en tiempo real mientras corre
- El reporte se recarga solo al terminar

### Opción 5: Abrir servidor de reporte estático

Si solo querés ver el último reporte sin lanzar nuevos escaneos:

```powershell
npm run serve:report
```

## 📊 Qué se reporta

El reporte visual (`artifacts/report.html`) se genera automáticamente al final de cada test y muestra:

| Sección | Contenido |
|---------|-----------|
| **Summary** | Cards con conteos: páginas visitadas, pasos, errores, warnings, requests fallidas, media errors |
| **Pages Visited** | Lista clickeable de todas las URLs recorridas |
| **Console Issues** | Errores (rojo) y warnings (amarillo) capturados de la consola del navegador |
| **Failed Requests** | Requests fallidas categorizadas en tres grupos |
| **Step-by-step Walkthrough** | Cada paso con screenshot a pantalla completa (click para ampliar) |

### Categorización de requests fallidas

El reporte distingue automáticamente:

| Categoría | Color | Descripción |
|-----------|-------|-------------|
| **Real failures** | Rojo | Recursos propios del sitio que fallaron — bugs reales |
| **Media / video** | Amarillo | Archivos mp4, webm, etc. — fallos de contenido multimedia |
| **Analytics / tracking** | Gris tenue | Google Analytics, GTM, Hotjar, etc. — esperado en entorno de test |

### Badge de severidad

El reporte muestra un badge **PASS / WARN / FAIL** en el encabezado:
- `FAIL` — hay errores de consola o requests reales fallidas
- `WARN` — solo warnings o errores de media
- `PASS` — sin issues detectados

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

## 🛠️ Archivos del proyecto

| Archivo | Propósito |
|---------|-----------|
| `tests/site-walk.spec.ts` | Test principal: recorre la UI, captura screenshots y genera el reporte HTML |
| `tests/cart-checkout.spec.ts` | Test de flujo carrito → checkout en AcademyBugs |
| `tests/site-profiles.ts` | Tipos y lógica para cargar perfiles de sitio |
| `profiles/academybugs.json` | Perfil para academybugs.com (qué navegar y verificar) |
| `profiles/new-site.example.json` | Template para crear un perfil de sitio nuevo |
| `playwright.config.ts` | Configuración de Playwright (trazas, modo headless, etc.) |
| `tsconfig.json` | TypeScript config para el proyecto |
| `package.json` | Scripts npm y dependencias |
| `scripts/bug-hunter.ps1` | Script PowerShell que orquesta los modos (quick, ui, report) |
| `scripts/server.js` | Servidor web interactivo — sirve el reporte y lanza escaneos desde el browser |
| `scripts/serve-report.ps1` | Script para servir el reporte estático localmente |
| `artifacts/report.html` | Reporte visual generado (se sobreescribe en cada escaneo) |
| `artifacts/telemetry.json` | Datos brutos del último escaneo en JSON |
| `artifacts/steps/` | Screenshots de cada paso del recorrido |

## 📚 Notas técnicas

- **Lenguaje del test**: TypeScript
- **Framework**: Playwright Test (`@playwright/test`)
- **Configuración**: `playwright.config.ts` + `tsconfig.json`
- **Servidor web interactivo**: Node.js puro (`scripts/server.js`) — sin dependencias adicionales
- **Orquestación CLI**: PowerShell scripts en Windows
- **Generación de reportes**: HTML estático generado desde el test — JavaScript vanilla, sin frameworks
- **Detección de perfil automática**: al escanear vía servidor, detecta `academybugs.com` y usa el perfil correspondiente; para cualquier otra URL usa el perfil `generic` (abre la página sin navegación específica)

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
npm run serve
# Abre http://localhost:3000 — sirve el reporte y permite lanzar nuevos escaneos
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

### El servidor interactivo no responde

Verificar que el puerto 3000 esté libre:

```powershell
npm run serve
# Si el puerto está ocupado, matar el proceso que lo usa y reiniciar
```

---

**Última actualización**: 8 de Abril de 2026
