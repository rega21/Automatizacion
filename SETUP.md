# Getting Started with Bug Hunter Repository

## Initial Setup

### 1. Inicializar Git local (si aún no lo has hecho)

```powershell
git init
git add .
git commit -m "Initial commit: Bug Hunter automation setup"
```

### 2. Conectar con repositorio remoto

#### Opción A: GitHub via HTTPS

```powershell
git remote add origin https://github.com/tu-usuario/bug-hunter.git
git branch -M main
git push -u origin main
```

#### Opción B: GitHub via SSH

```powershell
git remote add origin git@github.com:tu-usuario/bug-hunter.git
git branch -M main
git push -u origin main
```

#### Opción C: GitLab

```powershell
git remote add origin https://gitlab.com/tu-usuario/bug-hunter.git
git branch -M main
git push -u origin main
```

### 3. Después de configurar el remoto

```powershell
git status
git log --oneline
```

## Estructura del repo

```
bug-hunter/
├── .github/
│   └── agents/
│       └── bug-hunter.agent.md          # Agente Copilot personalizado
├── scripts/
│   ├── bug-hunter.ps1                   # Orquestador principal
│   ├── serve-report.ps1                 # Servidor local
│   └── open-report.ps1                  # Abrir reporte
├── tests/
│   └── site-walk.spec.ts                # Test Playwright
├── artifacts/                           # Generado (en .gitignore)
│   ├── report.html
│   ├── telemetry.json
│   └── steps/
├── playwright.config.ts                 # Config Playwright
├── tsconfig.json                        # Config TypeScript
├── package.json                         # Dependencies
├── .gitignore                           # Archivos a ignorar
├── README.md                            # Guía rápida
├── DOCUMENTACION.md                     # Guía completa
└── SETUP.md                             # Este archivo

.github/workflows/                       # (Opcional) CI/CD pipelines
```

## Commits importantes

Después de `git init`, considera estos commits en orden:

```powershell
# 1. Core setup
git add package.json tsconfig.json playwright.config.ts
git commit -m "chore: initial dependencies and config"

# 2. Tests
git add tests/
git commit -m "test: add Playwright user walkthrough test"

# 3. Scripts
git add scripts/
git commit -m "chore: add bug-hunter automation scripts"

# 4. Agent
git add .github/
git commit -m "chore: add Copilot Bug Hunter agent"

# 5. Docs
git add README.md DOCUMENTACION.md .gitignore
git commit -m "docs: add comprehensive documentation"
```

## Notas importantes

- **`.gitignore` ya está configurado** para excluir `artifacts/`, `node_modules/`, `test-results/`, etc.
- **No sincronizes artefactos**: Los screenshots y reportes se generan en tiempo de ejecución
- **`.env` no está trackeado**: Si necesitas variables de entorno, crea `.env.example`

## Push inicial

```powershell
git push -u origin main
```

## Invitar colaboradores (GitHub)

1. Ve a Settings > Collaborators
2. Agrega usuarios con permisos
3. Ellos pueden clonar:

```powershell
git clone https://github.com/tu-usuario/bug-hunter.git
cd bug-hunter
npm install
npm run hunter:quick
```

## Ramas sugeridas

Para trabajo en equipo:

```powershell
git checkout -b feature/agregar-mas-pasos
# Hacer cambios...
git add .
git commit -m "feat: add more test steps"
git push -u origin feature/agregar-mas-pasos
# Luego hacer Pull Request en GitHub
```

---

**Requieres ayuda?** Contacta al equipo de automatización.
