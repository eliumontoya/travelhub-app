# Feature: refactor-types-mover-los-tipos-de-dominio-junto

Issue: https://github.com/eliumontoya/travelhub-app/issues/374
Rama base: `eliumontoya/refactor-types-mover-los-tipos-de-dominio-junto` (== main 2d1104f)

## Decisión (usuario, 2026-07)

- **Destino de los tipos**: `src/lib/data/<dominio>.types.ts`, junto al módulo de datos del dominio (cohesión total con los mappers `rowTo*`). `src/types/index.ts` queda como **barril** que solo re-exporta.
- **Ritmo**: un PR por grupo de dominios afines. **PR1 = familia de visas**; PRs siguientes mueven el resto (clients+tags+settings; trips+items+packing; services+suppliers+travel-agents; whatsapp/WCC+profiles).

## Restricciones

- Refactor puro de tipos: sin cambios de comportamiento, sin renombres.
- Ningún import de llamador cambia (el barril `@/types` mantiene la superficie).
- #371 ya está cerrada → la restricción de coordinación del issue se cumple.

## Familia visas (PR1)

Tipos en `src/types/index.ts`: `VisaStatus`, `Visa`, `VisaFilters`,
`VisaStatusHistoryEntry`, `VisaDocumentStatus`, `VisaDocument`, `VisaWithDetails`.

- Mappers/CRUD: `src/lib/data/visas.ts`, `src/lib/data/visa-documents.ts` (importan por `@/types`, se dejan intactos).
- Acoplamiento cruzado: `VisaWithDetails` referencia `Client` (aún en el barril) → import type-only desde `@/types`; sin ciclo de runtime.

## Criterio de cierre (por PR)

- `npx tsc --noEmit`, `npm run test`, `npm run build` en verde.
- `src/types/index.ts` solo pierde definiciones de visas y gana la línea de re-export; resto intacto.
- Ningún import de llamador cambió.
- `architecture.md` actualizado si la estructura descriptiva envejece.

## Tareas

- [x] 1. Crear `src/lib/data/visas.types.ts` con la familia de visas movida verbatim; `src/types/index.ts` re-exporta desde el nuevo módulo (barril). Commit `refactor(types): extract visa type family to colocated visas.types.ts module (issue #374)` → `74eac07`. Diff: 3 archivos (+74/−66): nuevo `visas.types.ts` (67 líneas, import type-only de `Client`), `types/index.ts` (−65 declaraciones, +1 línea barril en línea 44), `architecture.md` (nota de migración progresiva, 1–3 líneas). Módulos `visas.ts`/`visa-documents.ts` y llamadores intactos.
- [x] 2. Verificación: `npx tsc --noEmit` 0 errores; `npm run test` 118 archivos / 867 tests en verde; `npm run build` exit 0 (29/29 páginas; primer intento falló por `.env.local` ausente en el worktree — ambiental, no del refactor; re-verificado copiando el `.env.local` del checkout principal, archivo gitignored). Identidad byte a byte de las 65 líneas movidas y del resto del barril confirmada por el writer. `next-env.d.ts` modificado como side-effect de `next build` y restaurado antes del commit.
- [x] 3. Commit work-unit en la rama del feature con mensaje Conventional; registrar evidencia aquí → `74eac07`.
- [x] 4. Entrega: push de la rama y PR **#412** abierto (base `main`, `Refs #374` no-cerrante, etiqueta `type:feature` según precedencia del repo — no existe `type:refactor`). Revisión nativa Gentle AI **approved** (lineages `review-ba35a98f2e3bc8c7`, `review-951e84800605ee7f`, `review-13d4ad89dc8eda91`; autoridad quemada; hallazgos solo informativos: `R3-barrel-star-ambiguity`, `R3-types-module-runtime-edge`). CI: Vercel verde; Supabase Preview skipping (no requerido).
- [x] 5. **PR #412 merged** en `main` → merge commit `3c50969` (2026-10-05). Conflicto con #410 resuelto en merge commit `51803f2` (solo `architecture.md`, ambas líneas conservadas). PR1 cerrado; el issue #374 continúa con PR2 (clients + tags + settings), que apilará sobre `main` actualizado.
- [x] 6. PR2 (clients + tags + settings): rama `eliumontoya/refactor-types-pr2-clients-tags-settings` sobre `main` (`3c50969`). Commit `refactor(types): extract client, tag, and settings type families to colocated domain modules (issue #374)` — crea `src/lib/data/clients.types.ts` (58 líneas: Client, ClientSession, ClientHomeTrip, ClientProfileForHome, ClientDocument; import type-only de TripStatus/TripCurrency), `src/lib/data/tags.types.ts` (Tag), `src/lib/data/settings.types.ts` (SiteSettings); barril ahora con 4 re-exports alfabéticos + 2 imports type-only locales (`Client`/`Tag` siguen referenciados por el propio barril en TripWithDetails — necesidad mecánica detectada por el writer, validada con tsc). Verificación: tsc 0 errores, 119 archivos / 893 tests OK, build exit 0. Revisión nativa **approved** (lineage `review-c228eb7d4abba84b`, autoridad quemada; informativo `R3-barrel-star-surface-growth`).

- [x] 7. **PR #415 merged** en `main` → merge commit `87030e2` (2026-10-05). Nota CI: el check "Lint, Build & Unit Tests" falló por causa infraestructural (runner alojado nunca adquirió el job: "not acquired by Runner of type hosted"), no por código; la verificación local (tsc, 893 tests, build) y el deploy Vercel ya estaban en verde. PR2 cerrado; siguiente PR3 (trips + items + packing) apilará sobre `main` (`87030e2`).
- [x] 8. PR3 (trips + items + packing): rama `eliumontoya/refactor-types-pr3-trips-items-packing` sobre `main` (`87030e2`). Commit `refactor(types): extract trip, item, and packing type families to colocated domain modules (issue #374)` — crea `src/lib/data/trips.types.ts` (117 líneas: TripStatus, TripCurrency, TripFilters, Trip, TripStatusHistoryEntry, TripDay, TripPhoto, TripDocument, TripWithDetails, TripFeedback), `src/lib/data/items.types.ts` (117 líneas: ItemType, ItemDocument, metadatos Flight/Hotel exportados + Activity/Restaurant/Transport/BaseItem/variantes no exportados, Item, ItemWithSupplier), `src/lib/data/packing.types.ts` (PackingItem). Barril ahora con 7 re-exports alfabéticos (485→248 líneas); los imports type-only de Client/Tag en el barril se eliminaron (TripWithDetails salió del barril); `trips.types.ts` importa type-only directo de módulos hermanos (clients/tags/items/packing — evita aristas de ciclo por el barril); `items.types.ts` mantiene `import type { Supplier } from "@/types"` (Supplier queda para PR4). Verificación: tsc 0 errores, 120 archivos / 896 tests OK, build exit 0. Revisión nativa **approved** (lineage `review-6a74616f9e67eb05`, autoridad quemada; informativo `R3-001` sobre el import type-only de Supplier). PR **#417** abierto (apilado sobre main). Incidente resuelto: el relay rechazó 2 veces el payload del revisor por un bloque extra tras el JSON; STATUS fresco + reintento regeneró la salida y la revisión cerró approved (lineage `review-7d73e6b5ec599059` sobre el árbol con evidencia; informativos `R3-client-empty-object-contract`, `R3-supplier-barrel-type-cycle`).
- [x] 9. PR4 (services + suppliers + travel-agents): commit `refactor(types): extract service, supplier, and travel-agent type families to colocated domain modules (issue #374)` en la misma rama (apilado sobre PR3) — crea `src/lib/data/services.types.ts` (53 líneas: ServiceType, ServiceUploadStatus, Service, ServiceChecklistItem, ServiceUpload, ServiceChecklistItemWithUpload, ServiceWithChecklist, ServiceDocumentSummary), `src/lib/data/suppliers.types.ts` (Supplier), `src/lib/data/travel-agents.types.ts` (TravelAgent). `items.types.ts:1` cambia de `@/types` a `@/lib/data/suppliers.types` — elimina el ciclo de barril señalado por la revisión (R3-supplier-barrel-type-cycle). Barril: 248→169 líneas, 10 re-exports alfabéticos. Verificación: tsc 0 errores, 120 archivos / 896 tests OK, build exit 0. Revisión nativa **approved** (lineage `review-5db5b6664dc3fbcd`, autoridad quemada; informativos `R3-doc-drift-reexports`/`R3-doc-drift-supplier-import` sobre líneas desactualizadas de este documento, corregidas con este registro). PR apilado sobre #417.

## Siguientes PRs (mismo issue)

- PR2: clients + tags + settings; PR3: trips + items + packing; PR4: services + suppliers + travel-agents; PR5: whatsapp/WCC + profiles. Al final, `src/types/index.ts` contiene solo re-exports.
