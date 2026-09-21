# Design: MCP Agent-Action Tools (port 41 tools to main MCP server)

**Change slug:** `mcp-agent-tools`
**Phase:** design
**Base:** `feat/mcp-agent-tools` (fresh from `main`)

## Technical Approach

Port the 41 agent-action tools from the legacy branch `feat/mcp-server-agent-actions` onto `main`'s current MCP server, so the deployed `POST /api/mcp` surface grows from 7 service-document tools to the full 48-tool agent surface. The port is **overwhelmingly mechanical**: every tool becomes a thin adapter that calls a `data.fn()` **directly** (no injected Supabase client, no AsyncLocalStorage) and maps the result into `main`'s `errors.ts` envelope (`success` / `notFound` / `mcpError` / `unexpectedError`).

The only genuinely new surface is:

1. **8 new tool modules** under `src/lib/mcp/tools/` (one per domain, each exporting a `register*Tools(server)` function), wired into `createMcpServer()`.
2. **One new data helper** `getSignedServiceDocumentUploadUrl(path, expiresIn?)` in `src/lib/data/documents.ts`, closing the single data-layer gap (`get_document_upload_url`). It mirrors the existing `getSignedServiceDocumentDownloadUrl` but uses service-role `createSignedUploadUrl` (presigned PUT).

Everything else — the Streamable HTTP route, `MCP_API_KEY` auth, the `canUseServiceRole()` 503 gate, `utils.ts`, `errors.ts`, `auth.ts`, RLS, and the modular data layer — is reused **unchanged**. The proposal and exploration already verified 40/41 tools map 1:1 to existing `main` data functions; the 41st is the upload-signing gap.

## Architecture Note (reuse vs. new surface)

The transport, auth, and service-role gating are **already complete** on `main`:

- `src/app/api/mcp/route.ts` — gate order `validateMcpApiKey()` (401) → `canUseServiceRole()` (503) → `createMcpServer()` + `WebStandardStreamableHTTPServerTransport`. No AsyncLocalStorage. This is the **single security boundary**; the new tool modules add no auth or gating of their own and rely entirely on it.
- `src/lib/mcp/errors.ts` — `success(content: unknown)` (JSON-stringifies), `notFound(resource, id)`, `mcpError(message)`.
- `src/lib/mcp/tools/utils.ts` — `textResult(text: string)` (**string-only**), `safeMessage`, `isNotFoundMessage`, `unexpectedError(_err)` (fixed generic string).
- `src/lib/data/*` — every data function resolves its Supabase client internally (`createServerSupabase()` / `getSupabaseAdmin()`); none take a trailing client argument.

Consequently, the legacy machinery (`supabase-store.ts`, `getMcpSupabaseClient()`, `runWithMcpSupabase`, trailing `supabase` args, the old string-tolerant `textResult`, the old not-found-mapping `unexpectedError`) is **explicitly NOT ported**. The new modules are pure "data-layer wiring," structurally identical to `service-documents.ts`.

## Architecture Decisions

### Decision: Drop AsyncLocalStorage / injected client; call `data.fn()` directly

**Choice**: Tools call `data.fn(args)` with no trailing client and no `getMcpSupabaseClient()`; `supabase-store.ts` is not ported.
**Alternatives considered**: Port `supabase-store.ts` + AsyncLocalStorage `runWithMcpSupabase` so the old branch's tool bodies survive nearly verbatim; or thread an explicit client through the route.
**Rationale**: `main`'s route already gates on `canUseServiceRole()` before `createMcpServer()`, and every data function resolves its own client internally. Re-introducing the store would duplicate gating that already lives at the route, add a request-scoped mutable global, and diverge from the established `service-documents.ts` pattern. Direct calls keep the modules stateless and testable.

### Decision: Object payloads via `success()`, not `textResult()`

**Choice**: All object/array/structured payloads return `success(result)`; only already-string messages (none in these 41 tools) would use `textResult`.
**Alternatives considered**: Keep the old branch's `textResult(result)`.
**Rationale**: `main`'s `textResult(text: string)` is typed string-only; passing an object would emit `"[object Object]"` at runtime. `success(content: unknown)` JSON-stringifies any shape, producing the same JSON envelope the MCP client already expects. This is a mechanical rule applied uniformly across all 8 modules (see Error-Mapping Strategy).

### Decision: Preserve per-tool `notFound` mapping; sanitize everything else

**Choice**: For null-returning getters, map `null` → `notFound(resource, id)`. For throws, catch and route via `safeMessage` + `isNotFoundMessage` → `notFound(resource, id)`, otherwise `unexpectedError(err)`. Reuse the local `guardFailure`/`safeCall` helper style from `service-documents.ts`.
**Alternatives considered**: Rely on the old branch's `unexpectedError(err)` auto-mapping ("no encontrado" → `NOT_FOUND`), or pass raw `err.message` through `mcpError`.
**Rationale**: `main`'s `unexpectedError(_err)` ignores its argument and returns a fixed generic string — it no longer maps not-found. Without explicit per-tool mapping, missing resources would surface as generic "An unexpected error occurred", hiding the caller-supplied id that lets an agent correlate the failure. Raw `mcpError(err.message)` leaks internal/Spanish business text and is inconsistent with the sanitize-on-failure contract. Mirroring `service-documents.ts`'s `guardFailure` keeps the error surface consistent across the whole server.

### Decision: Generate the trip slug inside the tools via `@/lib/slugify`

**Choice**: `create_trip` and `create_trip_from_template` compute `slug = (slugify(title) || "viaje") + "-" + Date.now().toString(36)` before calling the data layer; the slug is **not** a tool input.
**Alternatives considered**: Expose `slug` as a required tool input and let the agent supply it; or let the data layer default it.
**Rationale**: `CreateTripInput.slug` is **required** on `main` (verified `src/lib/data/trips.ts:16`), and `createTrip()` will not default it. Requiring the agent to invent a collision-free slug is unreasonable; generating it server-side matches the existing `src/app/dashboard/trips/new/actions.ts` pattern and `createClient`'s internal slug generation. `Date.now().toString(36)` gives uniqueness; `slugify(title) || "viaje"` handles empty/unsluggable titles.

### Decision: Require `clientIds` (min 1) on BOTH `create_trip` and `create_trip_from_template`

**Choice**: Both tools declare `clientIds: z.array(z.string().min(1)).min(1)`.
**Alternatives considered**: Keep `clientIds` optional on `create_trip_from_template` (legacy branch behavior) and surface the data-layer business error.
**Rationale**: `main`'s `createTrip()` throws `"Se requiere al menos un cliente para crear el viaje"` when `clientIds.length < 1 && !isTemplate`, and `createTripFromTemplate()` reuses `createTrip()` with `isTemplate` unset. An optional `clientIds` would let a template copy fail late with a business error instead of a validation error. Requiring it at the Zod boundary keeps the schema honest with the data-layer invariant (every non-template trip has ≥1 client) and fails before any DB work. The legacy branch tolerated optional `clientIds` only because its `createTrip` did not enforce the rule.

### Decision: Keep `utils.ts` / `errors.ts` untouched; duplicate the tiny local helpers per module

**Choice**: Each of the 8 new modules carries its own ~10-line `safeCall` and `guardFailure`-style local functions, copied from `service-documents.ts`, rather than extracting a shared helper.
**Alternatives considered**: Extract `safeCall`/`guardFailure` into `tools/utils.ts` and import them everywhere (a DRY improvement); or add a shared `notFoundMapping` helper.
**Rationale**: The proposal's stated contract is "no changes to `utils.ts`, `errors.ts`." A shared-helper extraction would expand scope and touch a file the change is supposed to reuse unchanged. The helpers are small and the duplication is bounded (8 modules). This is a deliberate trade for scope discipline; if the duplication becomes a maintenance problem, extracting it is a trivial follow-up, noted under Open Questions.

## Data Flow

```
External agent
     │  MCP (Streamable HTTP, POST /api/mcp)
     ▼
route.ts ── validateMcpApiKey() (401)
     │
     ├── canUseServiceRole() false ──► 503 (mock data unreachable)
     │
     ▼
createMcpServer()  ──►  registers 48 tools (7 service-doc + 41 agent-action)
     │
     ▼
tool handler ──► data.fn(args) ──► createServerSupabase() / getSupabaseAdmin()
     │                                   │
     │  success(result) | notFound |      │  Supabase/Postgres (service role)
     │  unexpectedError                    │
     ▼                                    ▼
CallToolResult (JSON text block)     trip-documents bucket (presigned URL)
```

- The route gates before any tool registration, so the 503 "no service role" path is unreachable by any new tool (mock-data fallback inside data functions is therefore never exercised from MCP).
- `get_document_upload_url` is the only tool that touches `getSupabaseAdmin()` directly (via the new helper); it produces a presigned **PUT** URL that the agent uses out-of-band to upload bytes (actual upload bytes are out of scope for this change).

## Tool → Data-Function Mapping (41 tools)

Legend: all `data.fn()` calls are **direct** (no trailing client). `success(...)` = JSON envelope; `notFound(r, id)` = `NOT_FOUND: r id`; `unexpectedError` = sanitized generic. Zod shapes are adapted from the legacy branch with the two resolved tightenings applied (`clientIds` min 1 on both create tools; no other semantic drift).

### `clients.ts` — `registerClientTools(server)` (7)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `list_clients` | `getClients({page,pageSize})` | `{ page?: int≥1, pageSize?: int 1..100 }` | `success({items,totalCount})` |
| `get_client` | `getClientById(id)` | `{ id: string≥1 }` | `null` → `notFound("client", id)`; else `success(client)` |
| `create_client` | `createClient(input)` | `{ name≥1, email?: email, phone?, notes?, referralSource?, birthDate?, coverImageUrl?: url }` | `success(client)` |
| `update_client` | `getClientById` + `updateClient(id, input)` | `{ id≥1, name?≥1, email?: email, phone?, notes?, referralSource?, birthDate?, coverImageUrl?: url }` | precheck `null` → `notFound("client", id)`; else `success(client)` |
| `get_client_tags` | `getClientTags(clientId)` | `{ clientId: string≥1 }` | `success(tags[])` |
| `set_client_tags` | `setClientTags(clientId, tagIds)` | `{ clientId≥1, tagIds: string[] (≥1 each) }` | `success({success:true})` |
| `get_client_trips` | `Promise.all([getTripsByClientId, getClientTripSummary])` | `{ clientId≥1 }` | `success({trips, summary})` |

### `suppliers.ts` — `registerSupplierTools(server)` (6)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `list_suppliers` | `getSuppliers({page,pageSize,query,type,tag})` | `{ page?: int≥1, pageSize?: int 1..100, query?, type?, tag? }` | `success({items,totalCount})` |
| `get_supplier` | `getSupplierById(id)` | `{ id≥1 }` | `null` → `notFound("supplier", id)`; else `success` |
| `create_supplier` | `createSupplier(input)` | `{ name≥1, type≥1, contactPhone?, contactEmail?: email, website?: url, address?, lat?: number, lng?: number, notes?, tags?: string[] }` | `success(supplier)` |
| `update_supplier` | `getSupplierById` + `updateSupplier(id, input)` | `{ id≥1, …partial as create_supplier }` | precheck `null` → `notFound("supplier", id)`; else `success` |
| `delete_supplier` | `getSupplierById` + `softDeleteSupplier(id, force?)` | `{ id≥1, force?: boolean }` | precheck `null` → `notFound("supplier", id)`; `!ok` → `mcpError("Supplier is referenced by N item(s). Use force=true to delete anyway.")`; else `success({success:true})` |
| `restore_supplier` | `restoreSupplier(id)` | `{ id≥1 }` | `success({success:true})` |

### `trips.ts` — `registerTripTools(server)` (9)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `list_trips` | `getTripsWithClients({page,pageSize,filters})` | `{ page?: int≥1, pageSize?: int 1..100, query?, status?: draft\|published\|archived, currency?: MXN\|USD\|EUR, clientId?≥1, tagId?≥1, startDate?, endDate? }` | `filters = { query, status: status&&[status], currency, clientIds: clientId&&[clientId], tagIds: tagId&&[tagId], dateFrom: startDate, dateTo: endDate }` → `success` |
| `get_trip` | `getTripById(id)` | `{ id≥1 }` | `null` → `notFound("trip", id)`; else `success` |
| `create_trip` | `createTrip({…, slug: generateTripSlug(title)})` | `{ clientIds: string[]≥1 .min(1), title≥1, startDate?, endDate?, instructions?, travelerCount?: int≥1, tagIds?: string[], currency?, isTemplate?: boolean }` | `success(trip)` |
| `create_trip_from_template` | `getTripById(templateId)` + `createTripFromTemplate(templateId, {…, slug})` | `{ templateId≥1, title?≥1, clientIds: string[]≥1 .min(1), startDate?, endDate? }` | template `null` → `notFound("template", templateId)`; `title ??= template.title`; `success(trip)` |
| `update_trip` | `getTripById` + `updateTrip(id, input)` | `{ id≥1, title?≥1, slug?≥1, startDate?, endDate?, coverImageUrl?: url, instructions?, travelerCount?: int≥1, budget?: number\|null, status?, currency?, showCostsToClient?: boolean, salePrice?: number\|null, commissionRate?: number\|null }` | precheck `null` → `notFound("trip", id)`; else `success(trip)` |
| `set_trip_clients` | `setTripClients(tripId, clientIds)` | `{ tripId≥1, clientIds: string[]≥1 .min(1) }` | `success({success:true})` |
| `set_trip_tags` | `setTripTags(tripId, tagIds)` | `{ tripId≥1, tagIds: string[] (≥1 each) }` | `success({success:true})` |
| `save_trip_as_template` | `getTripById` + `saveTripAsTemplate(tripId, title)` | `{ tripId≥1, title≥1 }` | precheck `null` → `notFound("trip", tripId)`; catch `isNotFoundMessage` → `notFound("trip", tripId)`; else `success(template)` |
| `list_templates` | `getTemplates()` | `{}` | `success(templates[])` |

### `tripDays.ts` — `registerTripDayTools(server)` (6)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `add_trip_day` | `createTripDay({tripId,date,notes,sortOrder})` | `{ tripId≥1, date≥1, notes?, sortOrder?: int }` | `success(day)` |
| `update_trip_day` | `updateTripDay(id, input)` | `{ id≥1, date?, notes?, sortOrder?: int }` | catch `isNotFoundMessage` → `notFound("trip day", id)`; else `success(day)` |
| `delete_trip_day` | `deleteTripDay(id)` | `{ id≥1 }` | `success({success:true})` |
| `restore_trip_day` | `restoreTripDay(id)` | `{ id≥1 }` | `success({success:true})` |
| `generate_trip_days` | `generateTripDays(tripId)` | `{ tripId≥1 }` | catch `isNotFoundMessage` → `notFound("trip", tripId)`; else `success({created,totalDays})` |
| `reorder_trip_days` | `reorderTripDays(order)` | `{ order: [{ id≥1, sortOrder: int }] .min(1) }` | `success({success:true})` |

### `items.ts` — `registerItemTools(server)` (7)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `add_item` | `createItem(input)` | `{ tripDayId≥1, type: flight\|hotel\|activity\|restaurant\|transport\|note, title≥1, startTime?, endTime?, location?, lat?: number, lng?: number, confirmationCode?, notes?, cost?: number, sortOrder?: int, supplierId?≥1, metadata?: record }` | `success(item)` |
| `update_item` | `updateItem(id, input)` | `{ id≥1, …partial as add_item (minus tripDayId) }` | catch `isNotFoundMessage` → `notFound("item", id)`; else `success(item)` |
| `delete_item` | `deleteItem(id)` | `{ id≥1 }` | `success({success:true})` |
| `restore_item` | `restoreItem(id)` | `{ id≥1 }` | `success({success:true})` |
| `move_item` | `moveItemToDay(itemId, targetDayId)` | `{ itemId≥1, targetDayId≥1 }` | `success({success:true})` |
| `duplicate_item` | `getItemById(itemId)` + `duplicateItem(itemId, destDayId)` | `{ itemId≥1, targetDayId?≥1 }` | resolve `destDayId = targetDayId ?? source?.tripDayId`; source `null` → `notFound("item", itemId)`; catch `isNotFoundMessage` → `notFound("item", itemId)`; else `success(item)` |
| `reorder_items` | `reorderItems(order)` | `{ order: [{ id≥1, sortOrder: int }] .min(1) }` | `success({success:true})` |

### `packing.ts` — `registerPackingTools(server)` (3)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `add_packing_item` | `createPackingItem({tripId,label,sortOrder})` | `{ tripId≥1, label≥1, sortOrder?: int }` | `success(item)` |
| `update_packing_item` | `updatePackingItem(id, input)` | `{ id≥1, label?≥1, checked?: boolean, sortOrder?: int }` | catch `isNotFoundMessage` → `notFound("packing item", id)`; else `success(item)` |
| `delete_packing_item` | `deletePackingItem(id)` | `{ id≥1 }` | `success({success:true})` |

### `internalNotes.ts` — `registerInternalNoteTools(server)` (2)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `get_trip_internal_notes` | `getTripById(id)` + `getTripInternalNotes(id)` | `{ id≥1 }` | precheck `null` → `notFound("trip", id)`; else `success({internalNotes})` |
| `update_trip_internal_notes` | `getTripById(id)` + `updateTripInternalNotes(id, internalNotes)` | `{ id≥1, internalNotes: string\|null }` | precheck `null` → `notFound("trip", id)`; else `success({success:true})` |

### `documents.ts` — `registerDocumentTools(server)` (1)

| Tool | Data function(s) | Zod input shape | Result / not-found |
|------|------------------|-----------------|--------------------|
| `get_document_upload_url` | `getSignedServiceDocumentUploadUrl(path, expiresIn ?? 300)` | `{ path≥1, expiresIn?: int 60..604800 }` | `success({uploadUrl, expiresIn: expiresIn ?? 300})`; catch → `unexpectedError` |

## Error-Mapping Strategy

Four canonical patterns, used consistently across all 41 tools (and already established in `service-documents.ts`):

1. **Plain result** (list/create/void-successful): wrap the single data call in a local `safeCall(fn)` that returns `success(await fn())` on success and `unexpectedError(err)` on throw. Used by every tool that cannot legitimately return `null`.
2. **Null-check getter** (`get_client`, `get_supplier`, `get_trip`, and every `getXById` pre-check): `const x = await getX(id); if (!x) return notFound(resource, id); return success(x);`. The not-found path is detected from the data function's `null` return, not from an exception.
3. **Not-found-by-throw** (`update_trip_day`, `update_item`, `update_packing_item`, `save_trip_as_template`, `duplicate_item`, `generate_trip_days`): `try { ... } catch (err) { if (isNotFoundMessage(safeMessage(err))) return notFound(resource, id); return unexpectedError(err); }`. This preserves the legacy branch's per-tool not-found routing that `main`'s `unexpectedError` no longer performs.
4. **Business-signal** (`delete_supplier`): when `softDeleteSupplier` returns `{ok:false, itemCount}`, return a `mcpError` with the actionable count message (not a not-found, not an unexpected error). When `ok`, `success({success:true})`.

**Sanitization invariant (applies to all patterns):** no tool result may contain a stack trace, SQL fragment, internal identifier, or service-role key. `success` JSON-stringifies domain objects (which are already row-mapped to public shapes); `unexpectedError` returns the fixed `"An unexpected error occurred"`; `notFound` returns `NOT_FOUND: <resource> <id>`. The only `mcpError`-with-text is the deliberate, static, secret-free `delete_supplier` reference-count message.

**Per-module local helpers:** each module defines `safeCall` and (where needed) a `guardFailure`-style local mapper, copied from `service-documents.ts`. This honors the "`utils.ts` unchanged" constraint (see Decisions).

## Interfaces / Contracts

### New data helper — `src/lib/data/documents.ts`

```ts
/**
 * Genera una URL firmada de corta duración para SUBIR un documento de
 * servicio usando el service-role (bypasea el bucket privado y RLS), espejo
 * de `getSignedServiceDocumentDownloadUrl` pero con `createSignedUploadUrl`
 * (PUT firmado). `expiresIn` es solo metadato: el TTL real lo aplica el
 * servidor de storage. Lanza si no hay service role o si el firmado falla.
 */
export async function getSignedServiceDocumentUploadUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(path, { upsert: false });
  if (error) throw error;
  return data.signedUrl;
}
```

- Mirrors `getSignedServiceDocumentDownloadUrl` (same bucket `DOCUMENTS_BUCKET = "trip-documents"`, same `getSupabaseAdmin()` resolution, same throw-on-failure contract).
- `expiresIn` is accepted for tool-signature symmetry and echoed back in the result envelope, but `@supabase/storage-js`'s `createSignedUploadUrl` does not honor it — the server applies token TTL. The Zod schema still bounds it to `60..604800` for caller discipline.
- **Return type is `string`** (a signed URL) rather than `string | null`, consistent with the existing download helper; the tool wraps it in `success({uploadUrl, expiresIn})` and maps a throw to `unexpectedError`.

### `src/lib/mcp/server.ts` registration

```ts
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "travelhub-mcp", version: "1.0.0" });
  registerServiceDocumentTools(server); // 7
  registerClientTools(server);          // +7  = 14
  registerSupplierTools(server);        // +6  = 20
  registerTripTools(server);            // +9  = 29
  registerTripDayTools(server);         // +6  = 35
  registerItemTools(server);            // +7  = 42
  registerPackingTools(server);         // +3  = 45
  registerInternalNoteTools(server);    // +2  = 47
  registerDocumentTools(server);        // +1  = 48
  return server;
}
```

**Collision check (verified):** the 41 new tool names (`list_clients` … `get_document_upload_url`) share no prefix/name with the 7 existing service-document tools (`list_services` … `request_service_upload_reupload`). The only near-names are `get_service_upload_download_url` (existing, download) vs `get_document_upload_url` (new, upload) — distinct, no collision.

### Enums (verified against `src/types/index.ts`)

- `ItemType` = `flight | hotel | activity | restaurant | transport | note` → `z.enum([...])`, matches `Item["type"]` exactly.
- `TripStatus` = `draft | published | archived` → `z.enum([...])`.
- `TripCurrency` = `MXN | USD | EUR` → `z.enum([...])`.

No schema change is required; the legacy Zod shapes already matched these `main` enums.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/mcp/tools/clients.ts` | Create | `registerClientTools` — 7 client tools |
| `src/lib/mcp/tools/suppliers.ts` | Create | `registerSupplierTools` — 6 supplier tools |
| `src/lib/mcp/tools/trips.ts` | Create | `registerTripTools` — 9 trip/template tools (incl. slug generation) |
| `src/lib/mcp/tools/tripDays.ts` | Create | `registerTripDayTools` — 6 trip-day tools |
| `src/lib/mcp/tools/items.ts` | Create | `registerItemTools` — 7 item tools |
| `src/lib/mcp/tools/packing.ts` | Create | `registerPackingTools` — 3 packing tools |
| `src/lib/mcp/tools/internalNotes.ts` | Create | `registerInternalNoteTools` — 2 internal-notes tools |
| `src/lib/mcp/tools/documents.ts` | Create | `registerDocumentTools` — 1 presigned-upload-URL tool |
| `src/lib/mcp/server.ts` | Modify | Register the 8 new modules alongside `registerServiceDocumentTools` (48 total) |
| `src/lib/data/documents.ts` | Modify | Add `getSignedServiceDocumentUploadUrl(path, expiresIn?)` |
| `src/app/api/mcp/__tests__/route-tools.test.ts` | Modify | **Required** — update `EXPECTED_TOOLS` (currently asserts exactly 7) to the 48-tool surface, or scope its registration assertion to the service-document subset |
| `src/lib/mcp/tools/utils.ts` | Unchanged | Reused (`textResult`, `safeMessage`, `isNotFoundMessage`, `unexpectedError`) |
| `src/lib/mcp/errors.ts` | Unchanged | Reused (`success`, `notFound`, `mcpError`) |
| `src/lib/mcp/auth.ts` | Unchanged | Reused |
| `src/app/api/mcp/route.ts` | Unchanged | Auth + service-role gate already present |

> **Note on the test file:** `route-tools.test.ts` (line 137–142) asserts `createMcpServer()` lists *exactly* the seven service-document tools. Registering 48 tools breaks that assertion, so the test **must** be updated in the same change — either by asserting the full 48-name set (preferred, also validating the no-collision guarantee) or by narrowing the assertion. This is a genuine coupling the proposal's "existing suite unaffected" wording did not call out; see Risks.

## Testing Strategy

The change is a wiring port with one new helper; testing is overwhelmingly **tool-wiring** plus a **typecheck/build** gate. Strict TDD is enabled (`openspec/config.yaml` `apply.tdd: true`, `test_command: npm run test`), so tool-wiring tests are written RED-first against the target surface before the modules are registered.

| Layer | What to test | Approach |
|-------|-------------|----------|
| Typecheck | All 8 modules + `server.ts` + `documents.ts` compile against `main`'s `data.fn()` signatures | `npx tsc --noEmit` |
| Unit (wiring) | Registration lists exactly 48 tools with no collisions | Extend `route-tools.test.ts` pattern: `InMemoryTransport.createLinkedPair()` + `client.listTools()`; assert the 48-name set and non-empty descriptions |
| Unit (dispatch) | Each tool calls its data function directly (no trailing client) with the right args and returns the right envelope | `vi.mock("@/lib/data/*")`; `client.callTool(...)`; assert `dataFn` was called with exact args; assert `success` JSON round-trips objects (never `"[object Object]"`) |
| Unit (not-found) | Per-tool `notFound(resource, id)` on `null` and on `isNotFoundMessage` throws | Mock `getXById` → `null` and `updateX` → throw `"… no encontrado"`; assert `isError:true` and `/^NOT_FOUND: <resource> <id>$/` |
| Unit (sanitization) | No stack trace / internal text / service-role key leaks | Reject with `new Error("DB crashed at 10.0.0.5")`; assert `"An unexpected error occurred"` and no leaked substring (mirrors existing `route-tools.test.ts`) |
| Unit (new helper) | `getSignedServiceDocumentUploadUrl` returns the signed PUT URL, `expiresIn` metadata-only | Mock `getSupabaseAdmin().storage.from().createSignedUploadUrl`; assert the helper passes `(path, {upsert:false})` and returns `data.signedUrl` |
| Unit (validation) | `create_trip`/`create_trip_from_template` reject empty `clientIds`; slug generated before persistence | `callTool` with `clientIds: []` → Zod error; with valid input assert `createTrip` received a non-empty `slug` matching `slugify(title)` prefix |
| Build | Whole app builds with the new surface | `npm run build` |

- **RED-first order:** (1) update `route-tools.test.ts` `EXPECTED_TOOLS` to 48 → RED; (2) write per-module wiring/dispatch/not-found tests → RED; (3) implement the 8 modules + `server.ts` + helper → GREEN; (4) `tsc` + `build` + full `npm run test`.
- **Data-layer regressions:** the existing `src/lib/data/__tests__/*` suite is untouched; the only data-layer change is the additive helper, covered by a new unit test.

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.`

The `references/threat-matrix.md` categories (documentation-like paths, git repository selection, commit/push state, PR commands) do not apply to this change: it adds MCP tool handlers and one storage-signing helper, none of which shell out, spawn subprocesses, drive git, classify executable files, or change HTTP routing. The matrix is recorded as not applicable and is not expanded.

**Security consideration (outside the matrix's trigger set, tracked in Risks):** `get_document_upload_url` produces a service-role presigned PUT URL granting temporary write access to the private `trip-documents` bucket. This is the only new capability that touches the service role directly. Its safety rests on (a) `getSupabaseAdmin()` being server-only (`@/lib/supabase/server`, never client-bundled), (b) the route's `validateMcpApiKey()` + `canUseServiceRole()` gate preceding it, and (c) the tool never returning the service key — only the short-lived signed URL. RED tests assert no credential appears in the result envelope.

## Migration / Rollout

No migration required. The change is purely additive to the MCP tool surface plus one additive data helper; it touches no schema, migration, RLS policy, dashboard route, or public route.

**Rollout:** a redeploy exposes the 48-tool surface behind the existing `MCP_API_KEY` + service-role gate. No feature flag is required (the surface is gated by the pre-existing 503 when the service role is absent).

**Rollback:** revert the 8 new tool modules, restore `server.ts` to register only `registerServiceDocumentTools`, and delete `getSignedServiceDocumentUploadUrl` from `documents.ts`. Also revert the `mcp-server` discovery-spec edit (tool count) at archive time. No database or policy risk; the prior commit restores the 7-tool surface.

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `textResult` string-only drift silently emits `[object Object]` for object payloads | High | Uniform rule: object/array/scalar payloads via `success()`; only string messages via `textResult`. Wiring tests assert JSON round-trips, not string coercion. |
| `unexpectedError` no longer maps not-found → generic errors hide missing resources | Medium | Preserve per-tool `notFound(resource, id)` via null-check and `safeMessage`+`isNotFoundMessage` (local `guardFailure` style). Specs require not-found results to name the resource and caller id. |
| Existing `route-tools.test.ts` asserts exactly 7 tools and will fail after registration | **High** | Update the test's `EXPECTED_TOOLS` to the 48-tool set (or scope the assertion) in the same change — this is a required modification, not an optional cleanup. |
| `create_trip`/`create_trip_from_template` throw without a generated slug (`CreateTripInput.slug` required) | Medium | Tools generate `slugify(title) || "viaje"` + `Date.now().toString(36)` before calling the data layer (matches `dashboard/trips/new/actions.ts`). |
| `create_trip_from_template` empty `clientIds` throws a late business error | Medium | Zod requires `clientIds` (min 1) on both create tools; validation fails before the data layer. |
| `get_document_upload_url` gap — new service-role upload-signing helper | Low | Add `getSignedServiceDocumentUploadUrl` mirroring the download helper; `expiresIn` is metadata-only. `storage-js` API surprise is the residual risk; the helper is isolated and unit-tested. |
| Service-role key exposure via the new upload-signing helper | Low | `getSupabaseAdmin()` is server-only; no key is returned in any tool result; `unexpectedError` suppresses raw messages. Sanitization tests assert no credential leaks. |
| `setTripTags` relocated to `clients.ts` (barrel-exported) → import confusion | Low | Import via the `@/lib/data` barrel (`data.setTripTags`); barrel already re-exports `clients.ts`. |
| `softDeleteSupplier` return-shape `{ok, itemCount?}` | Low | Tool reads `result.ok`/`result.itemCount` directly; the reference-count `mcpError` text is static and secret-free. |
| Local-helper duplication across 8 modules (DRY debt) | Low | Bounded and deliberate (see Decisions); extraction into `utils.ts` is a trivial follow-up, tracked under Open Questions. |

## Open Questions

- [ ] **Helper DRY follow-up** — Should `safeCall`/`guardFailure` be extracted into `tools/utils.ts` (or a shared `tools/helpers.ts`) once this change lands? Deferred to honor the "`utils.ts` unchanged" contract; not blocking.
- [ ] **`whatsapp` / `googlePlaceId` parity** — `main`'s `CreateClientInput.whatsapp?` and `CreateSupplierInput.googlePlaceId?` exist but were not exposed in the legacy Zod schemas. Porting faithfully leaves them out; exposing them is trivial if an agent needs them. Confirm desired surface before or during `sdd-tasks`.
- [ ] **`route-tools.test.ts` assertion strategy** — prefer replacing `EXPECTED_TOOLS` with the full 48-name set (also proves no collisions) vs. scoping the existing test to service-document tools and adding a separate 48-tool assertion. Either satisfies the discovery spec; pick one during `sdd-tasks`.

## Success Criteria (carried from proposal, for verification)

- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run test` passes (including the updated `route-tools.test.ts` 48-tool assertion).
- [ ] `createMcpServer()` registers exactly 48 tools with no name collisions (native `listTools`).
- [ ] Every new tool calls its data function directly (no trailing client, no AsyncLocalStorage) and object payloads round-trip as JSON.
- [ ] `get_document_upload_url` returns a valid presigned PUT URL when the service role is configured.
- [ ] Not-found failures surface `NOT_FOUND: <resource> <id>` for tools that map them.
- [ ] `create_trip` / `create_trip_from_template` reject empty `clientIds` at schema validation and generate a slug before persisting.
