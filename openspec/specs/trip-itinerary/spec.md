# Trip Itinerary Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Create, organize, enrich, publish, quote, template, and archive travel itineraries.

## Requirements

### Requirement: Trip creation and assignment

The system MUST let the agent create trips with title, date range, instructions, one or more clients, optional new client creation, optional template source, traveler count, status, currency, and tags.

#### Scenario: Create trip for existing clients

- GIVEN one or more clients exist
- WHEN the agent creates a trip with title, dates, and selected clients
- THEN the system MUST create the trip and redirect to its editor

#### Scenario: Block trip without clients

- GIVEN the agent submits a new trip without any selected client
- WHEN the request is processed
- THEN the system MUST reject it with a validation error

### Requirement: Day and item itinerary editing

The system MUST let the agent add, edit, soft-delete, restore, and reorder trip days and itinerary items; supported item types are flight, hotel, activity, restaurant, transport, and note.

#### Scenario: Generate missing days

- GIVEN a trip has a start and end date but not every date exists as a day
- WHEN the agent runs day generation
- THEN the system MUST create only the missing days in date order

#### Scenario: Validate structured item metadata

- GIVEN the agent submits metadata for a typed item
- WHEN required metadata fields for that type are missing
- THEN the system MUST reject invalid metadata instead of persisting it

### Requirement: Item duplication within a trip

The system MUST let the agent duplicate an itinerary item into any day of the same trip. The duplicate copies all scalar fields and metadata; documents MUST NOT be copied. The new item is appended at the end of the destination day's sort order.

#### Scenario: Duplicate item to a different day

- GIVEN item A on day 1
- WHEN the agent duplicates A and selects day 3
- THEN a new item equal to A is created on day 3
- AND day 1 still contains the original A

#### Scenario: Duplicate item to the same day

- GIVEN item A on day 1
- WHEN the agent duplicates A and selects day 1
- THEN a second copy of A exists on day 1 (original preserved)

#### Scenario: No documents in duplicate

- GIVEN item A has a document attached
- WHEN A is duplicated
- THEN the new item has no documents

### Requirement: Agent-only itinerary enrichment

The system MUST support internal notes, documents, photo gallery, packing list, budget, sale price, commission, per-item costs, supplier references, maps, weather, and flight-status enrichment.

#### Scenario: Keep internal notes private

- GIVEN an itinerary contains internal notes, sale price, and commission
- WHEN the public trip page is rendered
- THEN those agent-only fields MUST NOT be included in the public traveler view

#### Scenario: Attach trip materials

- GIVEN the agent uploads item documents, client documents, or trip photos
- WHEN storage is configured
- THEN the system MUST persist the attachment metadata and make it available in the relevant editor view

### Requirement: Trip lifecycle and reuse

The system MUST support draft, published, and archived status transitions, status history, save-as-template, duplicate-from-template, and quote printing.

#### Scenario: Publish an itinerary

- GIVEN a draft trip has a public slug
- WHEN the agent publishes it
- THEN public access by `/t/{slug}` MUST become available

#### Scenario: Reuse a template

- GIVEN a template trip exists
- WHEN the agent creates a new trip from that template
- THEN the new trip MUST copy template days and items without copying documents

### Requirement: Move item to a different day

The system SHALL provide a way to reassign an existing itinerary item to another day of the same trip without deleting and recreating it. The move preserves all item fields (title, type, times, location, cost, notes, metadata, supplier, documents linkage) and appends the item at the end of the destination day's sort order.

#### Scenario: Move item to another day

- GIVEN a trip with day A and day B, each containing at least one item
- WHEN the agent reassigns an item from day A to day B
- THEN the item is removed from day A's list
- AND the item appears at the end of day B's list
- AND the item's title, type, times, location, cost, notes, metadata and supplier are unchanged

#### Scenario: Reassigned item reflected in public view

- GIVEN an item reassigned from day A to day B in the dashboard
- WHEN the public view `/t/[slug]` is rendered
- THEN the item is shown under day B, not day A

### Requirement: Destination day selection

The UI SHALL present a list of the trip's days (excluding the item's current day) so the agent can pick the destination day.

#### Scenario: Current day excluded from choices

- GIVEN an item currently on day A
- WHEN the agent opens the move-to-day control
- THEN day A is not offered as a destination

### Requirement: Move item dual-mode support

The move-item-to-day reassignment SHALL work identically in mock mode (no Supabase configured) and Supabase mode.

#### Scenario: Move item in mock mode

- GIVEN the app running without Supabase env vars
- WHEN the agent reassigns an item to another day
- THEN the change persists for the session and renders correctly

### Requirement: Global trip documents — data model

A `trip_documents` table exists with `id`, `trip_id` (FK `trips.id` on delete cascade), `file_path`, `filename`, `mime_type`, `created_at`. Indexed by `trip_id`. RLS: owner (authenticated) has full access; anon/public can SELECT only when the parent trip `status = 'published'`.

#### Scenario: Trip documents table structure

- GIVEN a Supabase database with the `trip_documents` table
- WHEN the schema is inspected
- THEN the table MUST contain columns `id`, `trip_id`, `file_path`, `filename`, `mime_type`, `created_at`
- AND an index MUST exist on `trip_id`
- AND RLS MUST be enabled with owner all-access and public read-when-published policies

### Requirement: Global trip documents — upload (agent)

From the trip editor (`/dashboard/trips/[id]`) the agent can upload one or more global documents. A `TripDocument` type and `uploadTripDocument` / `getTripDocuments` / `deleteTripDocument` data functions exist, mirroring `uploadItemDocument` etc. In mock mode (Supabase unconfigured) upload is disabled with a graceful "Configura Supabase" message.

#### Scenario: Agent uploads a global document

- GIVEN a configured Supabase trip editor
- WHEN the agent uploads `seguro.pdf`
- THEN `trip_documents` has a row for that trip and the file is in the `trip-documents` bucket under `trips/{tripId}/`

#### Scenario: Mock mode degrades gracefully for upload

- GIVEN Supabase is not configured
- WHEN the agent opens the trip editor
- THEN the upload control shows "Configura Supabase para subir documentos." and no upload is attempted

### Requirement: Global trip documents — manage (agent)

The agent can list and delete global documents from the trip editor. Deleting removes both the Storage object and the row.

#### Scenario: Agent deletes a global document

- GIVEN an existing global document
- WHEN the agent deletes it
- THEN the row and the Storage object are removed

### Requirement: Global trip documents — public view (client)

When the trip is published, global documents appear in `/t/[slug]` under a "Documentos del viaje" section, each as a signed-URL link. They are surfaced via `TripWithDetails.documents`.

#### Scenario: Client sees global documents

- GIVEN a published trip with global documents
- WHEN the client opens `/t/[slug]`
- THEN a "Documentos del viaje" section lists each document as a download link

#### Scenario: Unauthenticated read scoped to published trips

- AN unauthenticated user cannot read `trip_documents` rows whose trip is not `published` (enforced by RLS)

### Requirement: Sanitized note storage

The data layer MUST store note text as HTML sanitized through a single server-side `sanitizeNote` helper before persisting `trip_days.notes`, `items.notes`, and `trips.internal_notes`.

#### Scenario: Script tags are stripped on write

- GIVEN an agent submits a note containing `<script>alert(1)</script>`
- WHEN the value is persisted through `src/lib/data.ts`
- THEN the stored value MUST NOT contain a `<script>` tag

#### Scenario: Allowed formatting is preserved

- GIVEN an agent submits `<p>Texto <strong>clave</strong></p><ul><li>a</li></ul>`
- WHEN the value is persisted
- THEN the stored value MUST retain `<strong>` and the `<ul>/<li>` list

### Requirement: Safe note rendering

The system MUST render note HTML through a `NoteHtml` component that
re-sanitizes before output, so untrusted or legacy content cannot inject
scripts, event handlers, or `javascript:` URLs into the DOM.

#### Scenario: XSS payload is neutralized on render

- GIVEN a stored note `<img src=x onerror=alert(1)><a href="javascript:evil()">x</a>`
- WHEN it is rendered via `NoteHtml`
- THEN the output MUST NOT contain `onerror` and MUST NOT contain `javascript:`

#### Scenario: Links open safely

- GIVEN a rendered note contains an `<a href="https://ok.com">`
- WHEN it is displayed
- THEN the anchor MUST include `target="_blank"` and `rel="noopener noreferrer"`

### Requirement: Rich text editor for itinerary notes

The note input controls for trip days and items MUST use a `RichTextEditor` supporting bold, italic,
underline, unordered/ordered lists, and links, submitting sanitized HTML via a
form field named `notes`.

#### Scenario: Toolbar produces HTML

- GIVEN the agent selects text and clicks "Negrita"
- WHEN the form is submitted
- THEN `formData.get("notes")` MUST contain `<strong>` markup for that text

### Requirement: Public traveler view

The public trip view (`/t/[slug]`) MUST render `items.notes` as enriched HTML
through `NoteHtml`.

#### Scenario: Public item note shows formatting

- GIVEN a published trip item has notes `<em>recordatorio</em>`
- WHEN a traveler opens the public URL
- THEN the note is displayed with italic emphasis and without raw HTML tags

### Requirement: Trip instructions stored as sanitized HTML

The trip `instructions` value MUST be sanitized with `sanitizeNote` before being
persisted, in both `createTrip` and `updateTrip`, for the mock and Supabase data
paths. Empty or whitespace-only input MUST be stored as `null`/undefined.

#### Scenario: Write from rich editor

- GIVEN a user edits trip instructions with bold text and a link via `RichTextEditor`
- WHEN the form is submitted
- THEN `updateTripInstructionsAction` persists the `sanitizeNote`-sanitized HTML

#### Scenario: Script injection is stripped

- GIVEN instructions input containing `<script>alert(1)</script>`
- WHEN saved and rendered
- THEN no script executes and the stored value contains no disallowed tags

### Requirement: Trip instructions edited with rich editor

The `TripInstructionsDialog` and `NewTripForm` "Instrucciones" fields MUST use
`RichTextEditor` instead of a plain `<textarea>`.

### Requirement: Trip instructions rendered as HTML in public view

The public trip view (`/t/[slug]`) MUST render `trip.instructions` via `NoteHtml`
(rich HTML) instead of a plain `<p>`.
