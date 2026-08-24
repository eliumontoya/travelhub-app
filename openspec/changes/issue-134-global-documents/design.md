# Design: Global trip documents (issue #134)

## Storage & schema

- Reuse the existing private Storage bucket `trip-documents` (no new bucket).
  Object path: `trips/{tripId}/{timestamp}-{filename}` — distinct prefix from
  item docs (`{itemId}/...`) and client docs (`clients/{clientId}/...`).
- New table `trip_documents` (migration `0031_trip_documents.sql`):
  - columns mirror `client_documents` (id uuid, trip_id fk cascade, file_path,
    filename, mime_type, created_at).
  - RLS identical shape to `documents` public-read policy but joined via
    `trip_documents.trip_id -> trips.status = 'published'`. Owner all-access.
  - `revoke all ... from anon/authenticated; grant select,insert,update,delete
    to authenticated; grant select to anon;` — same as `documents`.

## Data layer (`src/lib/data.ts`)

Add, next to the existing documents block:
- `rowToTripDocument(row): TripDocument`
- `uploadTripDocument(tripId, file): Promise<TripDocument>` — throws if
  Supabase unconfigured (matches `uploadItemDocument`).
- `getTripDocuments(tripId): Promise<(TripDocument & { url: string | null })[]>`
  — returns `[]` when unconfigured (matches `getClientDocuments`).
- `deleteTripDocument(id): Promise<void>` — removes Storage object + row.

## Types (`src/types/index.ts`)

- `TripDocument` interface (id, tripId, filePath, filename, mimeType?, createdAt).
- Extend `TripWithDetails` with `documents: (TripDocument & { url: string | null })[]`.

## Server actions (`src/app/dashboard/trips/[id]/actions.ts`)

- `uploadTripDocumentAction(tripId, slug, formData)` — revalidates editor + `/t/[slug]`.
- `deleteTripDocumentAction(tripId, slug, documentId)` — same revalidation.
- `getTripDocumentsAction(tripId)` — read for the client component.

## UI

- New `src/components/TripDocuments.tsx` (client) — modelled on `ClientDocuments`
  but with title "Documentos del viaje" and an optional refresh via
  `onRefresh`/`getTripDocumentsAction`. Receives `documents`, `documentsEnabled`,
  `onUpload`, `onDelete`, `onRefresh`.
- Dashboard editor: render `<TripDocuments>` right after `<TripPhotoGallery>`.
- Public view: fetch `trip.documents`, render "Documentos del viaje" section
  (after the photos block) listing signed-URL links.

## Assemble (`assembleTripWithDetails`)

After photos, query `trip_documents` for the trip, attach signed URLs, and
include in the returned `TripWithDetails`. Mock `getTripWithDetails` returns
`documents: []` (no mock seed needed; consistent with graceful empty state).

## Verification

- `npx tsc --noEmit` and `npm run build` must pass.
- `npm test` (vitest) suite must remain green.
