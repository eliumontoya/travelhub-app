# Proposal: MCP Service-Document Tools

## Intent

Expose TravelHub's **service-document** domain through the MCP server so an agent can, over a machine-to-machine channel: (1) obtain a signed URL to **download** a service document and save the bytes locally, and (2) **process** a downloaded file — delete the *physical* object from Supabase Storage while keeping the DB record and marking it `status = "processed"`.

Main already ships the entire service-document **data layer** (`src/lib/data/services.ts`) including `markUploadProcessed(id)`, which performs exactly the requested "delete object + keep row + set processed" behavior. What main lacks is any MCP surface: there is no `src/lib/mcp/`, no `src/app/api/mcp/`, and no `@modelcontextprotocol/sdk` dependency. A prior broad attempt lives on `feat/mcp-server-agent-actions` (41 tools across 8 domains) and is out of scope here. This change ships a **minimal MCP base** plus **service-document tools only**.

## Why

- The agent workflow requires programmatic access to service-document files outside the browser/dashboard session.
- The historical blocker (injecting a service-role client) is already solved in main via `getSupabaseAdmin()` + `canUseServiceRole()`, making a narrowly-scoped MCP change materially simpler than the old attempt.
- Download and process are the two named operations; upload (browser `File`) is not JSON-callable and is deferred.

## Scope

### In Scope
- A minimal MCP server base on main:
  - `@modelcontextprotocol/sdk` pinned `1.30.0` (zod peer `^4` satisfied by existing `zod@^4.4.3`).
  - `src/app/api/mcp/route.ts` — `runtime = "nodejs"`, stateless Streamable HTTP transport, Bearer `MCP_API_KEY` gate (401), service-role availability gate (503).
  - `src/lib/mcp/auth.ts` (timing-safe Bearer allow-list), `src/lib/mcp/errors.ts`, `src/lib/mcp/server.ts`, `src/lib/mcp/tools/utils.ts`.
- Service-document MCP tools (7, finalized below).
- A service-role signed-URL helper (new) in `src/lib/data/documents.ts`.
- A service-document ownership/archived-trip guard helper (new) in `src/lib/data/services.ts`.
- Tests (Vitest) for the MCP route gate, tool wiring, signed-URL helper, and guard.

### Out of Scope (deferred)
- Porting the old 41 tools (clients/suppliers/trips/items/etc.) from `feat/mcp-server-agent-actions`.
- Binary upload via MCP (`uploadServiceDocument` takes a browser `File`; a signed-*upload*-URL helper does not exist in main).
- Checklist *mutation* tools (`addChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklistItems`, `addChecklistItemToTripServices`).
- Public traveler route changes, RLS changes, dashboard changes.

## Resolved Open Questions

1. **Signed download URL** — Add a service-role variant `getSignedServiceDocumentDownloadUrl(path, expiresIn = 3600)` in `src/lib/data/documents.ts`, implemented with `getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresIn)`. It does **not** reuse the existing `getSignedDocumentUrl` (which builds a cookie/anon client via `createServerSupabase()` and returns `null` from a cookie-less MCP route). Service-role-signed URLs are valid download tokens regardless of the signing key, and bypass the bucket's `auth.uid() is not null` storage policy.

2. **Ownership / archived-trip guard** — The data-layer mutators (`markUploadProcessed`, `markUploadReviewed`, `requestReUpload`) update by upload id with **no** trip-status or ownership check; those guards live only in Server Actions (`assertServiceDocumentMutableTrip` + `getUploadForTrip`, both cookie/`requireRole`-bound). The MCP mutation tools re-implement the same invariants with a new data-layer helper `assertServiceUploadMutable(uploadId, tripId)` (final name/shape to design) that: loads the upload (`service_uploads` by id → `service_id`), resolves the owning `service` (→ `trip_id`), loads the trip via `getTripById`, and rejects when (a) the trip is `archived`, or (b) the resolved `trip_id` does not match the caller-supplied `tripId`. Rejection uses the existing not-found/error envelope. The helper is data-layer (Supabase-only) and is a candidate for later reuse by the dashboard actions to deduplicate the Server-Action guard.

3. **Mock-mode lockout** — The MCP route MUST return 503 when the service role is not configured, so tools never run against in-memory mock data. Implemented with `canUseServiceRole()` (from `@/lib/data/shared`), evaluated per request before any tool registration or dispatch. This is consistent with the prior change's "no mock from MCP" decision.

4. **SDK pin** — `@modelcontextprotocol/sdk@1.30.0` (exact). Existing `zod@^4.4.3` already satisfies the SDK's `zod` peer range; no zod bump needed.

## Capabilities

### New Capabilities
- `mcp-server`: The MCP HTTP base — Bearer `MCP_API_KEY` gate (401), service-role availability gate (503), `nodejs` runtime, stateless Streamable HTTP transport, and tool-registry scaffolding.
- `mcp-service-document-tools`: The seven service-document tools (list/checklist/summaries/download URL/process/review/reupload), the service-role signed-URL behavior, and the ownership/archived-trip guard.

### Modified Capabilities
None. The archived-trip/ownership invariants already specified by `service-upload-review` are **re-exposed** through a new MCP surface, not changed. No existing spec requirement is added, removed, or altered.

## MVP Tool List

| Tool | Wraps (data layer) | Notes |
|------|--------------------|-------|
| `list_services` | `getServicesForTrip(tripId)` | Discovery: returns `Service[]` for a trip (includes `service.id`). |
| `get_service_checklist` | `getServiceChecklistForTrip(tripId, serviceId)` | Returns items + uploads with `filePath`/`status`; **no** signed URLs embedded. |
| `get_service_document_summaries` | `getServiceDocumentSummariesForTrip(tripId)` | Compact processed/total/awaiting-review counts. |
| `get_service_upload_download_url` | **new** `getSignedServiceDocumentDownloadUrl(path, expiresIn?)` | Returns `{ url, expiresIn }` for a `filePath` obtained from the checklist output. |
| `process_service_upload` | `markUploadProcessed(uploadId)` **+ guard** | The requested "process file" tool. Deletes physical object, keeps row, sets `processed`. |
| `mark_service_upload_reviewed` | `markUploadReviewed(uploadId)` **+ guard** | Sets `reviewed`. |
| `request_service_upload_reupload` | `requestReUpload(uploadId, comment)` **+ guard** | Sets `re_upload_requested` with `agentComment`. |

The three mutation tools accept `tripId` + `uploadId` (and `comment` for reupload) so the ownership guard can verify the upload belongs to the caller-specified trip. `get_service_checklist` intentionally omits signed URLs (avoids N signing calls per fetch); the client calls `get_service_upload_download_url` on demand with the `filePath` it was given.

## Approach

Port the reusable MCP plumbing verbatim (`auth.ts`, `errors.ts`, `tools/utils.ts`) and rewrite `server.ts` + `route.ts` against main's modular data layer. **Drop** the old `supabase-store.ts` (AsyncLocalStorage) and the trailing-`supabase` injection entirely — main's data functions select the client internally (`getServiceClient()` → `getSupabaseAdmin()` when the service role is set). Add `@modelcontextprotocol/sdk@1.30.0`, the `MCP_API_KEY` Bearer gate, `runtime = "nodejs"`, and a service-role availability 503 gate. Register only the service-document registrar in `createMcpServer()`. Add one service-role signed-URL helper and one ownership/archived-trip guard helper in the data layer, then wire the seven tools through the standard `success`/`notFound`/`mcpError`/`unexpectedError` result envelope (never leaking stack traces or secrets).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Add `@modelcontextprotocol/sdk@1.30.0`. |
| `src/app/api/mcp/route.ts` | New | `nodejs` route; Bearer 401 gate, service-role 503 gate, Streamable HTTP transport. |
| `src/lib/mcp/auth.ts` | New | Timing-safe Bearer allow-list (ported verbatim). |
| `src/lib/mcp/errors.ts` | New | `success`/`notFound`/`mcpError` result envelope (ported verbatim). |
| `src/lib/mcp/tools/utils.ts` | New | `textResult`/`safeMessage`/`isNotFoundMessage`/`unexpectedError` (ported verbatim). |
| `src/lib/mcp/server.ts` | New | `createMcpServer()` registering only service-document tools. |
| `src/lib/mcp/tools/service-documents.ts` | New | The seven tool registrars (zod input schemas) against main's data layer. |
| `src/lib/data/documents.ts` | Modified | Add `getSignedServiceDocumentDownloadUrl(path, expiresIn?)`. |
| `src/lib/data/services.ts` | Modified | Add `assertServiceUploadMutable(uploadId, tripId)` guard helper. |
| `src/lib/mcp/__tests__/*`, `src/app/api/mcp/__tests__/*` | New | Route gate, tool wiring, signed-URL helper, and guard tests. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Service role missing at deploy → tools unreachable | Medium | 503 gate via `canUseServiceRole()`; no silent mock fallback from MCP. |
| Guard drift vs Server Actions (archived/ownership) | Medium | Single data-layer `assertServiceUploadMutable` shared candidate; mirror the exact Server-Action checks and add tests. |
| Signed-URL helper signs arbitrary bucket paths | Low | Accepts the `filePath` only from the checklist output; holder of `MCP_API_KEY` is already a trusted agent; optionally resolve via `uploadId` in design if stricter ownership is required. |
| SDK/zod peer mismatch | Low | Pin `@modelcontextprotocol/sdk@1.30.0`; existing `zod@^4.4.3` satisfies the peer range. |
| Old-route name mismatch (`isServiceRoleConfigured`/`createServiceRoleClient`) | Low | Ported code renamed to `getSupabaseAdmin()` / `canUseServiceRole()`. |

## Rollback Plan

Revert the MCP files, the two data-layer additions, and `package.json` together in one work-unit commit; no database migration or data conversion is planned. Removing the dependency and route fully restores prior behavior (the data-layer additions are additive and unused by the UI).

## Dependencies

- `SUPABASE_SERVICE_ROLE_KEY` and `MCP_API_KEY` present in the deployed environment (service-role key required to bypass private-bucket/RLS).
- Existing `@supabase/supabase-js@^2.109.0` and `zod@^4.4.3`.

## Success Criteria

- [ ] MCP route returns 401 without a valid Bearer `MCP_API_KEY`, and 503 when `SUPABASE_SERVICE_ROLE_KEY` is absent.
- [ ] `get_service_upload_download_url` returns a working signed URL for a service-document `filePath`.
- [ ] `process_service_upload` deletes the physical object, keeps the DB row, and sets `status = "processed"` / `file_removed = true`.
- [ ] All three mutation tools reject archived trips and uploads that do not belong to the caller-supplied trip.
- [ ] Mock data is never reachable from the MCP surface.
- [ ] `npm run test` and `npx tsc --noEmit` pass.
