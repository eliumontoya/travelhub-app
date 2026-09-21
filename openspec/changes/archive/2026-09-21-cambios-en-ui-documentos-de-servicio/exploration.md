## Exploration: Service document UI changes

### Current State
TravelHub already has a per-traveler service-document model. Assigning a client to a trip creates one `services` row for that `(trip, client)`, each requirement is a separate `service_checklist_items` row owned by one service, and each item has at most one `service_uploads` row. The authenticated client portal at `/client/trips/[id]/documents` supports upload/re-upload and displays processed progress. The public itinerary `/t/[slug]` already reads the client session and renders the packing checklist in the right rail, but it has no service-document callout.

The dashboard trip page eagerly loads every service and full checklist, then `ServiceChecklistManager` renders every traveler, item, edit form, and review control inline. This creates the vertical-growth problem in issue #323. The existing progress helper counts only `processed` uploads and does not expose the number awaiting agent review. There is no bulk checklist-item operation; creating the same requirement for all travelers currently requires one action per service.

A lifecycle conflict also exists: travelers normally upload against published trips, while `markUploadProcessedAction` and `requestReUploadAction` call `assertTripEditable`, which rejects published trips. The component also hides review controls when `isEditable` is false. Therefore the current agent cannot complete the normal post-publication review flow.

### Affected Areas
- `src/app/t/[slug]/page.tsx` — add a session-aware document callout directly below the packing checklist, linking an assigned traveler to the existing upload route.
- `src/app/client/trips/[id]/documents/page.tsx` — existing destination for requirement status, upload, and re-upload; preserve its ownership checks and server-only storage access.
- `src/app/dashboard/trips/[id]/page.tsx` — replace the full inline checklist with compact per-traveler summaries and bind the new modal/bulk action.
- `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` — reshape into a compact summary surface plus one selected-traveler modal for assignment and review operations.
- `src/app/dashboard/trips/[id]/actions.ts` — add bulk assignment, separate service-document lifecycle authorization from itinerary edit locking, and revalidate both dashboard and client-facing routes.
- `src/lib/data/services.ts` — add trip-level summary data and an atomic multi-service checklist insert while preserving mock/Supabase parity.
- `src/lib/data.ts` — continue exposing new data operations through the project facade.
- `src/types/index.ts` — define a compact per-traveler document summary if the data layer returns a dedicated projection.
- `src/app/t/[slug]/__tests__/page.test.tsx` (or the route's existing test location) — cover authenticated assigned, authenticated unassigned, anonymous, and zero-requirement callout states.
- `src/app/dashboard/trips/[id]/actions.test.ts` and a new component test for `ServiceChecklistManager` — cover bulk assignment, published-trip review, summary counts, modal behavior, and overflow.
- `src/lib/data/__tests__/services.test.ts` — cover aggregate counts and all-or-nothing bulk creation in mock and configured-data abstractions.

### Approaches
1. **Compact summaries with preloaded detail** — Keep the current full `servicesWithChecklists` page load, derive counts in memory, and render only the selected traveler's items inside one native `<dialog>`.
   - Pros: Smallest change; reuses current types and actions; immediately fixes page height.
   - Cons: Still fetches every item, upload, signed URL, and sends that payload to the client even when the modal is never opened; scales visually but not in data cost.
   - Effort: Medium

2. **Summary-first dashboard with lazy modal detail** — Fetch a compact trip-level projection (`completed/total`, `awaitingReview`, and traveler identity), then load one service checklist when the agent opens the shared modal.
   - Pros: Solves both vertical growth and page payload/DOM growth; gives the issue's requested summary directly; keeps the modal focused on one traveler; aligns with the existing native-dialog pattern.
   - Cons: Requires a dedicated summary query/action, modal loading/error states, and more component tests.
   - Effort: Medium

3. **Separate documents dashboard route** — Replace inline management with summaries that navigate to a dedicated agent page rather than a modal.
   - Pros: Maximum room for complex workflows and deep links.
   - Cons: Contradicts the requested modal interaction, adds navigation, and fragments trip context without a demonstrated need.
   - Effort: High

### Recommendation
Use **summary-first dashboard with lazy modal detail**. Render one compact row/card per traveler with `processed/total` and an `awaiting agent review` count where only status `uploaded` contributes to review work; `re_upload_requested` is waiting on the traveler. A single native `<dialog>` should open from the `Documents` button, use a bounded viewport with internal scrolling, and contain the selected traveler's create/edit/reorder/review workflow. Preserve focus/escape behavior from existing dialog components and expose loading, empty, mutation-error, and long-list states.

On `/t/[slug]`, place a compact document callout immediately below `PackingListManager`. Because the public URL can represent multiple travelers and service tables are private, show a direct upload link only when the current client session belongs to an assigned service with at least one requirement. Do not reveal another traveler's requirements to anonymous or unassigned viewers. The existing `/client/trips/[id]/documents` route remains the upload destination and already redirects unauthenticated access through the client login flow.

For bulk creation, add one data-layer operation that validates the trip's service set, computes each service's next sort order, and inserts one independent checklist row per service in a single multi-row database statement. This matches the current ownership model, keeps later uploads/reviews isolated per traveler, and avoids partial success from a client-side loop. The modal should offer an explicit `assign to all travelers` control alongside single-traveler creation.

Separate service-document permissions from the itinerary edit lock. Checklist/review operations need authenticated agent authorization, but review must remain available after publication. The proposal should explicitly define whether checklist definition changes remain available for published trips (recommended for active service operations) and become read-only only when a trip is archived.

### Risks
- The public itinerary must not query or expose service-document existence for a different traveler; session-to-service ownership is the privacy boundary.
- Existing review actions are unusable for published trips, so a UI-only modal change would leave the core workflow broken.
- Bulk creation must be atomic; looping `addChecklistItem` can leave only some travelers assigned after a failure.
- Lazy modal data can become stale after a mutation; refresh the selected detail and compact summary together.
- Signed upload URLs should be generated only for the selected modal detail, not for all travelers in the summary query.
- The native `<dialog>` implementation needs explicit long-content scrolling, close synchronization, focus return, and accessible labels.
- Existing route/data tests cover client upload flows, but `ServiceChecklistManager` and dashboard review actions have little direct UI coverage.

### Ready for Proposal
Yes. The existing model and routes support the requested experience without a schema redesign. The proposal should codify the session-aware public callout, summary count semantics, lazy single-modal workflow, atomic bulk assignment, and the service-document lifecycle rule for published versus archived trips.
