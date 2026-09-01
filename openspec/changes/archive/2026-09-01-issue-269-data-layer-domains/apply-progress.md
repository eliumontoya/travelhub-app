# Apply Progress: Data Layer Domain Boundaries

**Change**: issue-269-data-layer-domains
**Mode**: Strict TDD
**Delivery strategy**: exception-ok / size:exception approved by launch request
**Schema change**: None. No migrations, RLS policies, database functions, or storage bucket definitions were modified.

## Completed Tasks

- [x] 1.1 Added `src/lib/__tests__/data-domain-contracts.test.ts` importing through `@/lib/data` and future direct domain paths before modules existed.
- [x] 1.2 Covered mock client/tag create/list/tag-assignment behavior and facade export compatibility.
- [x] 1.3 Covered representative trip/detail and document/storage mock contracts.
- [x] 2.1 Created `src/lib/data/shared.ts` with shared pagination, id, mock/Supabase helpers, and common utility exports.
- [x] 2.2 Moved client/tag code to `src/lib/data/clients.ts` without behavior changes.
- [x] 2.3 Moved supplier supporting code to `src/lib/data/suppliers.ts` without behavior changes.
- [x] 2.4 Moved trip, itinerary, packing, and reminder code to `src/lib/data/trips.ts` without behavior changes.
- [x] 2.5 Moved documents, storage, photos, covers, and logo upload code to `src/lib/data/documents.ts` without behavior changes.
- [x] 2.6 Moved dashboard stats, settings, and feedback code to support modules.
- [x] 2.7 Replaced `src/lib/data.ts` with compatibility re-exports.
- [x] 3.1 Ran focused contract tests through RED/GREEN/REFACTOR evidence.
- [x] 3.2 Ran typecheck, lint, unit tests, and build verification.
- [x] 3.3 Persisted apply-progress and prepared verify evidence with no schema-change note.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1-1.3 | `src/lib/__tests__/data-domain-contracts.test.ts` | Unit/contract | Existing targeted suite later passed 39/39 | ✅ Failed first: missing `@/lib/data/clients` module | ✅ 4/4 passed after extraction | ✅ 4 scenarios: facade, clients/tags, trips, documents | ✅ Lint clean and full suite green |
| 2.1-2.7 | Same + existing data tests | Unit/contract | ✅ `npm run test -- ...data/public/storage tests`: 39/39 | ✅ Contract imports forced new module boundary | ✅ `npm run test -- src/lib/__tests__/data-domain-contracts.test.ts`: 4/4 | ✅ Existing suite confirmed behavior preservation | ✅ Removed import warnings; facade is re-export only |

## Work Unit Evidence

| Unit | Focused test command and exact result | Runtime harness command/scenario and exact result | Rollback boundary |
|------|---------------------------------------|--------------------------------------------------|-------------------|
| 1 | `npm run test -- src/lib/__tests__/data-domain-contracts.test.ts` RED failed with missing domain module, then GREEN 4/4 passed | N/A — data-layer unit contract; no route/UX boundary changed | Remove `src/lib/__tests__/data-domain-contracts.test.ts` |
| 2 | `npm run test -- src/lib/__tests__/data.test.ts ... site-settings.test.ts` exited 0, 6 files/39 tests passed | N/A — compatibility/import refactor only | Revert `src/lib/data.ts` and remove `src/lib/data/` |
| 3 | `npm run test` exited 0, 49 files/274 tests passed; `npx tsc --noEmit`, `npm run lint`, `npm run build` exited 0 | N/A — no Next route or browser behavior changed | Revert OpenSpec spec/archive artifacts |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/lib/data.ts` | Modified | Converted to compatibility facade re-exporting domain modules. |
| `src/lib/data/shared.ts` | Created | Shared pagination/id/config helpers and utility exports. |
| `src/lib/data/clients.ts` | Created | Client CRUD, client tags, tag catalog, trip tags. |
| `src/lib/data/suppliers.ts` | Created | Supplier CRUD/catalog helpers. |
| `src/lib/data/trips.ts` | Created | Trip, itinerary, item, packing, reminders, detail assembly. |
| `src/lib/data/documents.ts` | Created | Documents, storage URLs, photos, covers, logo upload. |
| `src/lib/data/dashboard.ts` | Created | Recent activity and trip stats. |
| `src/lib/data/settings.ts` | Created | Site settings. |
| `src/lib/data/feedback.ts` | Created | Trip feedback. |
| `src/lib/__tests__/data-domain-contracts.test.ts` | Created | Domain-boundary contract tests. |

## Deviations from Design

None — implementation matches the design. The supporting domains were extracted too so `src/lib/data.ts` could be a pure facade.

## Issues Found

- `npm ci` and `npm run build` warn that current Node v20.19.6 is below future/declared Supabase JS Node >=22 support.
- `npm run build` warns that Next.js 16.2.10 deprecates the `middleware` convention in favor of `proxy`; not changed because routes/middleware are out of scope.

## Status

13/13 tasks complete. Ready for verify.
