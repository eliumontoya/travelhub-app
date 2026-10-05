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

## Siguientes PRs (mismo issue)

- PR2: clients + tags + settings; PR3: trips + items + packing; PR4: services + suppliers + travel-agents; PR5: whatsapp/WCC + profiles. Al final, `src/types/index.ts` contiene solo re-exports.
