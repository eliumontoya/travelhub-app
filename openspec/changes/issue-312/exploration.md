# Exploration: Document portal per service with client checklist

## Current State

TravelHub already has a private Supabase Storage bucket `trip-documents`, a `documents` table for item-level files, and a `client_documents` table for generic client files. The client portal (`/client`) is a Server Component protected by a custom email+PIN cookie session; it reads trips via `getClientHomeTrips`, which uses the service role because the client has no Supabase Auth identity. Dashboard trip editing uses `src/app/dashboard/trips/[id]/actions.ts` and a rich Server-Component page. `trip_clients` is the source of truth for trip↔client assignments, and `createTrip`/`setTripClients` are the mutation points. There is no `services`, `service_checklist_items`, or `service_uploads` schema yet.

## Affected Areas

- `src/app/client/page.tsx` — needs a per-trip “Documentos” link + pending/uploaded progress counter.
- `src/app/client/trips/[id]/documents/` (new route) — client-facing checklist UI and Server Actions.
- `src/lib/data/services.ts` (new module) — `services`, `service_checklist_items`, `service_uploads` CRUD + upload/download helpers, dual-mode mock/Supabase.
- `src/lib/data/documents.ts` — new upload helper that writes to `services/{serviceId}/{checklistItemId}/...` and returns signed URLs via service role.
- `src/lib/data/trips.ts` — auto-create a service when a client is assigned; update `deleteTrip` cleanup.
- `src/app/dashboard/trips/[id]/actions.ts` — checklist editor actions (add/edit/delete items, mark upload processed/request re-upload).
- `src/app/dashboard/trips/[id]/page.tsx` — new sidebar card for the checklist editor and a view of pending uploads.
- `src/types/index.ts` — new `Service`, `ServiceChecklistItem`, `ServiceUpload`, and enriched `ClientHomeTrip`.
- `src/lib/mock-data.ts` — mock arrays for services/checklist/uploads so the app works without Supabase.
- `supabase/migrations/` — new migration for the three tables, indexes, RLS policies, and bucket-path conventions.

## Approaches

1. **One service per trip (service_type = `trip_documents`)**
   - Pros: Simpler schema and UI; one checklist per trip; deletion cascade is straightforward.
   - Cons: If a trip has multiple clients, all share the same checklist and uploads; the requirement says “por cada servicio (trip)”, which fits this model, but “service auto-created when a trip is assigned to a client” could imply per-client services.
   - Effort: Medium

2. **One service per trip-client assignment (service links `trip_id` + `client_id`)**
   - Pros: Natural for future per-client services (e.g., visas per traveler); each client has own checklist progress.
   - Cons: More rows, more complex auto-creation hook on `trip_clients` changes, and the agent must manage multiple checklists for the same trip.
   - Effort: Medium-High

## Recommendation

Start with **one service per trip** (`service_type = 'trip_documents'`, `trip_id` unique per service type) because the issue frames the portal as “por servicio (trip)” and because it keeps the first iteration reviewable. The schema can later add `client_id` to `services` when visas or per-client services are needed. Auto-create the service inside `createTrip` after `trip_clients` insertion and guard `setTripClients` so a service is only created once. Client uploads use a dedicated Server Action with `getSupabaseAdmin`, and the storage path follows the required `services/{serviceId}/{checklistItemId}/{timestamp}-{filename}` prefix.

## Risks

- **Auth/RLS gap**: The client has no Supabase Auth user, so every database read/write from the client portal must go through a Server Action using the service role; direct browser access to the bucket or tables will be blocked by RLS/storage policies.
- **Bucket policy mismatch**: `trip-documents` currently only allows `auth.uid() is not null`. Server-side service role bypasses this, but any accidental client-side Supabase call will fail silently or with 403; all signed URLs must be generated server-side.
- **Mock mode coverage**: Without Supabase, the new feature must be backed by mock arrays or it will appear broken in local dev; the current mock data has no services.
- **Orphan cleanup**: `deleteTrip` deletes item docs and trip docs but will not know about service uploads unless the cleanup logic is extended.
- **Re-upload replacement**: Need both a database upsert on `(service_id, checklist_item_id)` and deletion of the previous storage object to avoid orphan files.
- **Status lifecycle**: `uploaded → processed | re_upload_requested` requires agent actions in the dashboard and read-only status display in the client portal.

## Ready for Proposal

Yes. The codebase has clear conventions (dual-mode data layer, service-role client reads, bucket helpers, Server Actions co-located with routes) and the integration points are identifiable. The main open product decision is one service per trip vs. per trip-client assignment.
