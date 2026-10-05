# Feature: E2E Local estable en CI (issue #406)

Issue: https://github.com/eliumontoya/travelhub-app/issues/406
Change OpenSpec: `openspec/changes/e2e-local-estable-ci/`
Branch: `eliumontoya/ci-e2e-job-e2e-local-inestable-en-main-specs-no`

## Objetivo

El job `e2e-local` de CI debe quedar verde de forma estable en corridas repetidas de `main`:
specs idempotentes, reintentos sin estado sucio heredado, y warmup del webServer en CI.

## Tareas

| # | Tarea | Estado | Evidencia |
|---|-------|--------|-----------|
| 1 | Exploración: diagnóstico de specs no idempotentes + webserver CI | done | Reporte explore (3 specs auditados, playwright.config.ts, ci.yml, architecture.md:364-368) |
| 2 | Propose/Spec/Design/Tasks (OpenSpec) | done | `openspec/changes/e2e-local-estable-ci/` (19f2f8b) |
| 3 | Apply fases 1–5: helpers REST + specs idempotentes | done | dd080ca, b34b2ca, a36ae03, 293adbf, 86210c6 — RED→GREEN por spec, doble corrida sin reset |
| 4 | Apply fases 6–7: globalSetup warmup + docs | done | 03fa617, 19f2f8b — suite completa 35 passed / 1 skipped |
| 5 | Verify fases 8: doble corrida completa sin reset + typecheck + lint | done | 8.1–8.4 PASS; 8.5 variante contaminación 7 passed; residuos 0. Ver archive-report.md |
| 6 | Archive + PR | done | archive 2026-10-05-e2e-local-estable-ci (0a0508e); PR #407 (revisión nativa approved, lineage review-99a0d5c0a96eb1e9) |

## Decisiones (design.md)

- D1: limpieza antes de actuar en `beforeEach` (cubre reintentos) + teardown en `afterAll`.
- D2: nombres únicos por corrida (`uniqueSuffix`/`uniqueName`).
- D3: localizadores acotados por título propio, sin `.nth()`/`.last()`.
- D4: restauración de checklist de service-documents vía REST service-role.
- D5: higiene de create-trip (borrado de viaje + cliente creados).
- D6: `globalSetup` de warmup de rutas (best-effort, se omite con `BASE_URL`).
- D7: `retries: 2` en CI se mantiene; es seguro con D1–D4.

## Notas

- `[WebServer] ⨯ destination stream closed early` es ruido benigno de streaming abortado;
  evidencia CI run 37255713862 (32 passed alrededor del error).
- Criterio central de verificación: suite completa dos veces seguidas sin `db:reset`.
