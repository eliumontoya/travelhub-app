# Spec: Global trip documents (issue #134)

## Requirements

### REQ-1: Data model
A `trip_documents` table exists with `id`, `trip_id` (FK `trips.id` on delete
cascade), `file_path`, `filename`, `mime_type`, `created_at`. Indexed by
`trip_id`. RLS: owner (authenticated) has full access; anon/public can SELECT
only when the parent trip `status = 'published'`.

### REQ-2: Upload (agent)
From the trip editor (`/dashboard/trips/[id]`) the agent can upload one or more
global documents. A `TripDocument` type and `uploadTripDocument` /
`getTripDocuments` / `deleteTripDocument` data functions exist, mirroring
`uploadItemDocument` etc. In mock mode (Supabase unconfigured) upload is
disabled with a graceful "Configura Supabase" message.

### REQ-3: Manage (agent)
The agent can list and delete global documents from the trip editor. Deleting
removes both the Storage object and the row.

### REQ-4: Public view (client)
When the trip is published, global documents appear in `/t/[slug]` under a
"Documentos del viaje" section, each as a signed-URL link. They are surfaced via
`TripWithDetails.documents`.

## Acceptance scenarios

- **Scenario: agent uploads a global document**
  Given a configured Supabase trip editor, when the agent uploads `seguro.pdf`,
  then `trip_documents` has a row for that trip and the file is in the
  `trip-documents` bucket under `trips/{tripId}/`.

- **Scenario: agent deletes a global document**
  Given an existing global document, when the agent deletes it, then the row and
  the Storage object are removed.

- **Scenario: client sees global documents**
  Given a published trip with global documents, when the client opens
  `/t/[slug]`, then a "Documentos del viaje" section lists each document as a
  download link.

- **Scenario: mock mode degrades gracefully**
  Given Supabase is not configured, when the agent opens the trip editor, then
  the upload control shows "Configura Supabase para subir documentos." and no
  upload is attempted.

- **Scenario: unauthenticated read is scoped to published trips**
  An unauthenticated user cannot read `trip_documents` rows whose trip is not
  `published` (enforced by RLS).
