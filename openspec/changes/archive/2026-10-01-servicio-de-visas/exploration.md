## Exploration: Servicio de Visas

### Current State

TravelHub already has a complete, working pattern for a top-level service that is assigned to clients, has a status lifecycle, and supports both agent-uploaded and traveler-requested documents.

**Trips data model**

- `clients` → `trips` → `trip_days` → `items` → `documents` (`supabase/migrations/0001_init.sql`).
- Many-to-many client assignment lives in `trip_clients` (`supabase/migrations/0006_trip_clients.sql`); `trips.client_id` is kept as a compatibility mirror of the first assigned client.
- Tags and status history are modeled separately in `trip_tags` (`0007_trip_tags.sql`) and `trip_status_history` (`0024_trip_status_history.sql`).
- Global trip documents live in `trip_documents` (`0032_trip_documents.sql`) and reuse the private `trip-documents` storage bucket (`0002_storage_bucket.sql`).

**Data access pattern**

- `src/lib/data.ts` is only a facade; real logic lives in `src/lib/data/*`.
- `src/lib/data/trips.ts` exposes `getTrips`, `getTripsWithClients`, `getTripById`, `createTrip`, `updateTrip`, `setTripClients`, etc.
- Every function branches on `isSupabaseConfigured()` and falls back to `src/lib/mock-data.ts`.

**Status pattern**

- `TripStatus = "draft" | "published" | "archived"` (`src/types/index.ts`).
- `trip_status_history` is append-only.
- The list view (`/dashboard/trips/page.tsx` + `TripsExplorer.tsx`) supports bulk status changes and a board view (`TripBoardView.tsx`).

**Document upload / “request traveler upload” pattern**

There are three document mechanisms today:

1. **Item documents** – agent uploads files attached to an itinerary item (`documents` table + `uploadItemDocument` in `src/lib/data/documents.ts`).
2. **Global trip documents** – agent uploads files attached to the whole trip (`trip_documents` table + `uploadTripDocument`).
3. **Per-client service checklist** – the pattern closest to visa document requests:
   - Tables: `services`, `service_checklist_items`, `service_uploads` (`supabase/migrations/20260919000000_service_documents.sql`).
   - A `services` row is created per `(trip_id, client_id, service_type)`; `service_type` is currently only `"trip_documents"` (`src/types/index.ts`).
   - The agent defines required documents in `service_checklist_items`.
   - Travelers upload files via the client portal (`/client/trips/[id]/documents/page.tsx` + `actions.ts`) into `service_uploads`.
   - Upload statuses are `uploaded | reviewed | processed | re_upload_requested`; the agent can mark reviewed or request a re-upload (`ServiceChecklistManager.tsx`).
   - `ensureServiceForAssignment` is called whenever a client is assigned to a trip (`setTripClients` in `src/lib/data/trips.ts`).

**UI entry points for trips**

- List: `src/app/dashboard/trips/page.tsx` → `TripsExplorer.tsx`.
- Create: `src/app/dashboard/trips/new/page.tsx` → `NewTripForm.tsx` + `src/app/dashboard/trips/new/actions.ts`.
- Edit/detail: `src/app/dashboard/trips/[id]/page.tsx` + `src/app/dashboard/trips/[id]/actions.ts`.
- Feature toggle: `Feature` union and `FEATURE_DEFINITIONS` in `src/lib/auth/features.ts` plus `src/types/index.ts`.

### Affected Areas

- `src/types/index.ts` — add `Visa`, `VisaStatus`, `VisaFilters`, `VisaWithDetails`, `VisaStatusHistoryEntry`; extend `Feature` union with `"visas"`.
- `src/lib/auth/features.ts` — register the `visas` feature and its dashboard entry point.
- `src/lib/mock-data.ts` — add mock visas, `visa_clients`, `visa_status_history`, and possibly visa-service mocks.
- `supabase/migrations/` — new migration for `visas`, `visa_clients`, `visa_status_history`, and visa-specific document tables or a visa-facing reuse of `services`.
- `src/lib/data.ts` — re-export the new `src/lib/data/visas.ts` module.
- `src/lib/data/visas.ts` (new) — CRUD, client assignment, status history, list filters; mirrors `src/lib/data/trips.ts`.
- `src/lib/data/services.ts` — extend `ServiceType` to include a visa document type **or** add a parallel `visa_services`-style module if reuse is not clean.
- `src/app/dashboard/visas/page.tsx` (new) — list visas, mirroring `/dashboard/trips/page.tsx`.
- `src/app/dashboard/visas/new/page.tsx` + `actions.ts` (new) — create visa, mirroring `/dashboard/trips/new/`.
- `src/app/dashboard/visas/[id]/page.tsx` + `actions.ts` (new) — visa detail/edit page.
- `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` and `actions.ts` — either extract into a reusable component or duplicate/adapt for visa document checklists.
- `src/app/client/trips/[id]/documents/page.tsx` + `actions.ts` — client upload portal; may need `/client/visas/[id]/documents` if travelers upload visa documents directly.
- `src/lib/data/dashboard.ts` — recent activity and stats may need to include visas.
- `src/lib/mcp/tools/trips.ts` and related MCP tools — if MCP exposes visa data, new tools will be needed.

### Approaches

1. **Extend trips with a `trip_type` / category (“visa trip”)**
   - Pros:
     - Low schema churn; reuses existing trips list, create form, status history, client assignment, and document tables.
     - Existing `/dashboard/trips` UI, filters, and board view work almost out of the box.
   - Cons:
     - Visas are semantically different from trips: no day-by-day itinerary, dates are optional, destination is a country/consulate, and status values differ (e.g. `pending`, `documents_requested`, `submitted`, `approved`, `rejected`).
     - Would pollute the `trips` table and `Trip` type with nullable visa-specific fields.
     - Public `/t/{slug}` view is trip-centric and not appropriate for visa applications.
     - Mixing concerns makes future changes to either domain riskier.
   - Effort: Low–Medium.

2. **Create a new top-level `visas` domain that mirrors the trips pattern**
   - Pros:
     - Clean separation matching the issue wording (“un servicio nuevo que es de visas, muy similar a los viajes, pero específico”).
     - Own status lifecycle, filters, list/detail pages, and migrations.
     - Existing trips behavior is untouched.
     - Can reuse the proven service-checklist / traveler-upload pattern for visa documents.
   - Cons:
     - More files and migrations than extending trips.
     - Replicates CRUD/list boilerplate already present in trips.
   - Effort: Medium.

3. **Build visas on top of the existing `services` table**
   - Pros:
     - `services` already models per-client document checklists with upload statuses and re-upload requests.
   - Cons:
     - `services` is currently a child of `trips` (`trip_id` is NOT NULL); visas are top-level requests, so this would require decoupling services from trips or adding a nullable `visa_id`.
     - Would force visas to share semantics with a checklist model rather than a top-level service model.
     - Risk of complicating `services.ts` and its RLS/storage paths.
   - Effort: Medium–High.

### Recommendation

**Adopt Approach 2: a new `visas` top-level domain that mirrors the trips architecture but stays separate.**

Reasoning:

- The issue explicitly frames visas as a *new* service, not a variant of trips.
- Visas have their own properties (country, visa type, submission deadline, decision date) and status vocabulary that do not fit the `draft/published/archived` lifecycle of trips.
- Keeping the domain separate avoids polluting the trip public view (`/t/{slug}`), the client history page (`/c/{slug}`), and trip-specific dashboards.
- The service-checklist / `service_uploads` pattern from `services.ts` should be reused for the “request documents from traveler” flow, either by extending `ServiceType` to include a visa document type or by creating a small parallel `visa_services` layer. This gives the agent-upload vs. traveler-request behavior with minimal new code.

### Risks

- **Undefined visa status vocabulary** — the issue only says visas “tienen un estatus”; the exact statuses and transitions need product clarification before spec/design.
- **Client portal scope** — it is unclear whether travelers should see a visa list and upload documents through the existing client portal, or whether this remains dashboard-only.
- **Document ownership** — reusing `services` for visas introduces a second parent relationship; migrations and RLS must be careful not to leak trip documents into visa contexts or vice versa.
- **Feature flag rollout** — adding `"visas"` to `Feature` and `FEATURE_DEFINITIONS` requires updating account-profile mocks and tests; existing profiles will not have the flag until an admin toggles it.
- **Test surface** — because the pattern mirrors trips, it is easy to under-test the visa-specific edge cases (e.g. status history, client assignment diffing, document re-upload requests).

### Ready for Proposal

**Yes**, with the following clarifications needed from the product owner / issue author:

1. What is the exact visa status lifecycle? (e.g. `draft`, `pending_documents`, `submitted`, `approved`, `rejected`, `archived`)
2. Should travelers see their visa applications and upload documents through the client portal? If so, which URL path?
3. Are visa documents per-client (like the existing service checklist) or per-visa application?
4. Which visa-specific fields are required at creation? (country, visa type, number of entries, submission deadline, price, etc.)
