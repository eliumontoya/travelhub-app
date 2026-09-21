# Exploration: Port 41 MCP agent-action tools → main modular data layer

## Current State

- **Target branch**: `feat/mcp-agent-tools` (created from `main`). Working tree is clean.
- **Current MCP surface on main** (`src/lib/mcp/`):
  - `route.ts` (`src/app/api/mcp/route.ts`): gate order = `validateMcpApiKey()` (401) → `canUseServiceRole()` (503) → `createMcpServer()` + Streamable HTTP transport. **No AsyncLocalStorage.**
  - `auth.ts`: `isMcpApiKeyConfigured()`, `validateMcpApiKey()` (timing-safe, comma-separated allow-list).
  - `errors.ts`: `success(content: unknown)`, `notFound(resource, id)`, `mcpError(message)`.
  - `server.ts`: `createMcpServer()` registers **only** `registerServiceDocumentTools(server)` (7 tools).
  - `tools/service-documents.ts`: 7 tools; calls data functions directly (`getServicesForTrip(tripId)`, etc.), resolves clients internally, uses `safeCall` + `guardFailure` + `success`/`unexpectedError`.
  - `tools/utils.ts`: `textResult(text: string)` (**string-only**), `safeMessage`, `isNotFoundMessage`, `unexpectedError(_err)` (returns generic "An unexpected error occurred", ignores arg).
- **Data layer on main** (`src/lib/data/*` + barrel `src/lib/data.ts`): modules resolve the Supabase client internally via `createServerSupabase()` (`@/lib/supabase/server` → `createClient()`), `getSupabaseAdmin()` (service role), and `canUseServiceRole()`/`isSupabaseConfigured()`. **No data function takes a trailing `supabase` argument.**
- **Old branch** `feat/mcp-server-agent-actions`: 8 tool modules + `supabase-store.ts` (AsyncLocalStorage `getMcpSupabaseClient()` + `runWithMcpSupabase`). Every tool called `data.fn(args, supabase)` with a trailing client and used old `textResult(unknown)` (JSON-stringifies non-strings) and old `unexpectedError(err)` (maps "no encontrado" → "NOT_FOUND").

## The 41 tools and their data functions

Legend: ✅ exists on main with compatible signature · ⚠️ exists but signature/shape differs · ❌ missing.

### clients.ts (7 tools)

| Tool | Zod inputs | Data fn (old call) | Main resolution |
|---|---|---|---|
| `list_clients` | page?, pageSize? | `getClients({page,pageSize}, supabase)` | ✅ `getClients(params: PaginationParams = {})` |
| `get_client` | id | `getClientById(id, supabase)` | ✅ `getClientById(id): Promise<Client\|null>` |
| `create_client` | name, email?, phone?, notes?, referralSource?, birthDate?, coverImageUrl? | `createClient(input, supabase)` | ✅ `createClient(input: CreateClientInput)` |
| `update_client` | id + partial | `getClientById` + `updateClient(id, input, supabase)` | ✅ `updateClient(id, input: Partial<CreateClientInput>)` |
| `get_client_tags` | clientId | `getClientTags(clientId, supabase)` | ✅ `getClientTags(clientId): Promise<Tag[]>` |
| `set_client_tags` | clientId, tagIds[] | `setClientTags(clientId, tagIds, supabase)` | ✅ `setClientTags(clientId, tagIds)` |
| `get_client_trips` | clientId | `getTripsByClientId` + `getClientTripSummary` (Promise.all) | ✅ both `(clientId): Promise<…>` (trips.ts:321,360) |

### suppliers.ts (6 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `list_suppliers` | `getSuppliers({page,pageSize,query,type,tag}, supabase)` | ✅ `getSuppliers(params: SupplierFilterParams = {})` — `{page,pageSize,query,type,tag}` matches exactly |
| `get_supplier` | `getSupplierById(id, supabase)` | ✅ |
| `create_supplier` | `createSupplier(input, supabase)` | ✅ `createSupplier(input: CreateSupplierInput)` |
| `update_supplier` | `getSupplierById` + `updateSupplier(id, input, supabase)` | ✅ `updateSupplier(id, input: Partial<CreateSupplierInput>)` |
| `delete_supplier` | `getSupplierById` + `softDeleteSupplier(id, force, supabase)` | ✅ `softDeleteSupplier(id, force?): Promise<{ok, itemCount?}>` — return shape matches `result.ok`/`result.itemCount` |
| `restore_supplier` | `restoreSupplier(id, supabase)` | ✅ `restoreSupplier(id): Promise<void>` |

### trips.ts (9 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `list_trips` | `getTripsWithClients({page,pageSize,filters:{query,status[],currency,clientIds[],tagIds[],dateFrom,dateTo}}, supabase)` | ✅ `getTripsWithClients(params: TripsWithClientsParams)` — `{filters?: Partial<TripFilters>}` matches |
| `get_trip` | `getTripById(id, supabase)` | ✅ `getTripById(id): Promise<TripWithDetails\|null>` |
| `create_trip` | `createTrip({clientIds,title,slug,startDate,endDate,instructions,travelerCount,tagIds,currency,isTemplate}, supabase)` | ✅ `createTrip(input: CreateTripInput)` — `slug` is **required**; tool must keep `generateTripSlug()` via `@/lib/slugify` (exists on main) |
| `create_trip_from_template` | `getTripById` + `createTripFromTemplate(templateId,{title,slug,clientIds,startDate,endDate}, supabase)` | ✅ `createTripFromTemplate(templateId, input: CreateTripInput)` — ⚠️ see semantic note |
| `update_trip` | `getTripById` + `updateTrip(id, input, supabase)` | ✅ `updateTrip(id, input: UpdateTripInput)` — all fields (budget/salePrice/commissionRate/showCostsToClient/status/currency/coverImageUrl null) present |
| `set_trip_clients` | `setTripClients(tripId, clientIds, supabase)` | ✅ `setTripClients(tripId, clientIds)` |
| `set_trip_tags` | `setTripTags(tripId, tagIds, supabase)` | ✅ `setTripTags(tripId, tagIds)` — now lives in `clients.ts` (barrel-exported) |
| `save_trip_as_template` | `getTripById` + `saveTripAsTemplate(tripId, title, supabase)` | ✅ `saveTripAsTemplate(tripId, title): Promise<Trip>` (trips.ts:997) |
| `list_templates` | `getTemplates(supabase)` | ✅ `getTemplates(): Promise<Trip[]>` (trips.ts:68) |

### tripDays.ts (6 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `add_trip_day` | `createTripDay({tripId,date,notes,sortOrder}, supabase)` | ✅ `createTripDay(input: CreateTripDayInput)` |
| `update_trip_day` | `updateTripDay(id, input, supabase)` | ✅ `updateTripDay(id, input: UpdateTripDayInput)` |
| `delete_trip_day` | `deleteTripDay(id, supabase)` | ✅ |
| `restore_trip_day` | `restoreTripDay(id, supabase)` | ✅ |
| `generate_trip_days` | `generateTripDays(tripId, supabase)` | ✅ `generateTripDays(tripId): Promise<GenerateTripDaysResult>` |
| `reorder_trip_days` | `reorderTripDays(order, supabase)` | ✅ `reorderTripDays(order: {id,sortOrder}[])` |

### items.ts (7 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `add_item` | `createItem(input, supabase)` | ✅ `createItem(input: CreateItemInput)` — enum `flight\|hotel\|activity\|restaurant\|transport\|note` matches `ItemType` exactly |
| `update_item` | `updateItem(id, input, supabase)` | ✅ `updateItem(id, input: UpdateItemInput)` |
| `delete_item` | `deleteItem(id, supabase)` | ✅ |
| `restore_item` | `restoreItem(id, supabase)` | ✅ |
| `move_item` | `moveItemToDay(itemId, targetDayId, supabase)` | ✅ `moveItemToDay(itemId, targetDayId)` |
| `duplicate_item` | `getItemById` + `duplicateItem(itemId, destDayId, supabase)` | ✅ `getItemById(id): Promise<Item\|null>` + `duplicateItem(sourceItemId, targetDayId)` |
| `reorder_items` | `reorderItems(order, supabase)` | ✅ `reorderItems(order: {id,sortOrder}[])` |

### packing.ts (3 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `add_packing_item` | `createPackingItem({tripId,label,sortOrder}, supabase)` | ✅ `createPackingItem(input: CreatePackingItemInput)` |
| `update_packing_item` | `updatePackingItem(id, input, supabase)` | ✅ `updatePackingItem(id, input)` |
| `delete_packing_item` | `deletePackingItem(id, supabase)` | ✅ |

### internalNotes.ts (2 tools)

| Tool | Data fn | Main resolution |
|---|---|---|
| `get_trip_internal_notes` | `getTripById` + `getTripInternalNotes(id, supabase)` | ✅ `getTripInternalNotes(id): Promise<string\|null>` |
| `update_trip_internal_notes` | `getTripById` + `updateTripInternalNotes(id, notes, supabase)` | ✅ `updateTripInternalNotes(id, internalNotes: string\|null)` |

### documents.ts (1 tool)

| Tool | Data fn | Main resolution |
|---|---|---|
| `get_document_upload_url` | `getSignedDocumentUploadUrl(path, expiresIn, supabase)` | ❌ **MISSING** — see GAPS |

**Total: 40/41 map to existing main data functions; 1 gap.**

## GAPS (critical)

### 1. `get_document_upload_url` → `getSignedDocumentUploadUrl` is MISSING on main

- Old impl (old `src/lib/data.ts:2898`): `getSignedDocumentUploadUrl(path, expiresIn=300, supabase?)` used `client.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path, { upsert: false })`, returning `signedUrl` or `null`. `expiresIn` was metadata only (`@supabase/storage-js` `createSignedUploadUrl` does **not** accept expiry; server applies token TTL).
- Main `src/lib/data/documents.ts` has only:
  - `getSignedDocumentUrl(path)` — cookie/anon **download** URL (`createSignedUrl`, 3600s).
  - `getSignedServiceDocumentDownloadUrl(path, expiresIn=3600)` — service-role **download** URL via `getSupabaseAdmin()`.
- **Feasibility**: upload-by-presigned-URL is fully feasible. Main already has `getSupabaseAdmin()` and the exact `getSignedServiceDocumentDownloadUrl` pattern to mirror. The recommended fix is to add `getSignedServiceDocumentUploadUrl(path, expiresIn?)` to `documents.ts` using `getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path, { upsert: false })`, and remap the tool to it.
- **Alternative**: defer/remap `get_document_upload_url` out of scope if upload is not needed yet (upload is currently handled by the service-documents flow via direct upload, not presigned URL).

## Adaptation pattern (confirmed)

On main the tools should call `data.fn()` **directly**:

1. **Drop `getMcpSupabaseClient()` + trailing `supabase` arg + `supabase-store.ts`** entirely. Main's route gates on auth + `canUseServiceRole()`, and every data function resolves its client internally. Do **not** port `supabase-store.ts`.
2. **`textResult` drift**: old `textResult(value: unknown)` JSON-stringified non-strings; main's `textResult(text: string)` is string-only. Ported tools that returned object payloads via `textResult(result)` must switch to `success(result)` (from `errors.ts`, JSON-stringifies `unknown`).
3. **`unexpectedError` drift**: main's `unexpectedError(_err)` returns a fixed generic string and ignores the arg. The old inline `catch (err) { if message includes "no encontrado" → notFound(...) }` pattern must be kept, using main's `safeMessage`/`isNotFoundMessage` + `notFound(resource, id)`. Mirror the `guardFailure` helper style already present in `service-documents.ts`.
4. **`create_trip` / `create_trip_from_template` keep slug generation**: `CreateTripInput.slug` is required; ported tools must keep `generateTripSlug()` using `@/lib/slugify` (present on main).
5. **Enums verified**: `ItemType` (6 values), `TripStatus` (3), `TripCurrency` (3) match the old Zod schemas exactly — no schema change needed.

### Semantic note (needs design decision)

`create_trip_from_template` declares `clientIds` optional, but `createTrip()` throws `"Se requiere al menos un cliente para crear el viaje"` when `clientIds.length < 1 && !isTemplate`. A template copy (`isTemplate: false`) with no clientIds will throw. Decide: require `clientIds` (min 1) in the tool schema, or keep optional and surface the business error. (Old branch likely allowed empty clientIds because old `createTrip` did not enforce the ≥1-client rule.)

## Target registration (`src/lib/mcp/server.ts`)

`createMcpServer()` must register the 8 new modules **alongside** the existing service-document tools:

```ts
registerServiceDocumentTools(server); // existing (7)
registerClientTools(server);          // +7  = 14
registerSupplierTools(server);        // +6  = 20
registerTripTools(server);            // +9  = 29
registerTripDayTools(server);         // +6  = 35
registerItemTools(server);            // +7  = 42
registerPackingTools(server);         // +3  = 45
registerInternalNoteTools(server);    // +2  = 47
registerDocumentTools(server);        // +1  = 48
```

**Total 48 tools** (7 service-document + 41 agent-action). No tool-name collisions between the two families.

New files to create under `src/lib/mcp/tools/`: `clients.ts`, `suppliers.ts`, `trips.ts`, `tripDays.ts`, `items.ts`, `packing.ts`, `internalNotes.ts`, `documents.ts` (each exporting a `register*Tools(server: McpServer)` function). `utils.ts` and `errors.ts` already exist on main and are reused unchanged.

## Risks

1. **`get_document_upload_url` GAP** — must add `getSignedServiceDocumentUploadUrl` (feasible, mirror the download helper) or defer the tool. This is the only missing data function.
2. **`textResult` string-only drift** — ported tools that JSON-stringified objects through the old `textResult` will silently emit `[object Object]`/type errors unless switched to `success()`. High-impact mechanical change across all 8 modules.
3. **`create_trip_from_template` optional-client semantic** — may throw on empty `clientIds`; needs an explicit schema/behavior decision.
4. **`unexpectedError` no longer maps not-found** — must preserve per-tool `notFound(resource, id)` mapping (main's `unexpectedError` drops the message). Ported tools that relied on the old auto-"NOT_FOUND" mapping would otherwise return generic errors.
5. **Mock-mode behavior** — data functions fall back to in-memory `mock-data.ts` when `!isSupabaseConfigured()`, but the MCP route 503s unless `canUseServiceRole()`. Service-role signing helpers (`getSupabaseAdmin()`) throw when no service role. Behavior is consistent but worth noting: MCP effectively always runs against Supabase.
6. **Renamed/relocated functions** — `setTripTags` moved to `clients.ts` (barrel-exported, so `data.setTripTags` still resolves). `softDeleteSupplier` now performs the item-count check internally (returns `{ok, itemCount}`), matching the old tool's `result.ok`/`result.itemCount` usage.

## Ready for Proposal

**Yes.** The port is overwhelmingly mechanical: 40/41 tools map 1:1 to existing main data functions; only `get_document_upload_url` needs a new upload-signing helper (or deferral). The orchestrator should carry forward: (a) the upload-gap decision, (b) the `textResult→success` conversion, and (c) the `create_trip_from_template` clientIds rule into `sdd-propose`.
