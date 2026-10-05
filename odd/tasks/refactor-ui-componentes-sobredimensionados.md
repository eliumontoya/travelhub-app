# Feature: refactor-ui — reducir los componentes sobredimensionados del editor de viaje y dashboard

**Issue**: https://github.com/eliumontoya/travelhub-app/issues/373
**Rama**: `eliumontoya/refactor-ui-reducir-los-componentes-sobredimensi` (worktree aislado)
**Estado**: en curso
**Dependencia**: #371 (cerrada — desbloqueado)

## Alcance

4 PRs secuenciales, uno por archivo, refactor puro (sin cambios de comportamiento ni diseño):

1. `src/components/ItemFormDialog.tsx` (592) → subcomponente de formulario por tipo de item (`FlightFields`, `HotelFields`, `ActivityFields`…) con composición/esquema compartido.
2. `src/app/dashboard/trips/[id]/page.tsx` (870) → separar en secciones (header/publicación, días, presupuesto) y bajar estado a managers hijos; el page queda como compositor.
3. `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` (596) → separar lógica de estado (lista, aprobación, corrección) de la presentación.
4. `src/app/dashboard/DashboardFilters.tsx` (480) → extraer bloques de filtro como piezas reutilizables.

## Restricciones (del issue)

- Refactor puro: sin cambios de comportamiento ni de diseño en el mismo PR que la extracción.
- Server Components por defecto; `"use client"` solo donde hay interactividad real.
- Ninguno de los 4 archivos supera ~300 líneas al final.
- Por PR: `npx tsc --noEmit`, `npm run build`, `npm run test`, `npm run test:e2e` (local, stack Supabase) en verde.

## Tareas

### PR 1 — ItemFormDialog.tsx
- [x] Exploración: estructura del dialog, item-meta.ts, uso en editor y en viaje del cliente
- [x] Change OpenSpec creado (propose/spec/design/tasks) — capability `item-form-modularity`, 6 req / 16 escenarios
- [ ] Implementación con TDD donde aplique
    - [x] WU1+WU2: pin test RED + movimiento a `src/lib/item-form-fields.ts` — commits `6cbc3c6`, `0ae56fe`
    - [x] WU3: extracción `MetadataFields` — commit `1afeeef` (remount key preservado, 119/893 green)
    - [x] WU4: extracción `ItemDocumentsSection` — commit `a05405b` (dialog 377 líneas)
    - [x] WU5: trim final (addendum `ItemCommonFields`, decisión Opción 1: también tipo+proveedor) + doc freshness — commit `f1df5d1`. Dialog 283 líneas; los 5 archivos ≤300
- [x] Verificación completa (tsc, build, unit, e2e local) — PASS WITH WARNINGS: tsc clean, lint 0 errores, 119/893 green, build clean, e2e 35 passed/1 skipped ×2
- [x] Revisión nativa RDD + PR creado — lineage `review-b6ff7e87f82ed842` (medium, lente reliability) **approved**, ack quemado; 3 hallazgos informativos (R3-doc-components-listing, R3-label-pin-gap, R3-zod-triangulation-shallow). **PR #410** (label type:feature, Refs #373)
- Commits: `6cbc3c6`, `0ae56fe`, `1afeeef`, `a05405b`, `f1df5d1`, `6a900ed`
- Hallazgos informativos (follow-up, no bloquean): doc components listing en architecture.md:276, gap de pin de labels en test, triangulación zod superficial

### PR 2 — page.tsx editor
- [x] Exploración — página 100% server sin useState; costuras: header, days nav, itinerario/DayCard, rail acciones/finanzas/completitud, rail detalles; pin test frágil (`page.test.ts`) repunteado
- [x] Change OpenSpec — `refactor-ui-trip-editor-sections`, capability `trip-editor-composition`, 8 req / 24 escenarios, excepción de tamaño documentada (movimiento mecánico)
- [x] Implementación — Fases 1–5: pin RED observado, meta module, 6 secciones server (page 870→261); Fase 6: trim + doc freshness (`sections/` en architecture.md)
- [x] Verificación completa — PASS WITH WARNINGS (tsc clean, lint 0 errores, 119/893 green, build clean, e2e 35/1)
- [x] Revisión nativa RDD + PR — bloqueo `lens_context_budget_exceeded` (rama acumulaba PR 1+2) resuelto con merge de #410 + rebase (decisión del usuario); lineage `review-95c2ba725de9d3d2` **approved**, ack quemado, 1 hallazgo informativo (R3-pin-join-attribution). **PR #411** (type:feature, Refs #373)
- Commits (rebased): `452139b`, `c29e006`, `81f47ee`

### PR 3 — ServiceChecklistManager.tsx
- [x] Exploración — 594 líneas, 12 handlers :86-197, un solo useTransition, dialog nativo + focus return; sin custom hooks en el repo (el hook sería el primero)
- [x] Change OpenSpec — `refactor-ui-service-checklist-split`, capability `service-checklist-modularity`, 10 req / 29 escenarios
- [x] Implementación — pin helper RED primero; `useServiceChecklist.ts` (221, primer hook del repo, handlers verbatim, 1 transition) + `ChecklistItemRow.tsx` (230, presentacional) + shell 596→274; summary extraction skipped por presupuesto ya cumplido (4.3)
- [x] Verificación completa — PASS WITH WARNINGS (tsc/lint/120-896/build/e2e 35-1 ×2, estructura y presupuesto OK)
- [x] Revisión nativa RDD + PR — lineage `review-047981e8a19c5e19` **approved**, ack quemado, 3 hallazgos informativos (R3-pin-env-coupling, R3-row-redundant-key, R3-verification-unproved WARNING). **PR #413** (type:feature, Refs #373)
- Commits: `3eed6d5`, `bff1921`
- Cleanup futuro anotado: prop `tripId` sin uso en el manager

### PR 4 — DashboardFilters.tsx
- [x] Exploración — 480 líneas, 8 bloques de filtro, 1 call site (TripsExplorer con remount key), normalize duplicado 4× (canónico en lib/trip-filters.ts:15), blur quirk solo para clientes
- [x] Change OpenSpec — `refactor-ui-dashboard-filters-split`, capability `dashboard-filters-modularity`, 11 req / 34 escenarios
- [x] Implementación — pin URL RED primero (14/15 fallando); URL layer verbatim a `src/lib/trip-filters.ts` (KEYS incl. page/clientsPage, deserialize/clean/build); `FilterCombobox` genérico (88, clearOnEmptyBlur solo cliente, de-dup de normalize probado) + `FilterBadges` (139, memo con su lint directive); shell 480→206
- [x] Verificación completa — **PASS** 8/8 gates (tsc/lint/120-908/build/e2e 35-1/presupuesto/estructura/git)
- [x] Revisión nativa RDD + PR — lineage `review-98e545e635f2feca` **approved**, ack quemado, 3 hallazgos informativos (R3-badge-memo-deps, R3-combobox-coverage-gap WARNING, R3-combobox-memo-identity). **PR #414** (type:feature, Closes #373)
- Commits: `40b7573`, `72aa8e4`

## Cierre del issue

- Los 4 archivos quedan ≤~300 líneas: ItemFormDialog 283, page.tsx 261, ServiceChecklistManager 274, DashboardFilters 206.
- Por PR: tsc + build + unit + e2e local (35 passed/1 skipped preexistente) en verde, revisión nativa RDD approved y autoridad quemada.
- PRs: #410 (mergeado), #411, #413, #414 (abiertos al cierre; el issue auto-cierra con el merge de #414).
- Hallazgos informativos acumulados como follow-ups: doc components listing architecture.md, pin de labels en test item-form-fields, triangulación zod superficial, prop tripId sin uso (ServiceChecklistManager), pin-join attribution en page.test.ts, badge memo deps + cobertura de combobox/debounce sin test determinista.
- Pre-existente a vigilar: job E2E Local rojo en CI también en main (runs 37240418947, 37236705067; specs traveler-activities) — no atribuible a estos PRs, con suite local verde en todas las corridas.

## Decisiones

### PR 1 — ItemFormDialog (diseño resuelto por orquestador con evidencia de exploración)
- Esquema de campos (`metadataFieldsByType`, `FieldDef`, `metadataDefaultValue`) → `src/lib/item-form-fields.ts` (precedente: `item-metadata-schemas.ts`, `item-meta.ts` en lib con tests).
- `appendSerializedMetadata` se mueve a lib y se re-exporta desde `ItemFormDialog.tsx` (import estable en `structured-items.test.ts:81`).
- Costura principal: `MetadataFields` genérico data-driven (`src/components/item-form/MetadataFields.tsx`), NO un componente por tipo (duplicaría el loop 6×). Se conserva la semántica exacta del remount key `${selectedType}-${metadataAutofillVersion}` (:462).
- Sección de documentos → `src/components/item-form/ItemDocumentsSection.tsx` (con `DocumentPreview`).
- TDD: test nuevo `src/lib/__tests__/item-form-fields.test.ts` fija el esquema actual antes de moverlo.

### PR 2 — page.tsx editor (diseño)
- Extracción de composición pura: secciones Server Components (props-in/JSX-out), sin managers cliente nuevos (la página no tenía estado; "bajar estado a managers hijos" ya era el status quo).
- Secciones co-ubicadas en `trips/[id]/sections/` (precedente: `ClientsExplorer.tsx` co-ubicado).
- `page.test.ts`: read set repunteado con las mismas 7 aserciones (pin estructural).
- Lección: el candidato nativo de revisión siempre es workspace-vs-main; PRs apilados sobre ramas no mergeadas exceden el presupuesto del lente → un PR por rama desde main cuando los archivos no se solapan.

## Baseline (rama, pre-refactor)

- `npx tsc --noEmit`: limpio
- `npm run test`: 118 archivos / 867 tests en verde
- `npm run build`: limpio (con .env.local copiado del worktree principal)
- Stack Supabase local: arriba (:54321); e2e local disponible

## Evidencia de cierre

- Veredicto final: criterio de cierre del issue cumplido en los 4 PRs (tamaño, verificación completa por PR, revisión nativa aprobada). Detalle por PR arriba.
