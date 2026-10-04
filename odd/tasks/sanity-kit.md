# Feature: sanity-kit — Dashboard de sanidad determinista multi-proyecto

## Objetivo

Paquete CLI compartido (`sanity-kit`) que ejecuta chequeos deterministas de
calidad (types, lint, dead code, audit, secrets, coverage) por proyecto,
genera un dashboard `SANITY.md` por repo y un hub agregador multi-proyecto.
Sin SaaS, sin Docker para análisis; capa 3 consume artefactos, nunca código.

## Decisiones

- Ubicación: `/Volumes/Data Coding/Desarrollo/AI-workspace/sanity-kit` (repo propio).
- Checks: tsc --noEmit, eslint, knip, npm audit, secrets (gitleaks o fallback regex), vitest coverage.
- Config por proyecto: `sanity.config.ts` declara qué se mide y umbrales.
- Score determinista: pesos fijos, sin timestamps en el cálculo.
- Piloto: travelhub-app. Replicable a otros proyectos del workspace.
- Dependency-cruiser/madge circular: opcional, se activa solo si está configurado.

## Tareas

- [x] Scaffold sanity-kit (package, CLI, config loader)
- [x] Checks: types, lint, knip, audit, secrets, coverage
- [x] Scoring determinista + dashboard + hub
- [x] Tests unitarios de funciones puras (score, render, secrets-scan) — 28 tests
- [x] Integración travelhub-app: config, devDeps, scripts
- [x] Calibración contra código real + SANITY.md (baseline 45/100)
- [x] GitHub Actions workflow (guarded) + README
- [x] Commits por unidad de trabajo

## Evidencia

- sanity-kit (repo propio): aac8493 feat, c5f1b92 chore
- travelhub-app (feature/sanity-dashboard): a5e54ae integración, e7cef33 baseline report, 3ba1523 ci workflow, d3ace26 fix CI (corrección de review)
- Revisión nativa: lineage review-4955823c93df1ff5 — approved, acknowledged, authority burned
- Pendiente (informativo, trabajo futuro): publicar sanity-kit y fijar vars SANITY_KIT_REPO/SANITY_KIT_SHA para activar CI; hallazgos WARNING/SUGGESTION de la revisión (scripts npm con dependencia de ruta relativa, ratchet sin headroom)
