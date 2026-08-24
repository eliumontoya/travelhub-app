# Tasks: Global trip documents (issue #134)

- [ ] T1. Migration `supabase/migrations/0031_trip_documents.sql`: create
      `trip_documents` table, index, RLS (owner all + public read when published),
      grants.
- [ ] T2. `src/types/index.ts`: add `TripDocument` interface; extend
      `TripWithDetails` with `documents`.
- [ ] T3. `src/lib/data.ts`: add `rowToTripDocument`, `uploadTripDocument`,
      `getTripDocuments`, `deleteTripDocument` (mock-aware).
- [ ] T4. `assembleTripWithDetails`: fetch `trip_documents` with signed URLs and
      return on `TripWithDetails`. Mock `getTripWithDetails` returns `documents: []`.
- [ ] T5. `src/app/dashboard/trips/[id]/actions.ts`: add
      `uploadTripDocumentAction`, `deleteTripDocumentAction`,
      `getTripDocumentsAction`.
- [ ] T6. `src/components/TripDocuments.tsx`: client component (upload/list/delete
      with refresh).
- [ ] T7. Dashboard trip editor: render `<TripDocuments>` after the photo gallery.
- [ ] T8. Public view `src/app/t/[slug]/page.tsx`: render "Documentos del viaje"
      section from `trip.documents`.
- [ ] T9. Verify: `npx tsc --noEmit`, `npm run build`, `npm test`. Fix errors.
- [ ] T10. Commit per task group with conventional commits; push branch; open PR.
