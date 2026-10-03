# Feature: refactor-data-dividir-trips-por-subdominios

Issue: https://github.com/eliumontoya/travelhub-app/issues/371
Rama base: `eliumontoya/refactor-data-dividir-src-lib-data-trips.ts-por` (== origin/main 977e434)
Estrategia acordada: **un PR por subdominio, uno a la vez**, moviendo código y dual-mode tal cual; sin reescrituras ni renombres.

## Contexto

- `src/lib/data/trips.ts`: 2.320 líneas, 67 exports, 38 conmutadores duales `isSupabaseConfigured()`.
- Fachada `src/lib/data.ts` reexporta `@/lib/data/trips`; 64 llamadores importan por `@/lib/data`.
- Importantes NO-fachada que importan `@/lib/data/trips` directamente: `data/dashboard.ts`, `data/documents.ts`, y tests (`data-domain-contracts.test.ts`, `item-supplier-persistence.test.ts`, `data/__tests__/auto-create.test.ts`) → los submódulos se reexportan desde `trips.ts` para mantener esos imports intactos.
- Secciones actuales: Trips (11), Packing #24 (1474), Recordatorios #49 (1554), Trip days (1650), Items (1796).
- Acoplamiento: `createTripFromTemplate` → `createTripDay`/`createItem`; agregados de lectura (`getTripWithDetails`, `getClientPublishedTripsBySlug`) usan `rowToTripDay`, `rowToTripPhoto`, etc.
- Reglas anti-monolito (`architecture.md`): mappers `rowTo*` junto al dominio de su tabla; helpers compartidos en `data/shared.ts`; fijar contratos con tests antes de mover.

## Orden de partición (por acoplamiento, menor primero)

1. **trip-packing.ts** — packing list (más aislado; contratos ya en `data.test.ts`)
2. **trip-reminders.ts** — recordatorios + email (depende de `rowToTrip`)
3. **trip-history.ts** — status history, notas internas, métricas (`dashboard.ts` importa `getTripStatusHistory`)
4. **trip-days.ts** — días, reordenamiento, `generateTripDays`, `rowToTripDay`
5. **trip-items.ts** — items, reordenamiento, traveler activities
6. **trip-templates.ts** — templates (importa days/items ya extraídos)
7. **trips.ts final** — orquestador delgado: queries de viaje, agregados, create/update/delete, `rowToTrip`; reexporta los submódulos

## Criterios de cierre (por PR y global)

- `npx tsc --noEmit`, `npm run test`, `npm run build` en verde.
- Cero cambios en llamadores (fachada y direct-imports intactos).
- Al final: ningún archivo de `src/lib/data/` supera ~800 líneas.

## Tareas

- [x] 1. PR1: extraer `trip-packing.ts` de `trips.ts` (sección #24, líneas ~1474–1553), reexportar desde `trips.ts`. Commit `refactor(data): extract trip-packing module from trips.ts` → `197b3db` (rama `refactor/data-trips-packing`). Verificación: tsc 0 errores, 822 tests en verde, build OK, diff solo en trips.ts + trip-packing.ts.
- [x] 2. PR2: extraer `trip-reminders.ts`. Commit `refactor(data): extract trip-reminders module from trips.ts` → `2cfddab` (rama `refactor/data-trips-reminders`, apilada sobre `refactor/data-trips-packing`). Verificación: tsc 0, 822 tests, build OK, movimiento verbatim. Nota: gap preexistente — sin test unitario directo de las funciones movidas (solo route test con mock de la fachada).
- [x] 3. PR3: extraer `trip-history.ts`. Commit `refactor(data): extract trip-history module from trips.ts` → `7102993` (rama `refactor/data-trips-history`, apilada sobre `refactor/data-trips-reminders`). Verificación: tsc 0, 822 tests, build OK, verbatim (sha256 idéntico), `rowToTripStatusHistory` privado. Nota: `getTripsPerMonth`/`MonthlyTripCount` sin cobertura de test (preexistente).
- [x] 4. PR4: extraer `trip-days.ts`. Commit `refactor(data): extract trip-days module from trips.ts` → `ae26dbb` (rama `refactor/data-trips-days`, apilada sobre `refactor/data-trips-history`). Verificación: tsc 0, 822 tests, build OK, verbatim sha256 (bloque principal + reorderTripDays). `reorderTripDays` se movió desde la sección Items (el issue asigna reordenamiento a este subdominio). `enumerateDates` privado. Nota: updateTripDay/deleteTripDay/restoreTripDay/rowToTripDay sin test unitario directo (preexistente).
- [x] 5. PR5: extraer `trip-items.ts` (incluye traveler activities). Commit `refactor(data): extract trip-items module from trips.ts` → `27d1a35` (rama `refactor/data-trips-items`, apilada sobre `refactor/data-trips-days`). Verificación: tsc 0, 822 tests, build OK, verbatim md5, 43=43 símbolos públicos, sin aristas de ciclo nuevas. `trips.ts`: 1.892 → 1.382 líneas. `trip-items.ts`: 516 líneas (<800).
- [x] 6. PR6: extraer `trip-templates.ts`. Commit `refactor(data): extract trip-templates module from trips.ts` → `ad44e84` (rama `refactor/data-trips-templates`, apilada sobre `refactor/data-trips-items`). Verificación: tsc 0, 822 tests, build OK, verbatim cmp, privados no exportados. `trips.ts`: 1.382 → 1.303 líneas. `trip-templates.ts`: 88 líneas. Nota: sin test unitario directo del cluster de templates (preexistente).
- [ ] 7. PR7: dejar `trips.ts` como orquestador delgado + verificación final de criterios.
