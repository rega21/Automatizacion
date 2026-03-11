# Bug Hunter - Guía de inicio rápido

Herramienta automatizada para encontrar y corroborar bugs en aplicaciones web.

## ⚡ Inicio en 3 pasos

### 1. Instalar dependencias
```powershell
npm install
```

### 2. Ejecutar escaneo
```powershell
npm run hunter:quick
```

### 3. Ver reporte
Se abre automáticamente en tu navegador.

## 📋 Comandos principales

| Comando | Función |
|---------|---------|
| `npm run hunter:quick` | Escanea + abre reporte (recomendado) |
| `npm run academy` | Escaneo directo para AcademyBugs |
| `npm run academy:ui` | AcademyBugs en modo UI |
| `npm run hunter` | Menú guiado con opciones |
| `npm run hunter:ui` | Modo Playwright interactivo |
| `npm run serve:report` | Abre servidor local para reportes |

## 🔧 Configuración rápida

**Cambiar URL objetivo:**
```powershell
$env:TARGET_URL='https://mi-app.com'
npm run hunter:quick
```

**Cambiar perfil de selectores (sin editar el test):**
```powershell
$env:TARGET_PROFILE='academybugs'
$env:TARGET_URL='https://academybugs.com/'
npm run hunter:quick
```

**Perfil base para un sitio nuevo (starter):**
1. Edita `tests/site-profiles.ts` en el perfil `starter` y cambia URL + nombres de selectores.
2. Ejecuta:
```powershell
$env:TARGET_PROFILE='starter'
npm run hunter:quick
```

**Sin tocar TypeScript: usar archivo JSON por sitio**
1. Copia `profiles/new-site.example.json` a un archivo nuevo, por ejemplo `profiles/mi-sitio.json`.
2. Ajusta URL y selectores en ese JSON.
3. Ejecuta:
```powershell
$env:TARGET_PROFILE_FILE='profiles/mi-sitio.json'
npm run hunter:quick
```

Opcional (desde script PowerShell):
```powershell
npm run hunter -- -Mode quick -ProfileFile profiles/mi-sitio.json
```

**AcademyBugs en un solo comando**
```powershell
npm run academy
```

**Cambiar velocidad del test:**
```powershell
$env:ACTION_DELAY_MS='2000'
npm run hunter:quick
```

## 📊 Qué obtienes

- ✅ 10 pasos del recorrido capturados
- ✅ Screenshots de cada acción
- ✅ Errores de consola detectados
- ✅ Requests fallidas identificadas
- ✅ Reporte visual interactivo

## 📚 Documentación completa

- [DOCUMENTACION.md](DOCUMENTACION.md) - Guía exhaustiva
- [SETUP.md](SETUP.md) - Configuración de repositorio Git

## 🤖 Agente Copilot

Usa el agente personalizado "Bug Hunter" en Copilot para análisis avanzados:

```
Analiza bugs en mi app: https://mi-app.com
```

---

Para más detalles, consulta la documentación completa.
