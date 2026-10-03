# Feature: refactor-data-dividir-services-por-subdominios

Issue: https://github.com/eliumontoya/travelhub-app/issues/385
Base: `main` @ 0767172 (post #371).
Estrategia: misma validada en #371 — PRs apilados, movimiento verbatim, reexports, cero cambios en llamadores.

## Contexto

- `src/lib/data/services.ts`: 883 líneas, 19 conmutadores duales, 26 funciones; único archivo de `src/lib/data/` sobre el umbral de ~800 tras #371.
- Llamadores directos además de la fachada: `trips.ts` (`deleteChecklistItem`, `ensureServiceForAssignment`), `client/trips/[id]/documents/**`, `mcp/tools/service-documents.ts`.
- Helpers privados compartidos `getServiceClient` y `nowIso` usados por ambos subdominios → módulo interno `service-shared.ts` NO reexportado por la fachada (evita crecer la API pública).

## Plan (2 PRs apilados)

1. **service-documents.ts** (~420 líneas): `buildStoragePath` (priv), `rowToServiceUpload`, `assertServiceUploadMutable`, `getServiceDocumentSummariesForTrip`, `uploadServiceDocument`, `markUploadReviewed`, `markUploadProcessed`, `requestReUpload`, `getServicesProgressForClient` + creación de `service-shared.ts` con `getServiceClient`/`nowIso`.
2. **service-checklist.ts** (~300 líneas): `rowToServiceChecklistItem`, `addChecklistItem`, `addChecklistItemToTripServices`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklistItems`, `getServiceWithChecklist`, `getServiceChecklistForTrip`, `nextSortOrder` (priv). `getServiceWithChecklist` importará `rowToServiceUpload` de service-documents.

`services.ts` final ~200 líneas: `rowToService`, `getServiceForClientTrip`, `getServicesForTrip`, `ensureServiceForAssignment`, `hasOwnedServiceRequirements` + reexports.

## Criterios de cierre (por PR y global)

- `npx tsc --noEmit`, `npm run test`, `npm run build` en verde.
- Cero cambios en llamadores; API pública de `@/lib/data` idéntica (service-shared.ts sin exportar por la fachada).
- Al final: ningún archivo de la serie supera ~800 líneas.

## Tareas

- [x] 1. PR1: extraer `service-documents.ts` + `service-shared.ts`. Commit `refactor(data): extract service-documents module from services.ts` → `1fb0e6e` (rama `refactor/data-services-documents`, apilada sobre `main` @ 0767172). Verificación: tsc 0, 822 tests, build OK, verbatim, 21=21 símbolos públicos, service-shared no filtrado por la fachada. `services.ts`: 883 → 472 líneas. Nota: `DEFAULT_SERVICE_TYPE` (privado) se movió a service-shared por ser necesario en ambos lados — decisión confirmada por orquestación.
- [ ] 2. PR2: extraer `service-checklist.ts`; dejar `services.ts` delgado + verificación final.
