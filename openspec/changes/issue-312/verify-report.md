```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:bbff21fb839f6345798bbd3a63c781b5df8ab504a11aaaeadae98d99988313c9
verdict: fail
blockers: 0
critical_findings: 11
requirements: 19/19
scenarios: 22/33
test_command: npm run test
test_exit_code: 0
test_output_hash: sha256:4c259df4944490baa995f60f58dc4b4ad795b9e2e969a99b2052147b98e1d6d3
build_command: npm run build
build_exit_code: 0
build_output_hash: sha256:513aa0bb7e71c270328b569572bc90edb5ec439e739ad3c7d3b0bc142d4ff269
```

## Verification Report

**Change**: issue-312
**Version**: N/A (first spec revision)
**Mode**: Strict TDD (strict_tdd: true in openspec/config.yaml)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

All 14 tasks in `tasks.md` are marked `[x]` and the implementation for each was confirmed on disk.

### Build & Tests Execution
**Tests**: ✅ 397 passed / 0 failed / 0 skipped (64 files, `npm run test`, exit 0)
**Typecheck**: ✅ `npx tsc --noEmit` exit 0
**Build**: ✅ `npm run build` exit 0 (all routes compiled, including `/client/trips/[id]/documents`)
**Lint**: ✅ `npm run lint` exit 0 — 4 warnings (2 in changed files: unused `tripId` prop in `ServiceChecklistManager.tsx`, unused `itemC` in `services.test.ts`)
**Coverage**: ➖ Not available (no coverage tool configured; `coverage_threshold: 0`)

```text
$ npm run test
 Test Files  64 passed (64)
      Tests  397 passed (397)

$ npx tsc --noEmit        # exit 0
$ npm run build           # exit 0
```

### Spec Compliance Matrix

**service-auto-creation** (3 requirements, 5 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Service provisioning on assignment | First assignment creates a service | `auto-create.test.ts > createTrip auto-creates one service per assigned client` | ✅ COMPLIANT |
| Service provisioning on assignment | Re-assigning the same client is idempotent | `services.test.ts > ensureServiceForAssignment creates one service and is idempotent`; `auto-create.test.ts > setTripClients re-assignment is idempotent` | ✅ COMPLIANT |
| Service provisioning on assignment | Multiple clients on one trip each get their own service | `auto-create.test.ts > createTrip auto-creates one service per assigned client` (2 distinct ids) | ✅ COMPLIANT |
| Cascade deletion on trip removal | Trip deletion removes all associated services | `auto-create.test.ts > deleteTrip cascades services, checklist items, uploads and removes storage objects` | ✅ COMPLIANT |
| Service uniqueness guarantee | Concurrent duplicate creation is prevented | Unique constraint `(trip_id, client_id, service_type)` in migration `20260919000000_service_documents.sql`; upsert `onConflict` in `ensureServiceForAssignment` (implemented) — no runtime test executes the DB constraint (mock-mode suite) | ❌ UNTESTED |

**service-checklist-management** (5 requirements, 7 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Agent can add checklist items | Add a required item | `services.test.ts > addChecklistItem appends items with increasing sort order` (required=true, sortOrder=0) | ✅ COMPLIANT |
| Agent can add checklist items | Add an optional item | same test (required=false, sortOrder=1) | ✅ COMPLIANT |
| Agent can edit checklist items | Edit item label | `updateChecklistItem` implemented (services.ts:233, Supabase + mock); UI editor in ServiceChecklistManager (implemented) — no behavioral covering test; only export-surface assertions in `actions.test.ts` | ❌ UNTESTED |
| Agent can delete checklist items | Delete item with uploaded file | `services.test.ts > deleteChecklistItem removes the item and its upload record`; Supabase path removes storage objects (services.ts:273-294) | ✅ COMPLIANT |
| Agent can delete checklist items | Delete item with no upload | same function, no-upload branch is side-effect free (implemented) | ✅ COMPLIANT |
| Agent can reorder checklist items | Move item to top | `services.test.ts > reorderChecklistItems persists the requested order` | ✅ COMPLIANT |
| Client cannot mutate the checklist | Client has no checklist write surface | `actions.test.ts > client actions do not export status-transition functions`; client `actions.ts` exports only `uploadDocument` | ✅ COMPLIANT |

**client-document-upload** (4 requirements, 6 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| One file per checklist item | First upload for an item | `services.test.ts > uploadServiceDocument upserts one record per checklist item` (status `uploaded`, path under `services/`) | ✅ COMPLIANT |
| One file per checklist item | Re-upload replaces previous file | same test (single record, filename replaced); Supabase path deletes old storage object (services.ts:457-459) and resets status/comment | ✅ COMPLIANT |
| Server-side only storage access | Client never receives a raw storage path | Client documents page renders label/status/comment, never `filePath` or bucket URL; signed URLs generated server-side and not rendered (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Server-side only storage access | Client has no direct Supabase client access | No browser Supabase client import in client portal routes; all ops via `"use server"` actions with `getSupabaseAdmin()` (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Upload belongs to the correct service and item | Upload for another client's item is rejected | `client-portal.test.ts > uploadServiceDocument rejects a checklist item that belongs to another service`; action-level ownership check in `uploadDocument` (client/actions.ts:21-32) | ✅ COMPLIANT |
| File metadata is recorded | Upload record contains required metadata | Insert stores filename, mime_type, file_path, uploaded_at, status (services.ts:438-454); test asserts filename + path | ✅ COMPLIANT |

**service-upload-review** (4 requirements, 7 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Agent marks upload as processed | Mark upload as processed | `services.test.ts > markUploadProcessed sets status processed and file_removed`; Supabase path deletes object (services.ts:474-494) | ✅ COMPLIANT |
| Agent marks upload as processed | Processed upload shows no file to client | Client page `canUpload()` returns false for `processed`, renders ✅ "Procesado", no download surface (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Agent requests re-upload with comment | Request re-upload with comment | `services.test.ts > requestReUpload stores comment and status re_upload_requested`; original file retained (no storage delete in code) | ✅ COMPLIANT |
| Agent requests re-upload with comment | Re-upload request without comment is rejected | `services.test.ts > requestReUpload rejects empty or whitespace-only comments` | ✅ COMPLIANT |
| Client sees agent comment after re-upload request | Client views re-upload request with comment | Page renders `Comentario del agente: …` for `re_upload_requested`; upload form re-enabled (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Client sees agent comment after re-upload request | Client re-uploads after re-upload request | `uploadServiceDocument` upsert resets status to `uploaded`, clears `agent_comment`, deletes old object (services.ts:438-459) | ✅ COMPLIANT |
| Only agent can transition upload status | Client cannot mark upload as processed | `actions.test.ts` export-surface assertions; client actions expose only `uploadDocument` | ✅ COMPLIANT |

**client-document-progress** (3 requirements, 8 scenarios)

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Home progress counter | Counter reflects completed items | `client/page.test.tsx > shows a Documentos link and a text progress counter per trip` (asserts "2/5") | ✅ COMPLIANT |
| Home progress counter | Counter updates after re-upload request | `client-portal.test.ts > progress count only treats processed uploads as completed` ({completed: 1, total: 3}) | ✅ COMPLIANT |
| Home progress counter | Counter for service with no checklist | Home hides the counter when `total === 0` but keeps the Documentos link (implemented; spec allows "0/0" or hidden section) — no covering test | ❌ UNTESTED |
| Checklist item statuses | Pending item display | `statusLabel` maps no-upload to ⬜ "Pendiente" (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Checklist item statuses | Uploaded item display | `statusLabel` maps `uploaded` to 🔄 "Pendiente de revisión" (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Checklist item statuses | Processed item display | `statusLabel` maps `processed` to ✅ "Procesado" (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Checklist item statuses | Re-upload requested display with comment | `statusLabel` maps to ⚠ + agent comment rendered (implemented, static inspection) — no covering test | ❌ UNTESTED |
| Progress is read-only for the client | Client cannot manually set status | No status-mutation surface in client actions (tested in `actions.test.ts`); page has no status controls | ✅ COMPLIANT |

**Compliance summary**: 22/33 scenarios COMPLIANT (runtime test evidence), 11/33 UNTESTED (implemented and verified by source inspection, but no covering automated test).

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| service-auto-creation | ✅ Implemented | `createTrip`/`setTripClients` hooks call `ensureServiceForAssignment` (upsert on unique key); `setTripClients` removal and `deleteTrip` delete services + items + uploads + storage objects |
| service-checklist-management | ✅ Implemented | add/edit/delete/reorder in `services.ts`; agent-only actions gated by `assertTripEditable`; UI in `ServiceChecklistManager.tsx` |
| client-document-upload | ✅ Implemented | upsert `(service_id, checklist_item_id)` + old-object delete; ownership validated at action and data layers |
| service-upload-review | ✅ Implemented | `markUploadProcessed` deletes object + `file_removed=true`; `requestReUpload` rejects empty comment; status transitions agent-only |
| client-document-progress | ✅ Implemented | `getServicesProgressForClient` counts only `processed`; N/M text counter on home; status indicators per spec table |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| One service per (trip, client), unique `(trip_id, client_id, service_type)` | ✅ Yes | migration + upsert |
| Storage prefix `services/{serviceId}/{checklistItemId}/{ts}-{file}` in `trip-documents` | ✅ Yes | `buildStoragePath` |
| Client access via Server Actions + `getSupabaseAdmin()` service role; RLS authenticated-only (0026 pattern) | ✅ Yes | `getServiceClient()` prefers service role; migration RLS `auth.uid() is not null` + force RLS |
| Upload module `src/lib/data/services.ts`, re-exported from `data.ts` | ✅ Yes | |
| Re-upload upsert + delete prior object + reset status/comment | ✅ Yes | |
| Auto-create hook in `createTrip` + `setTripClients` `toAdd`; `deleteTrip` cascade | ✅ Yes | |
| E2E Playwright for client upload → agent process → client sees ✓ | ❌ No | No E2E specs added for the documents flow (contributes to UNTESTED scenarios) |
| `setTripClients` removal deletes the client's service (open question) | ✅ Yes | `deleteServiceForClient` |

### Issues Found

**CRITICAL** (11 — all `UNTESTED` per the strict-TDD gate "spec scenario has no passing covering test"; none are functional defects — every behavior is implemented and verified by source inspection):
1. **service-auto-creation — "Concurrent duplicate creation is prevented"** — enforced by the migration unique constraint + upsert `onConflict`, but no runtime test executes the constraint.
2. **service-checklist-management — "Edit item label"** — `updateChecklistItem` has no behavioral covering test (only export-surface assertions).
3. **client-document-upload — "Client never receives a raw storage path"** — no covering test; verified by static inspection only.
4. **client-document-upload — "Client has no direct Supabase client access"** — no covering test; verified by static inspection only.
5. **service-upload-review — "Processed upload shows no file to client"** — no covering test; client documents page has no component test.
6. **service-upload-review — "Client views re-upload request with comment"** — no covering test.
7. **client-document-progress — "Counter for service with no checklist"** — no covering test.
8. **client-document-progress — "Pending item display"** — no covering test.
9. **client-document-progress — "Uploaded item display"** — no covering test.
10. **client-document-progress — "Processed item display"** — no covering test.
11. **client-document-progress — "Re-upload requested display with comment"** — no covering test.

The design's Testing Strategy promised E2E coverage ("Client upload → agent process → client sees ✓; re-upload request shows ⚠ + comment") which was not delivered; the client documents page (`/client/trips/[id]/documents/page.tsx`) has no component test despite the house pattern of rendering tests (e.g., `client/page.test.tsx`).

**WARNING**:
1. **TDD evidence artifact missing (process)** — No `apply-progress.md` exists for issue-312, so the strict-TDD "TDD Cycle Evidence" table is absent. Git history independently shows RED-first commits for phases 1–3 (`2ec0491` test → `f1f6344` feat; `4011c13` test → `8ab96ab` feat; `c67262f` test → `50c1890` feat). Phase 4 deviation: `actions.test.ts` was committed with the feature commit `52f581f` rather than before it (phase-4 data-layer behaviors were already covered by phase-1 RED tests). All referenced test files exist and pass.
2. **Lint warnings in changed files** — `tripId` unused prop in `ServiceChecklistManager.tsx` (line 41); unused `itemC` in `services.test.ts` (line 151). 0 errors.

**SUGGESTION**:
1. **Graceful degradation when service role key is missing (security)** — `getServiceClient()` falls back to the anon-key `createServerSupabase()` when Supabase is configured without `SUPABASE_SERVICE_ROLE_KEY`. The client portal has no Supabase Auth identity, so RLS blocks all access and the portal errors at runtime. Fail-closed (no leak) and per design, but `getClientHomeTrips`'s degrade-to-`[]` pattern would be more consistent.
2. **Empty-checklist counter** — Home hides the counter when `total === 0` but keeps the Documentos link; consider hiding the whole link block for literal spec compliance.
3. **Client re-upload gating** — Client can only re-upload while an item is `pending` or `re_upload_requested`; an upload in `uploaded` status cannot be replaced from the UI (data layer supports unconditional upsert). Deliberate product choice; spec scenarios remain satisfied.
4. **Storage-object deletion paths untested at runtime** — `deleteChecklistItem`, `markUploadProcessed`, `uploadServiceDocument` old-object removal, and `deleteTrip` storage cleanup run only against real Supabase; mock-mode tests cannot observe bucket removal.

### Security Review
- **No client-facing raw storage path/URL**: client documents page renders only label, status, and agent comment; no `filePath` or bucket URL exposed. Signed URLs generated server-side (`getSignedDocumentUrl`, 1h expiry), never rendered client-side. ✅
- **All client data access is service-role Server Actions**: client portal uses `"use server"` actions → `getSupabaseAdmin()` (service role) when configured; no browser Supabase client imported in client routes. ✅
- **Cross-client access rejected**: `uploadDocument` validates `requested.clientId === session.clientId` and re-validates via `getServiceForClientTrip`; `uploadServiceDocument` additionally rejects items not belonging to the service. ✅
- **Client cannot mutate checklist/status**: client action surface exports only `uploadDocument` (asserted by test); all mutations live in dashboard actions gated by `assertTripEditable`. ✅
- No security violations found.

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ❌ | No `apply-progress.md` for issue-312 (WARNING 1); TDD order reconstructed from git history |
| All tasks have tests | ✅ | 14/14 tasks reference test files that exist and pass |
| RED confirmed (tests exist) | ✅ | 5 test files verified on disk (services, auto-create, client-portal, actions, client page) |
| GREEN confirmed (tests pass) | ✅ | 25/25 focused tests pass; 397/397 full suite |
| Triangulation adequate | ⚠️ | Core behaviors triangulated (idempotency, upsert, progress, comment rejection); `updateChecklistItem` and client documents-page rendering untested (CRITICALs 2, 5–11) |
| Safety Net for modified files | ⚠️ | Mock arrays reset in `beforeEach`; existing suite (64 files) green before and after — no regressions |

**TDD Compliance**: 4/6 checks passed (evidence reporting artifact missing; two behavior areas untriangulated)

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (data layer, mock mode) | 397 total | 64 | Vitest |
| Integration | 0 | 0 | — |
| E2E | 0 | 0 | Playwright available, no documents-flow specs added |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (`coverage: available: false` in config).

### Assertion Quality
All new assertions verify real behavior: distinct service ids, sort orders, status transitions, upload counts, progress aggregates, export-surface membership. No tautologies, ghost loops, or smoke-only tests. The client page test uses a custom element walker to assert rendered text and links (behavioral, not class-level). No mock-heavy tests (>2× mocks-to-assertions).

**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ⚠️ 4 warnings (0 errors) — 2 in changed files
**Type Checker**: ✅ No errors

### Verdict
**FAIL** — Strict TDD test-evidence gate: 11/33 spec scenarios have no passing covering test (CRITICAL `UNTESTED`), so the evidence is incomplete and the native validator refuses a passing verdict. This is NOT a functional-defect failure: all 19 requirements are implemented, all behaviors match the specs and design by source inspection, all 397 tests pass, and there are no security violations. The gap is missing automated coverage for UI rendering (client documents page), `updateChecklistItem`, and the DB uniqueness constraint — plus the design's promised E2E layer was not delivered. Recommended remediation: add the 11 covering tests (component tests for the client documents page, a behavioral `updateChecklistItem` test, and an integration test for the unique constraint), then re-verify. No feature-code changes are required.