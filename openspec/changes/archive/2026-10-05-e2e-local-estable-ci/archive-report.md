# Archive Report — e2e-local-estable-ci

**Archive date**: 2026-10-05
**Archived to**: `openspec/changes/archive/2026-10-05-e2e-local-estable-ci/`
**Issue**: [#406 — job E2E Local inestable en main](https://github.com/eliumontoya/travelhub-app/issues/406)

## Source of Truth — Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| e2e-local-stability | Created (full spec) | New main spec; 5 requirements copied byte-for-byte (`diff -q` → SYNC_OK) |

Delta composition: not needed — single new capability, no MODIFIED/REMOVED deltas.

## Verification Evidence (Fase 8)

- 8.1 `npx tsc --noEmit` — PASS (0 errores).
- 8.2 `npm run lint` — PASS (0 errores; 16 warnings preexistentes, ninguno en hunks del cambio).
- 8.3 `npm run test:e2e -- --project=local` (corrida 1, sin `db:reset`) — PASS: 35 passed / 1 skipped.
- 8.4 corrida 2 inmediata, sin `db:reset` — PASS: 35 passed / 1 skipped. Criterio central del issue.
- 8.5 (variante por contaminación): base contaminada con residuos de los 3 specs (proveedor `Same Session Tour Operator`, item `E2E actividad residual` en el día del seed, `Copia de pasaporte`, seguro `reviewed`) + `npx playwright test --project=local supplier-item-compatibility traveler-activities service-documents --retries=1` → 7 passed; residuos eliminados y seguro restaurado a `uploaded`. Equivalente más fuerte al reintento inducido planificado.
- Residuos post-corrida vía REST service-role: 0 en suppliers/items/service_checklist_items/clients/trips.

## Commits (rama `eliumontoya/ci-e2e-job-e2e-local-inestable-en-main-specs-no`)

- dd080ca helpers REST + nombres únicos por corrida
- b34b2ca supplier-item-compatibility idempotente
- a36ae03 traveler-activities idempotente + localizadores acotados
- 293adbf service-documents restauración de checklist
- 86210c6 create-trip limpieza de viaje + cliente
- 03fa617 globalSetup de warmup de rutas
- 19f2f8b change OpenSpec + architecture.md actualizado

## Notes

- Corrección aplicada durante apply: la tabla real es `items` (no `trip_items`); documentado en tasks.md 3.2.
- `[WebServer] ⨯ destination stream closed early` documentado como ruido benigno (CI run 37255713862: 32 tests pasaron alrededor del error); el warmup reduce el riesgo de timeouts por compilación on-demand en CI.
- Pendiente: confirmar job `e2e-local` verde en CI sobre `main` tras el merge (8.6, tarea de CI, no ejecutable localmente).
