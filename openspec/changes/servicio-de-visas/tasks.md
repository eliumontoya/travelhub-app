# Tasks: Servicio de Visas

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~2,700 (range 2,500–2,900) |
| 400-line budget risk | High |
| 800-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 → PR 5 → PR 6 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Est. changed lines | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|-------------------|----------------------|-----------------|-------------------|
| 1 | Schema, types, and feature gating foundation | PR 1 (base: feature/tracker) | ~155 | `npx tsc --noEmit` | N/A — no runtime behavior; types and migration are compile-time and DB-schema only | Remove migration file, revert `src/types/index.ts` visa types + Feature union change, revert `src/lib/auth/features.ts` visas entries, revert nav item |
| 2 | Visa management data layer with full test suite | PR 2 (base: PR 1 branch) | ~670 | `npx vitest run src/lib/data/__tests__/visas.test.ts` | `npx vitest run src/lib/data/__tests__/visas.test.ts` — exercises mock-mode CRUD, client assignment diffing, and status lifecycle | Remove `src/lib/data/visas.ts`, revert `src/lib/mock-data.ts` visa additions, revert `src/lib/data.ts` visa re-export |
| 3 | Visa documents data layer with full test suite | PR 3 (base: PR 2 branch) | ~560 | `npx vitest run src/lib/data/__tests__/visa-documents.test.ts` | `npx vitest run src/lib/data/__tests__/visa-documents.test.ts` — exercises upload, request, review, re-upload compensation, and ownership guard | Remove `src/lib/data/visa-documents.ts`, revert `src/lib/mock-data.ts` visa-document additions, revert `src/lib/data.ts` visa-documents re-export |
| 4 | Cross-domain contract tests and dashboard list + create | PR 4 (base: PR 3 branch) | ~595 | `npx vitest run src/lib/__tests__/visa-domain-contracts.test.ts` | `npx tsc --noEmit && npx vitest run src/lib/__tests__/visa-domain-contracts.test.ts` — verifies facade exports and isolation | Remove `src/app/dashboard/visas/page.tsx`, `VisaExplorer.tsx`, `new/page.tsx`, `new/actions.ts`, `src/lib/__tests__/visa-domain-contracts.test.ts`; revert `src/lib/data.ts` contract re-exports |
| 5 | Dashboard visa detail/edit page with actions | PR 5 (base: PR 4 branch) | ~420 | `npx vitest run src/app/dashboard/visas/\\[id\\]/__tests__/actions.test.ts` | `npx vitest run src/app/dashboard/visas/\\[id\\]/__tests__/actions.test.ts` — verifies auth guards, field edit, client management, status transitions | Remove `src/app/dashboard/visas/[id]/page.tsx`, `actions.ts`, and `__tests__/actions.test.ts` |
| 6 | Client portal, client-home summary, and action tests | PR 6 (base: PR 5 branch) | ~405 | `npm run test` | `npm run test && npx playwright test` (when e2e available) | Remove `src/app/client/visas/`, revert `src/app/client/page.tsx` visa section, remove dashboard action tests |

### Chain Strategy Notes

- **PR #1** base = feature/tracker branch; **PR #2–#6** each base = immediate previous PR branch.
- Only the feature/tracker branch merges to main after all PRs are reviewed and approved.
- If a child PR diff shows previous PR changes, rebase/retarget until the diff is clean.
- Each PR is independently verifiable via its focused test command.

---

## Phase 1: Schema, Types, and Feature Gating Foundation

- [x] 1.1 Add `"visas"` to the `Feature` union in `src/types/index.ts` (line ~21, after `"settings"`).

- [x] 1.2 Add visa domain types to `src/types/index.ts`: `VisaStatus` (`"pending" | "in_progress" | "completed"`), `Visa` interface (id, clientId, country, visaType, deadline, price, notes?, status, createdAt, updatedAt), `VisaFilters` (query?, status?, clientIds?, country?), `VisaStatusHistoryEntry` (id, visaId, fromStatus, toStatus, changedAt), `VisaDocumentStatus` (`"requested" | "uploaded" | "reviewed" | "processed" | "re_upload_requested"`), `VisaDocument` interface (id, visaId, targetClientId, description?, filePath, filename?, mimeType?, status, agentComment?, uploadedAt?, createdAt, updatedAt), `VisaWithDetails` extends Visa (clients, client, statusHistory, documents).

- [x] 1.3 Add `"visas"` to `AVAILABLE_FEATURES` array in `src/lib/auth/features.ts` (after `"settings"`).

- [x] 1.4 Add `{ feature: "visas", href: "/dashboard/visas", label: "Visas" }` to `FEATURE_DEFINITIONS` array in `src/lib/auth/features.ts`.

- [x] 1.5 Add `{ href: "/dashboard/visas", label: "Visas", icon: "▦" }` to `navItems` array in `src/components/DashboardSidebarNav.tsx` (after the Viajes entry, before Clientes).

- [x] 1.6 Create Supabase migration `supabase/migrations/20260930000000_visas.sql` with: `visas` table (id uuid PK, client_id uuid FK nullable, country text NOT NULL, visa_type text NOT NULL, deadline date NOT NULL, price numeric(12,2) NOT NULL, notes text, status text NOT NULL DEFAULT 'pending' CHECK, created_at/updated_at timestamptz), `visa_clients` table (visa_id + client_id PK, created_at, FK cascade, index on client_id), `visa_status_history` table (id uuid PK, visa_id FK cascade, from_status text, to_status text NOT NULL, changed_at, index on visa_id), `visa_documents` table (id uuid PK, visa_id FK cascade, target_client_id FK, description text, file_path text, filename text, mime_type text, status text DEFAULT 'uploaded' CHECK, agent_comment text, uploaded_at timestamptz, created_at/updated_at, indexes on visa_id and target_client_id). Include RLS policies following the mono-user authenticated pattern (`auth.uid() IS NOT NULL`, no `anon` grants). Create private `visa-documents` storage bucket (`public = false`). Add `storage.objects` policy for `bucket_id = 'visa-documents'`. Add backfill: `INSERT INTO visa_clients (visa_id, client_id) SELECT id, client_id FROM visas WHERE client_id IS NOT NULL ON CONFLICT DO NOTHING`.

- [x] 1.7 Verify: `npx tsc --noEmit` passes with the new types and feature catalog additions.

## Phase 2: Visa Management Data Layer (TDD)

- [x] 2.1 Add `mockVisas` (array of `Visa`), `mockVisaClients` (record mapping visaId → `{clientId, createdAt}[]`), and `mockVisaStatusHistory` (array of `VisaStatusHistoryEntry`) seed data to `src/lib/mock-data.ts` with at least 2 sample visas in different statuses, their client assignments, and status history entries.

- [x] 2.2 Create `src/lib/data/__tests__/visas.test.ts` with RED tests for `createVisa`: test that missing `country`/`visaType`/`deadline`/`price` each throw; test that valid input creates a visa with status `pending`; test that creation appends a `{from:null, to:'pending'}` status history entry; test that `clientIds` are stored when provided; test that empty `clientIds` is accepted. Run tests — confirm they fail (module `@/lib/data/visas` does not exist yet).

- [x] 2.3 Create `src/lib/data/visas.ts` with `rowToVisa(row)` and `rowToVisaStatusHistory(row)` mapper functions. Implement `createVisa(input: CreateVisaInput): Promise<Visa>` with dual-mode branching: mock mode generates a UUID, sets status to `pending`, pushes to `mockVisas`, mirrors `clientIds[0]` into `clientId` (or `""`), pushes `{from:null, to:'pending'}` to `mockVisaStatusHistory`, and stores client assignments in `mockVisaClients`; Supabase mode inserts into `visas` table, optionally inserts first `visa_clients` row, and inserts the initial status history row. Run tests — confirm they pass.

- [x] 2.4 Add RED tests to `src/lib/data/__tests__/visas.test.ts` for read operations: `getVisaById` returns visa with clients and status history; returns `null` for non-existent id; `getVisasWithClients` returns paginated list with client arrays; `getVisasByClientId` returns only visas assigned to that client. Run — confirm new tests fail.

- [x] 2.5 Implement `getVisaById(id: string): Promise<VisaWithDetails | null>` in `src/lib/data/visas.ts` — mock mode composes from `mockVisas` + `mockVisaClients` + `mockVisaStatusHistory` + mock clients; Supabase mode queries `visas` with a nested `visa_clients → clients` select, `visa_status_history` ordered by `changed_at`, and `visa_documents`. Return `null` when not found.

- [x] 2.6 Implement `getVisasWithClients(params)` in `src/lib/data/visas.ts` — supports `PaginationParams` and optional `VisaFilters` (status, clientIds, country, query text). Mock mode filters `mockVisas` in-memory; Supabase mode builds query with `.in("status", ...)`, `.in("visa_clients.client_id", ...)`, `.eq("country", ...)`, and `.ilike("country", ...)` for text search. Returns `PaginatedResult<Visa & { clients: Client[] }>`.

- [x] 2.7 Implement `getVisasByClientId(clientId: string): Promise<Visa[]>` in `src/lib/data/visas.ts` — mock mode filters by `mockVisaClients`; Supabase mode queries `visa_clients` then fetches matching `visas`. Run all read tests — confirm they pass.

- [x] 2.8 Add RED tests to `src/lib/data/__tests__/visas.test.ts` for `updateVisa`: test that mutable fields (country, visaType, deadline, price, notes) are updated; test that status remains unchanged after update; test that assigned clients are preserved after update. Run — confirm new tests fail.

- [x] 2.9 Implement `updateVisa(id: string, input: UpdateVisaInput): Promise<Visa>` in `src/lib/data/visas.ts`. `UpdateVisaInput` type explicitly excludes `status`. Mock mode patches `mockVisas` entry; Supabase mode updates `visas` row. Verify clients unchanged. Run tests — confirm they pass.

- [x] 2.10 Add RED tests to `src/lib/data/__tests__/visas.test.ts` for `setVisaClients`: test assigning new client produces union `{C1, C2}`; test re-assigning same client is idempotent; test assigning multiple clients at once; test unassigning a client removes only that client; test unassigning a non-assigned client is a no-op; test unassigning all clients leaves zero assignments; test retained rows keep their `created_at`; test `visas.client_id` mirror equals `clientIds[0]` or is cleared when empty. Run — confirm new tests fail.

- [x] 2.11 Implement `setVisaClients(visaId: string, clientIds: string[]): Promise<void>` in `src/lib/data/visas.ts` — compute diff (toRemove = current minus new, toAdd = new minus current); mock mode mutates `mockVisaClients` preserving `created_at` for retained, removes dropped, adds new with `now()`; Supabase mode deletes removed rows and upserts added rows. Update `visas.client_id` mirror = `clientIds[0]` or `null`. Run tests — confirm they pass.

- [x] 2.12 Add RED tests to `src/lib/data/__tests__/visas.test.ts` for `transitionVisaStatus`: test `pending → in_progress` succeeds and appends history; test `in_progress → completed` succeeds and appends history; test backward `in_progress → pending` throws with no status change and no history row; test skip `pending → completed` throws; test any transition from `completed` throws. Run — confirm new tests fail.

- [x] 2.13 Implement `transitionVisaStatus(visaId: string, toStatus: VisaStatus): Promise<VisaStatusHistoryEntry>` and `getVisaStatusHistory(visaId: string): Promise<VisaStatusHistoryEntry[]>` in `src/lib/data/visas.ts`. Define `VISA_TRANSITIONS: Record<VisaStatus, VisaStatus[]>` map (`pending → [in_progress]`, `in_progress → [completed]`, `completed → []`). Look up current status; reject if `toStatus` not in allowed list (throw, no write). On success: update `visas.status` and append history row with `{fromStatus, toStatus, changedAt}`. Mock mode updates `mockVisas` and pushes to `mockVisaStatusHistory`; Supabase mode updates `visas` row and inserts into `visa_status_history`. Run tests — confirm they pass.

- [x] 2.14 Add `export * from "@/lib/data/visas"` to `src/lib/data.ts` facade. Run `npx vitest run src/lib/data/__tests__/visas.test.ts` — confirm all visa management tests pass. Run `npx tsc --noEmit` — confirm no type errors.

## Phase 3: Visa Documents Data Layer (TDD)

- [x] 3.1 Add `mockVisaDocuments` (array of `VisaDocument`) seed data to `src/lib/mock-data.ts` with at least 2 sample documents in different statuses (one `uploaded` agent-uploaded with `targetClientId: null`, one `requested` targeting a specific client).

- [x] 3.2 Create `src/lib/data/__tests__/visa-documents.test.ts` with RED tests for `uploadVisaDocument`: test that uploading to a valid visa creates a document with status `uploaded`, `targetClientId: null`, and correct `filePath` under `visas/{visaId}/`; test that uploading to a non-existent visa throws. Run — confirm tests fail (module does not exist).

- [x] 3.3 Create `src/lib/data/visa-documents.ts` with `VISA_DOCUMENTS_BUCKET = "visa-documents"` constant, `rowToVisaDocument(row)` mapper, and `uploadVisaDocument(visaId: string, file: File): Promise<VisaDocument>`. Mock mode: verify visa exists in `mockVisas`, generate UUID, push to `mockVisaDocuments` with status `uploaded` and `targetClientId: null`. Supabase mode: verify visa exists, upload file to `storage.from("visa-documents").upload("visas/{visaId}/{uuid}-{filename}")`, insert `visa_documents` row. Run tests — confirm they pass.

- [x] 3.4 Add RED tests for `requestVisaDocument`: test that requesting for an assigned client creates a document with status `requested`, `targetClientId` set, and `filePath: null`; test that requesting for a non-assigned client throws. Run — confirm fail.

- [x] 3.5 Implement `requestVisaDocument(visaId: string, clientId: string, description: string): Promise<VisaDocument>` in `src/lib/data/visa-documents.ts`. Verify `clientId` is in the visa's assigned clients (query `visa_clients` / check `mockVisaClients`). If not assigned, throw. Mock mode: push to `mockVisaDocuments` with status `requested`. Supabase mode: insert `visa_documents` row. Run tests — confirm they pass.

- [x] 3.6 Add RED tests for `getVisaDocuments`: test listing returns all documents for a visa with signed URLs; test empty list for a visa with no documents. Add RED tests for `uploadVisaDocumentForRequest`: test traveler upload transitions `requested → uploaded` and sets `filePath`; test re-upload transitions `re_upload_requested → uploaded` and removes old file; test non-assigned traveler throws. Run — confirm fail.

- [x] 3.7 Implement `getVisaDocuments(visaId: string)` in `src/lib/data/visa-documents.ts` — returns documents with `url` from `getSignedVisaDocumentUrl` (or `null` when no `filePath`). Implement `uploadVisaDocumentForRequest(documentId: string, clientId: string, file: File): Promise<VisaDocument>` — verify `document.targetClientId === clientId` (throw if mismatch), upload new file, update row (file_path, filename, mime_type, status `uploaded`, uploaded_at), remove old storage object if previous `filePath` existed (compensation: on persistence error, remove newly uploaded object; if cleanup also fails, throw `AggregateError`). Run tests — confirm they pass.

- [x] 3.8 Add RED tests for agent review operations: test `markVisaDocumentReviewed` transitions `uploaded → reviewed`; test `markVisaDocumentProcessed` transitions `reviewed → processed`; test `requestVisaDocumentReUpload` transitions `uploaded → re_upload_requested` with comment stored; test invalid transitions throw. Run — confirm fail.

- [x] 3.9 Implement `markVisaDocumentReviewed(id: string): Promise<void>`, `markVisaDocumentProcessed(id: string): Promise<void>`, and `requestVisaDocumentReUpload(id: string, comment: string): Promise<void>` in `src/lib/data/visa-documents.ts`. Each uses `assertVisaDocumentMutable` to verify the document belongs to the expected visa. Enforce valid status transitions: `reviewed` requires `uploaded`, `processed` requires `reviewed`, `re_upload_requested` requires `uploaded`. Implement `assertVisaDocumentMutable(documentId: string, visaId: string): Promise<void>` — look up document; if `visaId` doesn't match, throw generic "not found" (no probing). Implement `getSignedVisaDocumentUrl(path: string): Promise<string | null>` — create signed URL via Supabase storage, never return public URL. Run tests — confirm they pass.

- [x] 3.10 Add `export * from "@/lib/data/visa-documents"` to `src/lib/data.ts` facade. Run `npx vitest run src/lib/data/__tests__/visa-documents.test.ts` — confirm all visa document tests pass. Run `npx tsc --noEmit` — confirm no type errors.

## Phase 4: Cross-Domain Contracts and Dashboard Visa List + Create

- [x] 4.1 Create `src/lib/__tests__/visa-domain-contracts.test.ts` with RED tests for facade exports: test that `createVisa`, `getVisaById`, `getVisasWithClients`, `getVisasByClientId`, `updateVisa`, `setVisaClients`, `transitionVisaStatus`, `getVisaStatusHistory`, `uploadVisaDocument`, `requestVisaDocument`, `uploadVisaDocumentForRequest`, `markVisaDocumentReviewed`, `markVisaDocumentProcessed`, `requestVisaDocumentReUpload`, `getVisaDocuments`, `getSignedVisaDocumentUrl`, and `assertVisaDocumentMutable` are all importable from `@/lib/data`. Run — confirm fail (re-exports may be missing).

- [x] 4.2 Add cross-domain isolation tests to `src/lib/__tests__/visa-domain-contracts.test.ts`: using a fake Supabase client that records every `.from()` and `storage.from()` call, verify that visa and visa-document operations never query `trips`, `trip_clients`, `trip_status_history`, `trip_documents`, `services`, `service_checklist_items`, or `service_uploads`, and never call `storage.from("trip-documents")`. Verify all storage paths use the `visa-documents` bucket. Run — confirm fail.

- [x] 4.3 Add dual-mode parity test to `src/lib/__tests__/visa-domain-contracts.test.ts`: run a create → read → transition → read sequence in mock mode and assert the results are equivalent (same visa fields, same clients, same status history length). Run — confirm pass (mock mode should work from Phase 2–3).

- [x] 4.4 Create `src/app/dashboard/visas/page.tsx` — server page with `requireFeature("visas")` guard at top. Parse search params for filters (status, client, country, query, page). Call `getVisasWithClients` and `getClients` (for filter dropdowns) from `@/lib/data`. Render `VisasExplorer` client component with results, clients list, pagination, and initial filters. Follow the pattern from `src/app/dashboard/trips/page.tsx`.

- [x] 4.5 Create `src/app/dashboard/visas/VisasExplorer.tsx` — `"use client"` component. Display visa list with: status badge (pending/in_progress/completed with distinct colors), country, visa type, deadline, price, assigned client chips. Include filter controls: status multi-select, client select, country text input, search query. Include "Nueva Visa" link to `/dashboard/visas/new`. Follow the pattern from `TripsExplorer`.

- [x] 4.6 Create `src/app/dashboard/visas/new/page.tsx` — server page with `requireFeature("visas")` guard. Render a form with fields: country (text), visaType (text), deadline (date), price (number), notes (textarea), and client multi-select (fetch clients from `getClients`). Follow the pattern from `src/app/dashboard/trips/new/page.tsx`.

- [x] 4.7 Create `src/app/dashboard/visas/new/actions.ts` — `createVisaAction(formData: FormData)` server action with `requireRole("agent")` + `requireFeature("visas")` guards. Validate required fields (country, visaType, deadline, price) are present and non-empty. Call `createVisa({ country, visaType, deadline, price, notes, clientIds })`. On success, `redirect("/dashboard/visas/{id}")`. On validation error, return error state.

- [x] 4.8 Verify: `npx tsc --noEmit` passes. `npx vitest run src/lib/__tests__/visa-domain-contracts.test.ts` passes. Manual check: visa list page renders with mock data, create form submits and redirects.

## Phase 5: Dashboard Visa Detail and Edit Page

- [x] 5.1 Create `src/app/dashboard/visas/[id]/actions.ts` with server actions: `updateVisaAction(id, formData)` — validates mutable fields, calls `updateVisa`, returns updated visa or error; `setVisaClientsAction(id, clientIds)` — calls `setVisaClients`; `transitionVisaStatusAction(id, toStatus)` — validates `toStatus` is a valid `VisaStatus`, calls `transitionVisaStatus`. All actions include `requireRole("agent")` + `requireFeature("visas")` guards. Add document actions: `uploadVisaDocumentAction(visaId, file)` calls `uploadVisaDocument`; `requestVisaDocumentAction(visaId, clientId, description)` calls `requestVisaDocument`; `markVisaDocumentReviewedAction(id)` calls `markVisaDocumentReviewed`; `markVisaDocumentProcessedAction(id)` calls `markVisaDocumentProcessed`; `requestVisaDocumentReUploadAction(id, comment)` calls `requestVisaDocumentReUpload`.

- [x] 5.2 Create `src/app/dashboard/visas/[id]/page.tsx` — server page with `requireFeature("visas")` guard. Call `getVisaById(params.id)` — return not-found if null. Render sections: (1) editable fields (country, visaType, deadline, price, notes) with save button calling `updateVisaAction`; (2) client management — current clients displayed as chips with remove button, add-client select + button calling `setVisaClientsAction`; (3) status section — current status badge, transition button for the next allowed status (based on `VISA_TRANSITIONS`) calling `transitionVisaStatusAction`, disabled when `completed`; (4) status history timeline — chronological list of `VisaStatusHistoryEntry` with from/to labels and timestamps; (5) documents section — list of visa documents with status badges, upload button for agent, request-document form (client select + description), review/process/re-upload buttons per document.

- [x] 5.3 Create `src/app/dashboard/visas/[id]/__tests__/actions.test.ts` — test that `updateVisaAction` rejects unauthenticated/unauthorized callers; test that field edits update mutable fields without changing status; test `setVisaClientsAction` correctly assigns and unassigns; test `transitionVisaStatusAction` allows valid transitions and rejects invalid ones; test document actions reject unauthorized callers. Mock `requireRole`/`requireFeature` for auth testing.

- [x] 5.4 Verify: `npx vitest run src/app/dashboard/visas/` — all dashboard visa tests pass. `npx tsc --noEmit` passes. `npm run lint` passes.

## Phase 6: Client Portal and Final Integration

- [ ] 6.1 Create `src/app/client/visas/[id]/documents/actions.ts` — `uploadVisaDocumentForRequestAction(documentId, file)` server action. Call `getClientSession()` to get authenticated traveler. Verify the document exists and `document.targetClientId === session.clientId` (reject if mismatch). Call `uploadVisaDocumentForRequest(documentId, session.clientId, file)`. Reject unauthenticated callers.

- [ ] 6.2 Create `src/app/client/visas/[id]/documents/page.tsx` — server page. Call `getClientSession()` for authentication. Call `getVisaById(params.id)` — verify the traveler is assigned to this visa (check `visa.clients` includes session client); reject if not assigned. Call `getVisaDocuments(params.id)` for the document list. Render: visa summary (country, type, deadline, status), list of document requests with status badges (`requested`, `re_upload_requested` highlighted), upload form per pending request (file input + submit button calling `uploadVisaDocumentForRequestAction`).

- [ ] 6.3 Create `src/app/client/visas/[id]/documents/__tests__/actions.test.ts` — test that `uploadVisaDocumentForRequestAction` allows an assigned traveler to upload; test that a non-assigned traveler is rejected; test that an unauthenticated caller is rejected. Mock `getClientSession` for auth testing.

- [ ] 6.4 Modify `src/app/client/page.tsx` — add a visa summary section alongside existing trip information. Call `getVisasByClientId(session.clientId)` to get the traveler's visas. Render a section showing each visa's country, type, deadline, and status with a link to `/client/visas/{id}/documents`. When the traveler has no visas, render without error (either omit the section or show "No visa applications"). Keep the section additive — existing trip content is untouched.

- [ ] 6.5 Final integration verification: run `npm run test` — all tests pass (visa management, visa documents, domain contracts, dashboard actions, client portal actions, existing feature tests). Run `npx tsc --noEmit` — no type errors. Run `npm run lint` — no lint errors. Run `npm run build` — production build succeeds. Manually verify: agent with `visas` feature can create/list/view/edit visas and manage documents; agent without `visas` feature is denied; traveler can see assigned visas and upload documents; `visas` appears in admin feature management UI.
