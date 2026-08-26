# Exploration: Issue #186 — Delete trips

## Current state

- Issue #186 asks for deleting a trip from each trip page after confirmation.
- Trip editor/detail page: `src/app/dashboard/trips/[id]/page.tsx`.
- Co-located Server Actions: `src/app/dashboard/trips/[id]/actions.ts`.
- Data boundary: `src/lib/data.ts`, dual mock/Supabase mode.
- Existing Supabase FKs cascade from `trips` to trip-scoped rows (`trip_days`, `trip_clients`, `trip_tags`, `packing_items`, `trip_photos`, `trip_feedback`, `trip_status_history`, `trip_documents`) and from days to items/documents.

## Docs read

- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md`

Takeaways: Server Actions are POST entry points and must validate server-side; call `revalidatePath` before `redirect()` after mutations.

## Risks

- UI confirmation alone is insufficient; the Server Action must validate the exact current title.
- After delete, redirect away from the now-missing trip page.
- Storage objects are not removed by row cascades, so Supabase delete should clean known object paths before deleting the row.
