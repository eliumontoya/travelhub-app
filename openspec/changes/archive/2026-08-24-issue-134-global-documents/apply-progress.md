# Apply Progress: Global trip documents (issue #134)

**Change**: issue-134-global-documents  
**Mode**: Strict TDD (reconciliation — code already merged via PR #144)  
**Worker**: sdd-apply  
**Date**: 2026-08-24  
**Delivery strategy**: single-pr + exception-ok  

## Completion Status

All 10 tasks are complete.

- [x] T1. Migration `supabase/migrations/0032_trip_documents.sql`: create `trip_documents` table, index, RLS (owner all + public read when published), grants.
- [x] T2. `src/types/index.ts`: add `TripDocument` interface; extend `TripWithDetails` with `documents`.
- [x] T3. `src/lib/data.ts`: add `rowToTripDocument`, `uploadTripDocument`, `getTripDocuments`, `deleteTripDocument` (mock-aware).
- [x] T4. `assembleTripWithDetails`: fetch `trip_documents` with signed URLs and return on `TripWithDetails`. Mock `getTripWithDetails` returns `documents: []`.
- [x] T5. `src/app/dashboard/trips/[id]/actions.ts`: add `uploadTripDocumentAction`, `deleteTripDocumentAction`, `getTripDocumentsAction`.
- [x] T6. `src/components/TripDocuments.tsx`: client component (upload/list/delete with refresh).
- [x] T7. Dashboard trip editor: render `<TripDocuments>` after the photo gallery.
- [x] T8. Public view `src/app/t/[slug]/page.tsx`: render "Documentos del viaje" section from `trip.documents`.
- [x] T9. Verify: `npx tsc --noEmit`, `npm run build`, `npm test`. Fix errors.
- [x] T10. Commit per task group with conventional commits; push branch; open PR.

## Task Evidence

### T1 — Schema migration

**Actual on-disk filename**: `supabase/migrations/0032_trip_documents.sql` (renumbered from the planned `0031` due to a batch collision).

Evidence:
- Table `trip_documents` with columns `id`, `trip_id`, `file_path`, `filename`, `mime_type`, `created_at` at `supabase/migrations/0032_trip_documents.sql:6-13`.
- Index on `trip_id` at line 15.
- RLS enabled + forced at lines 17-18.
- Owner policy `trip_documents_owner_all` at lines 21-24.
- Public read-when-published policy `trip_documents_public_read_published` at lines 28-36.
- Grants `revoke all ... from anon/authenticated; grant select,insert,update,delete to authenticated; grant select to anon;` at lines 38-41.

### T2 — Types

Evidence:
- `TripDocument` interface at `src/types/index.ts:124-131`.
- `TripWithDetails.documents: (TripDocument & { url: string | null })[]` at `src/types/index.ts:274-275`.

### T3 — Data-layer functions

Evidence:
- `uploadTripDocument(tripId, file)` at `src/lib/data.ts:2643-2665`; throws when Supabase is unconfigured (line 2644-2645), stores under `trips/{tripId}/{timestamp}-{filename}` (line 2648), inserts into `trip_documents` (lines 2653-2662), and returns `rowToTripDocument(data)` (line 2664).
- `getTripDocuments(tripId)` at `src/lib/data.ts:2667-2685`; returns `[]` when unconfigured (line 2670), queries by `trip_id` ordered by `created_at desc` (lines 2672-2676), and attaches signed URLs (lines 2678-2684).
- `deleteTripDocument(id)` at `src/lib/data.ts:2687-2700`; no-ops in mock mode (line 2688), removes the Storage object (lines 2695-2696) and the row (lines 2698-2699).
- `rowToTripDocument(row)` at `src/lib/data.ts:2702-2711`.
- Shared bucket constant `DOCUMENTS_BUCKET = "trip-documents"` at `src/lib/data.ts:2417`.

### T4 — Assembly + mock

Evidence:
- `assembleTripWithDetails` queries `trip_documents` by `trip_id`, signs each URL, and returns `documents` at `src/lib/data.ts:1367-1379`.
- The result is included in the returned `TripWithDetails` object at `src/lib/data.ts:1388`.
- Mock `getTripWithDetails` builds `documents: []` and returns it at `src/lib/mock-data.ts:613-614`.

### T5 — Server actions

Evidence:
- Imports at `src/app/dashboard/trips/[id]/actions.ts:33-35`.
- `uploadTripDocumentAction(tripId, slug, formData)` at lines 379-385; revalidates `/dashboard/trips/${tripId}` and `/t/${slug}`.
- `deleteTripDocumentAction(tripId, slug, documentId)` at lines 387-391; revalidates both paths.
- `getTripDocumentsAction(tripId)` at lines 393-395.

### T6 — Client component

Evidence:
- `src/components/TripDocuments.tsx:1-97` defines the client component with props `documents`, `documentsEnabled`, `onUpload`, `onDelete`, `onRefresh`.
- Upload flow uses `useTransition` and refreshes the list after upload (lines 25-35).
- Delete flow confirms and refreshes (lines 37-43).
- Disabled state shows `"Configura Supabase para subir documentos."` (line 93).

### T7 — Dashboard editor integration

Evidence:
- `TripDocuments` imported at `src/app/dashboard/trips/[id]/page.tsx:38` and actions imported at lines 64 and 90, 92.
- Rendered after `<TripPhotoGallery>` at `src/app/dashboard/trips/[id]/page.tsx:334-342`.

### T8 — Public view

Evidence:
- `trip.documents` rendered in `"Documentos del viaje"` section at `src/app/t/[slug]/page.tsx:188-208`.
- Each document is a signed-URL link when `doc.url` is present (lines 193-205).

### T9 — Verification

Commands run:

```bash
npx tsc --noEmit
npm run build
npm test
```

Results:
- `npx tsc --noEmit` — **FAILED** with one unrelated infrastructure error:
  `.next/types/validator.ts(5,79): error TS2307: Cannot find module './routes.js' or its corresponding type declarations.`
  This error is in a Next.js-generated file under `.next/types`, not in the change code.
- `npm run build` — **PASSED** (compiled, finished TypeScript, generated static pages).
- `npm test` — **PASSED** (13 files, 93 tests).

### T10 — Delivery

Evidence:
- PR #144 merged to `main` at commit `676f950` (`Merge pull request #144 from eliumontoya/feat/issue-134-global-documents`).
- Preceding implementation commits: `82c0edc` (table + data layer), `efe1c3e` (public view).

## TDD Cycle Evidence Table

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| T1 | N/A — reconciliation | `supabase/migrations/0032_trip_documents.sql:6-41` table + index + RLS + grants | N/A |
| T2 | N/A — reconciliation | `src/types/index.ts:124-131`, `:274-275` | N/A |
| T3 | N/A — reconciliation | `src/lib/data.ts:2643-2711` functions + mapper | N/A |
| T4 | N/A — reconciliation | `src/lib/data.ts:1367-1379`, `src/lib/mock-data.ts:613-614` | N/A |
| T5 | N/A — reconciliation | `src/app/dashboard/trips/[id]/actions.ts:379-395` | N/A |
| T6 | N/A — reconciliation | `src/components/TripDocuments.tsx:1-97` | N/A |
| T7 | N/A — reconciliation | `src/app/dashboard/trips/[id]/page.tsx:334-342` | N/A |
| T8 | N/A — reconciliation | `src/app/t/[slug]/page.tsx:188-208` | N/A |
| T9 | N/A — reconciliation | `npm run build` passed, `npm test` passed | N/A |
| T10 | N/A — reconciliation | PR #144 merged (`676f950`) | N/A |

## Work Unit Evidence Table

| Evidence | Value |
|----------|-------|
| Focused test command and exact result | `npm test` → 13 test files passed, 93 tests passed |
| Runtime harness command/scenario and exact result | `npm run build` → compiled successfully, generated static pages; `npx tsc --noEmit` failed only on unrelated Next.js-generated `.next/types/validator.ts` |
| Rollback boundary | N/A — reconciliation only; source already merged |

## Deviations from Design

- **Migration renumbering**: Design specified `0031_trip_documents.sql`; the actual file is `0032_trip_documents.sql` because of a batch collision with `0031_client_cover_image.sql`. The schema content matches the design exactly.
- **No other deviations**: types, data layer, actions, UI, assembly, and public view all match `design.md`.

## Issues / Coverage Gaps Found

- **Dedicated unit tests missing for trip-document data functions**: `src/lib/__tests__/data.test.ts` covers `getTripWithDetails` but does not exercise `uploadTripDocument`, `getTripDocuments`, `deleteTripDocument`, or `rowToTripDocument`. This is noted as a coverage gap only; no tests were added during this reconciliation phase.
- **Standalone `npx tsc --noEmit` failure**: Fails on `.next/types/validator.ts` looking for `./routes.js`. This is generated by Next.js and is unrelated to the global-documents change. `npm run build` runs its own TypeScript check and passes cleanly.

## Next Recommended Phase

`sdd-verify` or `sdd-archive` — the implementation is merged and reconciled. The only remaining action is formal archiving (merge delta specs into main specs) if the verify phase is satisfied.
