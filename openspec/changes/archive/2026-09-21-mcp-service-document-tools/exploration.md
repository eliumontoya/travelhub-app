# Exploration: MCP Service-Document Tools

**Change slug:** `mcp-service-document-tools`
**Phase:** explore
**Artifact store:** openspec (config reports `hybrid`)

## Executive Summary

Expose TravelHub's **service-document** domain through the MCP server, focused on two operations the user named:

1. **Download** a service-document file — client receives a signed URL and saves the bytes locally.
2. **Process** a file — delete the *physical* object from Supabase Storage, keep the DB row, set `status = "processed"` (and `file_removed = true`).

Main already contains the entire service-document **data layer** (`src/lib/data/services.ts`) including `markUploadProcessed(id)` which does exactly the requested "delete object + keep row + set processed" behavior. What main does **not** contain is any MCP surface: there is no `src/lib/mcp/`, no `src/app/api/mcp/`, and no `@modelcontextprotocol/sdk` dependency.

The prior attempt lives on branch `feat/mcp-server-agent-actions` (41 tools, full MCP infra) and its OpenSpec artifacts survive under `openspec/changes/mcp-server-agent-actions/`. That attempt targeted the **old monolithic** `src/lib/data.ts` with a trailing `supabase?` injection + AsyncLocalStorage. Main has since **modularized** the data layer and already ships `getSupabaseAdmin()` + `canUseServiceRole()`, so the single hardest problem the old design wrestled with (injecting a service-role client) is **already solved in main**. This makes the new, narrowly-scoped change materially simpler than the old one.

---

## 1. Old MCP branch surface (`feat/mcp-server-agent-actions`)

File tree under the old branch (via `git ls-tree -r feat/mcp-server-agent-actions`):

```
src/app/api/mcp/route.ts
src/app/api/mcp/__tests__/route.test.ts
src/app/api/mcp/__tests__/route-tools.test.ts
src/lib/mcp/auth.ts
src/lib/mcp/errors.ts
src/lib/mcp/server.ts
src/lib/mcp/supabase-store.ts
src/lib/mcp/tools/clients.ts
src/lib/mcp/tools/documents.ts
src/lib/mcp/tools/internalNotes.ts
src/lib/mcp/tools/items.ts
src/lib/mcp/tools/packing.ts
src/lib/mcp/tools/suppliers.ts
src/lib/mcp/tools/tripDays.ts
src/lib/mcp/tools/trips.ts
src/lib/mcp/tools/utils.ts
src/lib/mcp/__tests__/auth.test.ts
```

Port/adapt assessment for each:

| File | Copy as-is? | Reason |
|------|-------------|--------|
| `src/lib/mcp/auth.ts` (`isMcpApiKeyConfigured`, `validateMcpApiKey` — timing-safe Bearer allow-list) | ✅ copy as-is | Pure, no data-layer coupling. Depends only on `MCP_API_KEY` env + `node:crypto`. |
| `src/lib/mcp/errors.ts` (`notFound`, `mcpError`, `success`) | ✅ copy as-is | Pure; only imports MCP SDK types. |
| `src/lib/mcp/tools/utils.ts` (`textResult`, `safeMessage`, `isNotFoundMessage`, `unexpectedError`) | ✅ copy as-is | Pure helpers. |
| `src/lib/mcp/server.ts` (`createMcpServer`) | ⚠️ adapt | Imports all 8 tool registrars. For this change only the documents/services registrar is needed; drop or trim the others (they target domains out of scope). |
| `src/app/api/mcp/route.ts` | ⚠️ adapt | Imports `isServiceRoleConfigured` / `createServiceRoleClient` from `@/lib/supabase/server` — those names **do not exist in main** (main has `getSupabaseAdmin()` + `canUseServiceRole()`). Also uses `runWithMcpSupabase`. |
| `src/lib/mcp/supabase-store.ts` (`AsyncLocalStorage`, `getMcpSupabaseClient`, `runWithMcpSupabase`) | ❌ drop | Main's data layer no longer takes a trailing `supabase` arg; internal `getServiceClient()`/`getSupabaseAdmin()` decide the client. AsyncLocalStorage propagation is unnecessary. |
| `src/lib/mcp/tools/*.ts` (all 8) | ❌ rewrite | Every tool calls `data.<fn>(..., supabase)` with `getMcpSupabaseClient()`. Main's functions take **no** client arg. Must be re-pointed to main's modular data-layer signatures. |
| `src/lib/mcp/tools/documents.ts` (old) | ❌ rewrite | Old `get_document_upload_url` wraps `getSignedDocumentUploadUrl(path, expiresIn, supabase)` — a function that does **not exist** in main. |

Old branch also had `@modelcontextprotocol/sdk@1.30.0` in `package.json` and `isServiceRoleConfigured`/`createServiceRoleClient` in its `src/lib/supabase/server.ts`. Main has neither the SDK dep nor those two names.

---

## 2. Service-document domain in main

### 2.1 Data layer — `src/lib/data/services.ts`

All functions use an internal `getServiceClient()`:

```ts
async function getServiceClient(): Promise<SupabaseClient> {
  if (canUseServiceRole()) return getSupabaseAdmin();   // service role if SUPABASE_SERVICE_ROLE_KEY set
  if (isSupabaseConfigured()) return await createServerSupabase(); // else cookie SSR client
  throw new Error("Supabase no está configurado");
}
```

Exported functions (exact signatures):

| Function | Signature | Natural MCP tool? |
|----------|-----------|-------------------|
| `getServicesForTrip` | `(tripId: string) => Promise<Service[]>` | ✅ `list_services` |
| `getServiceChecklistForTrip` | `(tripId: string, serviceId: string) => Promise<ServiceWithChecklist>` | ✅ `get_service_checklist` |
| `getServiceWithChecklist` | `(serviceId: string) => Promise<ServiceWithChecklist>` | ✅ alt for checklist |
| `getServiceDocumentSummariesForTrip` | `(tripId: string) => Promise<ServiceDocumentSummary[]>` | ✅ `get_service_document_summaries` |
| `getServiceForClientTrip` | `(clientId, tripId) => Promise<Service \| null>` | optional |
| `getServicesProgressForClient` | `(clientId) => Promise<Map<string,{completed,total}>>` | optional (Map serializes awkwardly) |
| `ensureServiceForAssignment` | `(tripId, clientId) => Promise<Service>` | optional |
| `hasOwnedServiceRequirements` | `(tripId, clientId) => Promise<boolean>` | optional |
| `addChecklistItem` | `(serviceId, {label, required?}) => Promise<ServiceChecklistItem>` | optional (checklist mgmt) |
| `addChecklistItemToTripServices` | `(tripId, {label, required?}) => Promise<ServiceChecklistItem[]>` | optional |
| `updateChecklistItem` | `(id, {label?, required?}) => Promise<void>` | optional |
| `deleteChecklistItem` | `(id) => Promise<void>` | optional |
| `reorderChecklistItems` | `(serviceId, orderedIds) => Promise<void>` | optional |
| `uploadServiceDocument` | `(serviceId, checklistItemId, file: File) => Promise<ServiceUpload>` | ❌ takes a Web `File` (not JSON-callable) |
| `markUploadReviewed` | `(id: string) => Promise<void>` | ✅ `mark_service_upload_reviewed` |
| `markUploadProcessed` | `(id: string) => Promise<void>` | ✅ `process_service_upload` (the requested "process file" tool) |
| `requestReUpload` | `(id: string, comment: string) => Promise<void>` | ✅ `request_service_upload_reupload` |

`markUploadProcessed` behavior (verified): reads `file_path` from `service_uploads` by id; if present, `supabase.storage.from(DOCUMENTS_BUCKET).remove([file_path])`; then `update({ status: "processed", file_removed: true })`. This is **exactly** the requested semantics (delete physical object, keep row, mark processed).

### 2.2 Storage bucket

`DOCUMENTS_BUCKET = "trip-documents"` (exported from `src/lib/data/documents.ts`, imported by services.ts). Service uploads live under `services/{serviceId}/{checklistItemId}/{ts}-{filename}` (see `buildStoragePath`). Migration `0002_storage_bucket.sql` creates the **private** bucket; migration `20260919000000_service_documents.sql` creates `services`, `service_checklist_items`, `service_uploads` tables with RLS `auth.uid() is not null` policies + `grant ... to authenticated`.

### 2.3 Types — `src/types/index.ts`

`ServiceType = "trip_documents"`; `ServiceUploadStatus = "uploaded" | "reviewed" | "processed" | "re_upload_requested"`; `Service`; `ServiceChecklistItem`; `ServiceUpload` (has `filePath`, `fileRemoved`, `status`, `agentComment`); `ServiceChecklistItemWithUpload` (adds `upload?: ServiceUpload & { url: string | null }`); `ServiceWithChecklist` (adds `items`); `ServiceDocumentSummary`.

---

## 3. Download-auth resolution

**Question:** does `getSignedDocumentUrl(path)` work from a cookie-less MCP route?

**Answer: no, reliably not.**

`getSignedDocumentUrl` (documents.ts) calls `createServerSupabase()`, which is `createClient()` from `src/lib/supabase/server.ts`. That factory:
- calls `cookies()` from `next/headers` to build a **cookie-aware** SSR client with the **anon** key;
- in a Route Handler under a machine-to-machine call there is no Supabase Auth session cookie, so the client has no `auth.uid()`;
- the private bucket's storage policy requires `auth.uid() is not null`, and the `service_uploads`/`services` RLS is `auth.uid() is not null` — so the anon/no-session client is denied.

`getSupabaseAdmin()` **does** exist in main (`src/lib/supabase/server.ts`, memoized singleton using `SUPABASE_SERVICE_ROLE_KEY`, `auth: { persistSession:false, autoRefreshToken:false }`). The service-role key bypasses both Postgres RLS and Storage policies.

**Recommendation:**
1. Add a service-role variant for signed download URLs — e.g. `getSignedDocumentUrlAsAdmin(path)` (or extend `getSignedDocumentUrl` with an optional `client`/`asAdmin` param) that uses `getSupabaseAdmin()` and calls `createSignedUrl(path, 3600)`. Signed URLs generated with the service-role key are valid download tokens regardless of which key signed them.
2. The same applies to `getServiceWithChecklist` / `getServiceChecklistForTrip`: they call `getSignedDocumentUrl` (cookie-based) for each upload, so from MCP the `url` fields would be `null`. To expose a checklist with working download URLs over MCP, the signed-URL helper must be service-role based.
3. `markUploadProcessed` is **already safe for MCP**: it uses `getServiceClient()`, which prefers `getSupabaseAdmin()` whenever `SUPABASE_SERVICE_ROLE_KEY` is set. As long as the MCP route enforces service-role availability (fail 503 otherwise), the delete-object path works without a browser session.

---

## 4. Target tool list (service documents)

Recommended tool names, wrapping existing data functions:

| Tool | Wraps | Notes |
|------|-------|-------|
| `list_services` | `getServicesForTrip(tripId)` | |
| `get_service_checklist` | `getServiceChecklistForTrip(tripId, serviceId)` | Needs service-role signed URLs to be useful for download |
| `get_service_document_summaries` | `getServiceDocumentSummariesForTrip(tripId)` | |
| `get_service_upload_download_url` | **new** admin signed-URL helper | Returns `{ url, expiresIn }`; wraps `createSignedUrl` on `DOCUMENTS_BUCKET` via `getSupabaseAdmin()` |
| `process_service_upload` | `markUploadProcessed(uploadId)` | **Requires** ownership + lifecycle guard (see §5) |
| `mark_service_upload_reviewed` | `markUploadReviewed(uploadId)` | same guard |
| `request_service_upload_reupload` | `requestReUpload(uploadId, comment)` | same guard |

Deferred / out-of-scope (flag only): `uploadServiceDocument` takes a browser `File` and is not JSON-callable; upload via MCP would require a signed **upload** URL helper (`createSignedUploadUrl`) — a function main does not have. The user's two named operations (download, process) do not need upload.

---

## 5. Risks / gaps

1. **Missing SDK dependency.** `@modelcontextprotocol/sdk` is absent from main's `package.json` (present only on the old branch). Must add + pin (old branch used `1.30.0`; zod `^4.4.3` is already present and satisfies the SDK's peer range).
2. **`getSupabaseAdmin()` vs old names.** The old route/tool code imports `isServiceRoleConfigured`/`createServiceRoleClient`, which do not exist in main. Main's equivalents are `getSupabaseAdmin()` (from `@/lib/supabase/server`) and `canUseServiceRole()` (from `@/lib/data/shared`). All ported code must be renamed accordingly.
3. **Ownership + archived-trip guard lives in Server Actions, not the data layer.** Verified: `markUploadProcessed`/`markUploadReviewed`/`requestReUpload` in services.ts update by upload id with **no** trip-status or ownership check. The guards are in `src/app/dashboard/trips/[id]/actions.ts` — `assertServiceDocumentMutableTrip(tripId)` (rejects `archived`, uses `requireRole("admin","agent")` → cookie session) and `getUploadForTrip(tripId, uploadId)` (verifies upload belongs to trip). The `service-upload-review` spec requires archived trips to reject `processed`/`re_upload_requested`. MCP tools must therefore **re-implement** these guards with the data layer (resolve `tripId` from the upload/service and check `getTripById(tripId).status !== "archived"`), because the Server-Action helpers depend on `requireRole` and `revalidatePath` and are not reusable from a cookie-less route.
4. **Mock-mode behavior.** services.ts mock branches mutate in-memory arrays; `getServiceClient()` throws when Supabase is unconfigured. The MCP route must enforce service-role configuration (fail 503) so an agent never silently operates on throwaway mock data. (Consistent with the prior change's resolved decision "no mock from MCP".)
5. **Signed-URL cookie coupling.** `getSignedDocumentUrl` (and everything that uses it: `getServiceWithChecklist`, `getServiceChecklistForTrip`, `getClientDocuments`, etc.) is cookie/anon-based and returns `null` from MCP. A service-role signed-URL helper is required for any download-capable tool.
6. **Bucket/RLS.** Bucket is `trip-documents` (private). Storage policy and table RLS are `auth.uid() is not null`. Service-role bypasses both — but only if the route builds the service-role client; the anon/cookie client is denied. No schema change is needed; the service-role key must be present in the deployed environment.
7. **`getServiceWithChecklist` uses cookie client for signed URLs even when `getServiceClient()` used service-role for the query.** (See §3.2.) Any MCP tool returning checklist items with `url` must use the admin signed-URL helper, otherwise download URLs are `null`/missing.

---

## 6. Recommendation

Proceed to **propose**. Port only the MCP *plumbing* that is reusable (`auth.ts`, `errors.ts`, `utils.ts`) verbatim; rewrite the route + tool layer against main's modular data layer; **drop** `supabase-store.ts` (AsyncLocalStorage) and the trailing-`supabase` injection entirely. Add `@modelcontextprotocol/sdk` (pin `1.30.0`), a `MCP_API_KEY` Bearer gate, and `runtime = "nodejs"`. Add one new service-role signed-URL helper for downloads. Implement the requested `process_service_upload` tool by wrapping `markUploadProcessed` **plus** a re-implemented archived-trip/ownership guard (since the existing guard is Server-Action-bound). The single hardest historical blocker (service-role client injection) is already resolved in main via `getSupabaseAdmin()`.

### Ready for Proposal
**Yes.** The proposal should finalize: (a) exact tool subset (recommend the 7 tools above, upload deferred), (b) how the archived-trip/ownership guard is expressed in the MCP layer, (c) whether the signed-URL helper is a new function or an optional param on `getSignedDocumentUrl`, and (d) scope confirmation that checklist/upload *mutation* tools (add/update/delete/reorder) and `uploadServiceDocument` are out of scope for this change.
