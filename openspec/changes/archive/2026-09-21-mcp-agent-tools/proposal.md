# Proposal: MCP Agent-Action Tools (port 41 tools to main MCP server)

**Change slug:** `mcp-agent-tools`
**Phase:** propose
**Status:** ready for spec + design
**Base:** `feat/mcp-agent-tools` (fresh from `main`, which already ships the MCP base + 7 service-document tools)

## 1. Why

`main` already exposes a hosted MCP server (`POST /api/mcp`) over Streamable HTTP, authenticated by `MCP_API_KEY` and gated on the Supabase service role. Its only tool surface today is the 7 **service-document** tools (`service-documents.ts`).

The prior branch `feat/mcp-server-agent-actions` built 41 **agent-action** tools (clients, suppliers, trips, trip days, items, packing, internal notes, documents) that let an external AI agent perform the same mutations a human travel agent performs in the dashboard — create/update clients and suppliers, build and edit trip itineraries, manage packing lists and internal notes, and obtain a pre-signed document upload URL. That branch predates the current modular data layer and carried machinery (`supabase-store.ts`, AsyncLocalStorage, a trailing injected `supabase` argument, old `textResult`/`unexpectedError` semantics) that no longer matches `main`.

This change ports those 41 tools onto the current MCP server so the deployed server exposes the **full agent surface (48 tools)** with the existing auth, service-role gate, and modular data layer — reusing `main`'s `utils.ts` and `errors.ts` unchanged. 40 of 41 tools map 1:1 to existing main data functions; one (`get_document_upload_url`) needs a new service-role upload-signing helper.

This is not a UI change and does not touch the dashboard, public `/t/[slug]`/`/c/[slug]` routes, RLS, or schema.

## 2. What Changes

- **8 new tool modules** under `src/lib/mcp/tools/`: `clients.ts` (7), `suppliers.ts` (6), `trips.ts` (9), `tripDays.ts` (6), `items.ts` (7), `packing.ts` (3), `internalNotes.ts` (2), `documents.ts` (1). Each exports a `register*Tools(server: McpServer)` function.
- **Registration** in `src/lib/mcp/server.ts`: the 8 new modules are registered alongside the existing `registerServiceDocumentTools(server)` — 48 tools total, no name collisions.
- **One new data helper**: `getSignedServiceDocumentUploadUrl(path, expiresIn?)` in `src/lib/data/documents.ts`, mirroring the existing `getSignedServiceDocumentDownloadUrl` but using service-role `createSignedUploadUrl` (presigned PUT). This closes the `get_document_upload_url` gap.
- **Adaptation pattern (confirmed, applied to all 41 tools):**
  1. Call `data.fn()` **directly** — no `getMcpSupabaseClient()`, no trailing `supabase` arg, no `supabase-store.ts` (do not port it). The route already gates on `validateMcpApiKey()` → `canUseServiceRole()`.
  2. Object payloads use `success(result)` (JSON-stringifies `unknown`), **not** `textResult` (string-only on main).
  3. Per-tool not-found mapping is preserved via `safeMessage` / `isNotFoundMessage` + `notFound(resource, id)`; `unexpectedError(_err)` (generic, ignores arg) is used for unexpected failures only. Mirror the `guardFailure` helper style already in `service-documents.ts`.
  4. `create_trip` / `create_trip_from_template` keep slug generation (see resolved questions).
- **No changes** to `utils.ts`, `errors.ts`, `auth.ts`, the route handler, RLS, migrations, or existing data functions (except the one added upload-signing helper).

## 3. Scope

### IN scope

- 8 new tool modules + `server.ts` registration (41 tools).
- `getSignedServiceDocumentUploadUrl(path, expiresIn?)` in `src/lib/data/documents.ts` (service-role presigned PUT URL).
- Reuse `main`'s `utils.ts` and `errors.ts` unchanged.
- Zod schemas for all 41 tools; RFC 2119 requirement language in the delta specs; Given/When/Then scenarios.

### OUT of scope

- Schema/migration changes.
- RLS policy changes.
- Dashboard / public-route (`/t/[slug]`, `/c/[slug]`) changes.
- Binary upload round-trip (actual bytes through MCP tool arguments).
- Prompts/Resources, OpenAPI bridge, fine-grained per-tool RBAC / multiple keys.
- `supabase-store.ts` / AsyncLocalStorage — explicitly NOT ported.

### Deferred / later slices

- Actual binary upload tooling (base64/bytes via MCP), likely using the presigned PUT URL returned by `get_document_upload_url` plus a client-side Storage upload.
- Per-tool scopes / multiple agent identities.
- Prompts/Resources and OpenAPI bridge.

### Resolved open questions

1. **`get_document_upload_url` gap → add `getSignedServiceDocumentUploadUrl`.** Feasible: `main` already has `getSupabaseAdmin()` and the exact `getSignedServiceDocumentDownloadUrl` pattern to mirror. `expiresIn` is **metadata-only** (`@supabase/storage-js` `createSignedUploadUrl` does not accept an expiry; the server applies token TTL). The tool returns `{ uploadUrl, expiresIn }`, with `expiresIn` defaulting to `300`. We adopt the add-helper path (not deferral).
2. **Mechanical drift corrections → applied.** Object payloads use `success()`; per-tool `notFound(resource, id)` mapping is preserved (main's `unexpectedError` no longer maps not-found); slug generation stays in the tools via `@/lib/slugify` (`slugify(title) || "viaje"` + a `Date.now().toString(36)` uniqueness suffix, matching `src/app/dashboard/trips/new/actions.ts`).
3. **`create_trip_from_template` optional `clientIds` → require `clientIds` (min 1) in BOTH tools.** Main's `createTrip()` throws `"Se requiere al menos un cliente para crear el viaje"` when `clientIds.length < 1 && !isTemplate`, and `createTripFromTemplate()` reuses `createTrip()` with `isTemplate` unset. A template copy with no clients would throw a late business error. To keep the schema honest and consistent with the data-layer invariant (every non-template trip has ≥1 client), both `create_trip` and `create_trip_from_template` declare `clientIds: string[]` **required, min 1** in their Zod schemas. This is a deliberate tightening of the old branch's schema (which allowed optional `clientIds` on `create_trip_from_template`); the old branch could get away with it because its `createTrip` did not enforce the ≥1-client rule.
4. **Mock lockout → confirmed, no per-tool guard.** The route's `canUseServiceRole()` 503 gate (in `src/app/api/mcp/route.ts`, applied before `createMcpServer()`) already prevents any MCP request from reaching the data layer when the service role is absent, so mock-data fallback is unreachable from MCP. No per-tool mock guard is added; this matches the existing `mcp-server` requirement "No mock-data fallback from MCP".

## 4. Capabilities

> Contract with `sdd-spec`. New capabilities each get a full delta spec under `openspec/changes/mcp-agent-tools/specs/<name>/spec.md` and become `openspec/specs/<name>/spec.md` at archive. Modified capabilities get delta specs replacing the matching requirement blocks.

### New Capabilities

- `mcp-client-tools`: 7 tools for client CRUD, client tags, and a client's trips/summary (`list_clients`, `get_client`, `create_client`, `update_client`, `get_client_tags`, `set_client_tags`, `get_client_trips`).
- `mcp-supplier-tools`: 6 tools for supplier CRUD and soft-delete/restore (`list_suppliers`, `get_supplier`, `create_supplier`, `update_supplier`, `delete_supplier`, `restore_supplier`).
- `mcp-trip-tools`: 9 tools for trips, templates, trip clients and trip tags (`list_trips`, `get_trip`, `create_trip`, `create_trip_from_template`, `update_trip`, `set_trip_clients`, `set_trip_tags`, `save_trip_as_template`, `list_templates`).
- `mcp-trip-day-tools`: 6 tools for trip days (`add_trip_day`, `update_trip_day`, `delete_trip_day`, `restore_trip_day`, `generate_trip_days`, `reorder_trip_days`).
- `mcp-item-tools`: 7 tools for itinerary items (`add_item`, `update_item`, `delete_item`, `restore_item`, `move_item`, `duplicate_item`, `reorder_items`).
- `mcp-packing-tools`: 3 tools for packing lists (`add_packing_item`, `update_packing_item`, `delete_packing_item`).
- `mcp-internal-notes-tools`: 2 tools for agent-only trip internal notes (`get_trip_internal_notes`, `update_trip_internal_notes`).
- `mcp-document-tools`: 1 tool for a presigned document upload URL (`get_document_upload_url`).

### Modified Capabilities

- `mcp-server`: the "Native tool discovery" requirement currently states the tool-listing operation returns "exactly the registered service-document tools". It MUST be modified to reflect the full 48-tool surface (7 service-document + 41 agent-action) so the discovery spec matches the deployed server.

### Unchanged Capabilities

- `mcp-service-document-tools`: the 7 existing tools and their requirements are unchanged; no delta spec needed.

## 5. Full tool surface (48 tools)

Legend: **7 existing** (service-document) + **41 new** (agent-action). Each new tool maps to a main data function (called directly, no trailing client).

| # | Tool | Module | Data function (main) | Status |
|---|------|--------|----------------------|--------|
| 1 | `list_services` | service-documents | `getServicesForTrip(tripId)` | existing |
| 2 | `get_service_checklist` | service-documents | `getServiceChecklistForTrip(tripId, serviceId)` | existing |
| 3 | `get_service_document_summaries` | service-documents | `getServiceDocumentSummariesForTrip(tripId)` | existing |
| 4 | `get_service_upload_download_url` | service-documents | `getSignedServiceDocumentDownloadUrl(path, expiresIn)` | existing |
| 5 | `process_service_upload` | service-documents | `assertServiceUploadMutable` + `markUploadProcessed(uploadId)` | existing |
| 6 | `mark_service_upload_reviewed` | service-documents | `assertServiceUploadMutable` + `markUploadReviewed(uploadId)` | existing |
| 7 | `request_service_upload_reupload` | service-documents | `assertServiceUploadMutable` + `requestReUpload(uploadId, comment)` | existing |
| 8 | `list_clients` | clients | `getClients({page,pageSize})` | new |
| 9 | `get_client` | clients | `getClientById(id)` | new |
| 10 | `create_client` | clients | `createClient(input)` | new |
| 11 | `update_client` | clients | `getClientById` + `updateClient(id, input)` | new |
| 12 | `get_client_tags` | clients | `getClientTags(clientId)` | new |
| 13 | `set_client_tags` | clients | `setClientTags(clientId, tagIds)` | new |
| 14 | `get_client_trips` | clients | `getTripsByClientId(clientId)` + `getClientTripSummary(clientId)` | new |
| 15 | `list_suppliers` | suppliers | `getSuppliers({page,pageSize,query,type,tag})` | new |
| 16 | `get_supplier` | suppliers | `getSupplierById(id)` | new |
| 17 | `create_supplier` | suppliers | `createSupplier(input)` | new |
| 18 | `update_supplier` | suppliers | `getSupplierById` + `updateSupplier(id, input)` | new |
| 19 | `delete_supplier` | suppliers | `getSupplierById` + `softDeleteSupplier(id, force?)` | new |
| 20 | `restore_supplier` | suppliers | `restoreSupplier(id)` | new |
| 21 | `list_trips` | trips | `getTripsWithClients({page,pageSize,filters})` | new |
| 22 | `get_trip` | trips | `getTripById(id)` | new |
| 23 | `create_trip` | trips | `createTrip(input)` (slug via `@/lib/slugify`) | new |
| 24 | `create_trip_from_template` | trips | `createTripFromTemplate(templateId, input)` (slug via `@/lib/slugify`) | new |
| 25 | `update_trip` | trips | `getTripById` + `updateTrip(id, input)` | new |
| 26 | `set_trip_clients` | trips | `setTripClients(tripId, clientIds)` | new |
| 27 | `set_trip_tags` | trips | `setTripTags(tripId, tagIds)` | new |
| 28 | `save_trip_as_template` | trips | `getTripById` + `saveTripAsTemplate(tripId, title)` | new |
| 29 | `list_templates` | trips | `getTemplates()` | new |
| 30 | `add_trip_day` | tripDays | `createTripDay(input)` | new |
| 31 | `update_trip_day` | tripDays | `updateTripDay(id, input)` | new |
| 32 | `delete_trip_day` | tripDays | `deleteTripDay(id)` | new |
| 33 | `restore_trip_day` | tripDays | `restoreTripDay(id)` | new |
| 34 | `generate_trip_days` | tripDays | `generateTripDays(tripId)` | new |
| 35 | `reorder_trip_days` | tripDays | `reorderTripDays(order)` | new |
| 36 | `add_item` | items | `createItem(input)` | new |
| 37 | `update_item` | items | `updateItem(id, input)` | new |
| 38 | `delete_item` | items | `deleteItem(id)` | new |
| 39 | `restore_item` | items | `restoreItem(id)` | new |
| 40 | `move_item` | items | `moveItemToDay(itemId, targetDayId)` | new |
| 41 | `duplicate_item` | items | `getItemById` + `duplicateItem(itemId, destDayId)` | new |
| 42 | `reorder_items` | items | `reorderItems(order)` | new |
| 43 | `add_packing_item` | packing | `createPackingItem(input)` | new |
| 44 | `update_packing_item` | packing | `updatePackingItem(id, input)` | new |
| 45 | `delete_packing_item` | packing | `deletePackingItem(id)` | new |
| 46 | `get_trip_internal_notes` | internalNotes | `getTripById` + `getTripInternalNotes(id)` | new |
| 47 | `update_trip_internal_notes` | internalNotes | `getTripById` + `updateTripInternalNotes(id, notes)` | new |
| 48 | `get_document_upload_url` | documents | `getSignedServiceDocumentUploadUrl(path, expiresIn?)` **(new helper)** | new |

## 6. Impact (files)

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/mcp/tools/clients.ts` | New | 7 client tools |
| `src/lib/mcp/tools/suppliers.ts` | New | 6 supplier tools |
| `src/lib/mcp/tools/trips.ts` | New | 9 trip/template tools |
| `src/lib/mcp/tools/tripDays.ts` | New | 6 trip-day tools |
| `src/lib/mcp/tools/items.ts` | New | 7 item tools |
| `src/lib/mcp/tools/packing.ts` | New | 3 packing tools |
| `src/lib/mcp/tools/internalNotes.ts` | New | 2 internal-notes tools |
| `src/lib/mcp/tools/documents.ts` | New | 1 document upload-URL tool |
| `src/lib/mcp/server.ts` | Modified | Register the 8 new modules alongside service-document tools |
| `src/lib/data/documents.ts` | Modified | Add `getSignedServiceDocumentUploadUrl(path, expiresIn?)` |
| `src/lib/mcp/tools/utils.ts` | Unchanged | Reused (`textResult`, `safeMessage`, `isNotFoundMessage`, `unexpectedError`) |
| `src/lib/mcp/errors.ts` | Unchanged | Reused (`success`, `notFound`, `mcpError`) |
| `src/app/api/mcp/route.ts` | Unchanged | Auth + service-role gate already present |
| `src/lib/mcp/auth.ts` | Unchanged | Reused |
| `openspec/specs/mcp-server/spec.md` | Modified (at archive) | Update tool-discovery count (48 tools) |
| `openspec/specs/mcp-*-tools/spec.md` | New (at archive) | 8 new capability specs |

## 7. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `textResult` string-only drift silently emits `[object Object]` for object payloads | High | Mechanical rule applied to all 8 modules: object/array/scalar payloads go through `success()`; only already-string messages use `textResult`. Specs assert JSON-encoded success envelopes. |
| `unexpectedError` no longer maps not-found → generic errors hide "resource missing" | Medium | Preserve per-tool `notFound(resource, id)` mapping via `safeMessage` + `isNotFoundMessage` (mirror `service-documents.ts` `guardFailure`). Specs require not-found results to name the resource and caller-supplied id. |
| `create_trip` / `create_trip_from_template` throw without a generated slug (`CreateTripInput.slug` is required) | Medium | Tools generate `slugify(title) || "viaje"` + `Date.now().toString(36)` suffix before calling `createTrip`/`createTripFromTemplate` (same pattern as `dashboard/trips/new/actions.ts`). |
| `create_trip_from_template` empty `clientIds` throws a late business error | Medium | Zod schema requires `clientIds` (min 1) on both tools; validation fails before the data layer. |
| `get_document_upload_url` gap — new service-role upload-signing helper | Low | Add `getSignedServiceDocumentUploadUrl` mirroring the existing download helper; `expiresIn` is metadata-only. Deferral to spec/design if storage-js API surprises. |
| Service-role key exposure via new upload-signing helper | Low | `getSupabaseAdmin()` is server-only (`@/lib/supabase/server`), never referenced in client bundles; no key returned in any tool result; `unexpectedError` suppresses raw messages. |
| `setTripTags` relocated to `clients.ts` (barrel-exported) → import confusion | Low | Import from the `@/lib/data` barrel (`data.setTripTags`); barrel already re-exports `clients.ts`. |
| `softDeleteSupplier` return-shape change (`{ok, itemCount}`) | Low | Tool reads `result.ok` / `result.itemCount` directly; no pre-check of item count needed in the tool. |

## 8. Rollback plan

- The change is additive to the MCP surface and touches one existing data file (`documents.ts`). Revert by removing the 8 new tool modules, restoring `server.ts` to register only `registerServiceDocumentTools`, and deleting `getSignedServiceDocumentUploadUrl` from `documents.ts`.
- No schema, migration, RLS, or route changes exist, so rollback carries no database or policy risk. A redeploy of the prior commit restores the 7-tool surface.
- The `mcp-server` delta spec (tool-discovery count) is the only modified main spec; if the change is rolled back, that spec edit is also reverted at archive time.

## 9. Success criteria

- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes (existing suite unaffected; no regressions in the data layer).
- [ ] `createMcpServer()` registers exactly 48 tools (7 service-document + 41 agent-action) with no name collisions, verified via the native `listTools` output.
- [ ] Each of the 41 new tools calls its data function directly (no trailing client arg, no AsyncLocalStorage), and object payloads round-trip as JSON through `success()`.
- [ ] `get_document_upload_url` returns a valid presigned PUT URL for a known path when the service role is configured.
- [ ] Not-found failures surface `NOT_FOUND: <resource> <id>` (not a generic error) for the tools that must map them.
- [ ] `create_trip` and `create_trip_from_template` reject empty `clientIds` at schema validation and generate a slug before persisting.
