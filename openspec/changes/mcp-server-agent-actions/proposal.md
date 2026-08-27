# Proposal: MCP Server for Agent Actions

**Change slug:** `mcp-server-agent-actions`
**Phase:** propose
**Status:** ready for spec + design

## 1. Why

Today every client (clientes), supplier (proveedores), and trip (viajes) mutation is performed by a human travel agent through the TravelHub dashboard. Those mutations run exclusively as Next.js Server Actions (e.g. `src/app/dashboard/**/actions.ts`) that depend on the Supabase Auth cookie session established by `src/middleware.ts`. There is no machine-callable boundary that an external AI agent can drive.

An AI assistant should be able to perform the *same* actions a human agent performs — create and update clients, manage suppliers, and build/edit trip itineraries (days, items, packing) — programmatically. The cleanest way to unlock this on the existing Vercel-only hosting is a hosted **MCP (Model Context Protocol) server** that exposes those actions as MCP tools over Streamable HTTP, authenticated independently of the browser session, and reusing the existing `src/lib/data.ts` data-access layer.

This is not about replacing the dashboard. It is about giving an agent the same capability surface the human already has, so agentic workflows (draft a trip from a prompt, reconcile a supplier, update a client) become possible without clicking through the UI.

## 2. What Changes

- A new Next.js Route Handler at **`src/app/api/mcp/route.ts`** that implements an MCP server over **Streamable HTTP** using the official `@modelcontextprotocol/server` TypeScript SDK (`WebStandardStreamableHTTPServerTransport`, which consumes web-standard `Request`/`Response` and matches Next.js Route Handlers).
- The route authenticates every request with a dedicated **`MCP_API_KEY`** secret passed as `Authorization: Bearer <key>`; requests without a valid key are rejected with `401`.
- The MCP tools call the existing `src/lib/data.ts` functions (the single source of truth today), but through a **service-role Supabase client** rather than the cookie-aware anon client. This requires a small refactor of `src/lib/supabase/server.ts` to expose a service-role client factory, plus making `data.ts` functions able to receive an injected client so the MCP path bypasses RLS without a browser session (see Scope sub-decisions and Impact).
- A minimal **client-connection spec** is published: the endpoint URL (`POST /api/mcp`), the required `Authorization` header, and the protocol version. No separate REST/OpenAPI layer is introduced.
- The public traveler view `/t/[slug]` is **not** touched and continues to read only `status = 'published'` rows via RLS.

The MCP server is the specification: any client built on `@modelcontextprotocol/client` can call `listTools()` at runtime to discover tool names, descriptions, and Zod/JSON input schemas. This satisfies the "specifications needed so an MCP client can be generated" requirement natively.

## 3. Scope

### IN scope (first release / MVP)

- **Endpoint location:** `src/app/api/mcp/route.ts`, mounted at `/api/mcp` on the existing Vercel deployment (Option A from exploration). No new service, repo, or runtime.
- **Auth:** dedicated `MCP_API_KEY` (Bearer header). Stateless, easy to rotate. Rotation is documented in `SUPABASE_SETUP.md`/env docs; old and new keys can briefly coexist if we validate against a comma-separated list (design-phase detail).
- **Service-role data access:** add `createServiceRoleClient()` (or named equivalently) to `src/lib/supabase/server.ts` using `SUPABASE_SERVICE_ROLE_KEY`, and make `data.ts` functions accept an optional injected Supabase client so the MCP handler passes the privileged client instead of the cookie client.
- **MVP tool surface (below):** clients, suppliers, trips, trip days, items, packing, internal notes, templates, and *read-only/pre-signed* document access. This covers the recurring, high-value agent actions and deliberately excludes binary upload round-trips.
- **Input validation:** Zod v4 schemas for every tool (project already depends on Zod v4; MCP SDK supports Standard Schema). Invalid input is rejected by the SDK before reaching `data.ts`.
- **Client spec/docs:** endpoint URL, auth header, protocol version, and a sample `@modelcontextprotocol/client` + `HttpClientTransport` connection snippet.

### OUT of scope (first release)

- **Binary uploads through MCP tool arguments.** Uploading documents, photos, and cover images as base64/binary inside JSON-RPC is deferred (see upload decision below). The MVP exposes only a pre-signed-URL helper.
- **OpenAPI / Swagger bridge.** MCP's native tool discovery (`listTools()`) is the client-generation mechanism. An OpenAPI mapping is explicitly deferred.
- **Prompts and Resources.** Tool surface only for MVP; "build itinerary" prompt templates and `trip://` resources are deferred.
- **Public `/t/[slug]` changes, RLS relaxation, or dashboard UI changes.**
- **Multiple MCP keys, scopes, or role-based access control.** Single key for the single admin agent today.

### Deferred / later slices

- Binary document/photo/cover upload tooling (actual bytes), likely via pre-signed PUT URLs + a Supabase Storage client on the agent side.
- Fine-grained authorization (per-tool scopes, multiple agent identities).
- Prompts/Resources, OpenAPI bridge, webhook-style notifications.

### Resolved open questions (from exploration)

1. **Endpoint location → `/api/mcp` (IN scope).** Confirmed Option A; satisfies the "existing Vercel hosting" constraint with no extra service.
2. **Auth → single `MCP_API_KEY` (Bearer), with documented rotation.** Simpler than JWT/OAuth2 for a single-tenant, single-admin context; recommended and adopted.
3. **Binary uploads → return pre-signed URLs only in MVP; actual binary upload deferred.** MCP exchanges JSON; the MVP exposes `get_document_upload_url` (wraps `getSignedDocumentUrl`) so the agent obtains a short-lived Supabase Storage PUT URL and uploads bytes directly. The `upload_*` storage mutating tools are deferred.
4. **MVP tool subset → see list below.** Covers clients, suppliers, trips, trip days, items, packing, internal notes, templates, and signed-URL read access. Excludes storage-binary and template-photo cover tools.
5. **Internal fields (`internalNotes`, `salePrice`, `commissionRate`) → EXPOSED to MCP, by design.** These are already part of the agent's own data model and the MCP agent acts *as* the agent. `updateTrip` already writes `salePrice`/`commissionRate`, and `getTripInternalNotes`/`updateTripInternalNotes` already exist. The MCP agent is the human agent's programmatic equivalent, so it must see what the human sees. The constraint that these are **never exposed to `/t/[slug]`** is unchanged and unaffected (the public path does not call MCP tools).
6. **Mock-mode MCP → NOT supported in the MCP path.** The MCP handler requires Supabase configuration (`isSupabaseConfigured()`); if unconfigured it returns a clear `503`/error rather than silently falling back to `mock-data.ts`. Mock mode remains for the dashboard/dev experience only; keeping it out of the MCP path avoids an agent silently operating on throwaway in-memory data.
7. **OpenAPI bridge → OUT of scope / deferred.** Native MCP tool discovery is the spec. No OpenAPI generation in this change.

### MVP tool list

Each tool wraps an existing `src/lib/data.ts` function. (Argument shapes to be finalized in the spec/design phase.)

**Clients**
- `list_clients` — paginated client list (`getClients` / `getClientsWithTags`)
- `get_client` — fetch one client by id (`getClientById`)
- `create_client` — create client, auto-generates public slug (`createClient`)
- `update_client` — edit client fields (`updateClient`)
- `get_client_tags` — read client tags (`getClientTags`)
- `set_client_tags` — set/diff client tags (`setClientTags` + `getOrCreateTag`)
- `get_client_trips` — trips and summary for a client (`getTripsByClientId` / `getClientTripSummary`)

**Suppliers**
- `list_suppliers` — paginated/filtered supplier catalog (`getSuppliers`)
- `get_supplier` — fetch one supplier (`getSupplierById`)
- `create_supplier` — create supplier (`createSupplier`)
- `update_supplier` — edit supplier (`updateSupplier`)
- `delete_supplier` — soft delete, with `force` for referenced items (`softDeleteSupplier`)
- `restore_supplier` — restore soft-deleted supplier (`restoreSupplier`)

**Trips**
- `list_trips` — paginated/filtered trip list (`getTrips` / `getTripsWithClients`)
- `get_trip` — full trip graph (`getTripById` / `getTripWithDetails`)
- `create_trip` — create trip (requires ≥1 client, auto slug) (`createTrip`)
- `create_trip_from_template` — instantiate from template (`createTripFromTemplate`)
- `update_trip` — edit metadata **and** status (draft/published/archived), incl. `salePrice`/`commissionRate`/`showCostsToClient` (`updateTrip`)
- `set_trip_clients` — assign clients, diff semantics, ≥1 (`setTripClients`)
- `set_trip_tags` — assign trip tags (`setTripTags` + `getOrCreateTag`)
- `save_trip_as_template` — save as `is_template=true` trip (`saveTripAsTemplate`)
- `list_templates` — list templates (`getTemplates`)

**Trip Days**
- `add_trip_day` — add a day (`createTripDay`)
- `update_trip_day` — edit date/notes (`updateTripDay`)
- `delete_trip_day` — soft delete (`deleteTripDay`)
- `restore_trip_day` — restore (`restoreTripDay`)
- `generate_trip_days` — fill days from start/end dates (`generateTripDays`)
- `reorder_trip_days` — reorder via `sort_order` swap (`reorderTripDays`)

**Items**
- `add_item` — add item, type-specific metadata validated (`createItem`)
- `update_item` — edit item (`updateItem`)
- `delete_item` — soft delete (`deleteItem`)
- `restore_item` — restore (`restoreItem`)
- `move_item` — move item to another day (`moveItemToDay`)
- `duplicate_item` — duplicate (`duplicateItem`)
- `reorder_items` — reorder via `sort_order` swap (`reorderItems`)

**Packing**
- `add_packing_item` — add checklist item (`createPackingItem`)
- `update_packing_item` — toggle checked (`updatePackingItem`)
- `delete_packing_item` — remove (`deletePackingItem`)

**Internal notes (agent-only)**
- `get_trip_internal_notes` — read internal notes (`getTripInternalNotes`)
- `update_trip_internal_notes` — write internal notes (`updateTripInternalNotes`)

**Document access (pre-signed, deferred binary)**
- `get_document_upload_url` — return a short-lived Supabase Storage PUT URL so the agent uploads bytes directly; the `upload_*` storage tools themselves are deferred (`getSignedDocumentUrl`)

## 4. Impact

- **New file:** `src/app/api/mcp/route.ts` — MCP server Route Handler (Streamable HTTP), auth gate, tool registration, Zod schemas.
- **Refactor:** `src/lib/supabase/server.ts` — add a service-role client factory (`createServiceRoleClient()`) using `SUPABASE_SERVICE_ROLE_KEY`.
- **Refactor:** `src/lib/data.ts` — make the Supabase client injectable (optional parameter) so the MCP handler supplies the service-role client instead of the cookie-aware anon client. Today `data.ts` calls the cookie client internally; without injection the MCP path cannot bypass RLS. This is the key coupling to resolve in the design phase.
- **New env vars:** `MCP_API_KEY` (required in production for the MCP route). `SUPABASE_SERVICE_ROLE_KEY` already exists and is reused.
- **Docs:** add MCP connection spec (endpoint, auth header, protocol version, sample client snippet) and `MCP_API_KEY` rotation notes to `SUPABASE_SETUP.md` or equivalent env docs.
- **No impact** to `/t/[slug]`, RLS policies, dashboard UI, or existing Server Actions. Public read isolation is preserved.
- **No impact** to the existing `/api/cron/*` and `/api/flight-status` routes.

## 5. Risks

- **Service-role key exposure.** `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. *Mitigation:* server-only import (`src/lib/supabase/server.ts`), never referenced in client bundles; Vercel env configured as "sensitive"; no logs of the key; the key is never returned in any tool result or error.
- **Single-key blast radius.** One `MCP_API_KEY` grants the agent full admin power with no RBAC. *Mitigation:* treat the key like the service-role key (secret, rotated, not committed); document that the MCP agent is equivalent to the human admin. Fine-grained scopes deferred.
- **Vercel serverless limits.** Function max duration (hobby 10s / pro 60s) bounds long operations. *Mitigation:* keep tools single-shot and bounded; large bulk work stays within limits or is split across multiple tool calls (no long-lived sessions needed by Streamable HTTP).
- **SDK pinning / transport API drift.** `@modelcontextprotocol/server` Streamable HTTP APIs may shift. *Mitigation:* pin an exact SDK version, and add a thin internal adapter so a future SDK upgrade touches one module, not every tool.
- **Cold starts + SDK init latency.** First MCP call may be slow. *Mitigation:* acceptable for an agent workflow; keep the transport/handler initialization cheap and avoid per-request heavy imports.
- **`data.ts` client coupling.** Today `data.ts` hardcodes the cookie client; reusing it from MCP risks either RLS denial or accidental mock fallback. *Mitigation:* the injectable-client refactor in Scope ensures MCP always uses the service-role client and never the mock path.
- **`Next.js 16` + SDK + Node runtime compatibility.** Route Handler must run on the Node.js runtime (not Edge) for the SDK and `crypto.randomUUID()`. *Mitigation:* set `export const runtime = "nodejs"` on the route; verify in a build/deploy smoke test during implementation.

## 6. Open Questions

- Should `MCP_API_KEY` validation support a short-lived overlap of two keys during rotation (comma-separated allow-list), or strict single-key replacement? (Recommend allow-list for zero-downtime rotation; finalize in design.)
- For `update_trip` status transitions, should the MVP expose them as a single `update_trip` with a `status` field, or as explicit `publish_trip` / `archive_trip` / `move_trip_status` tools mirroring the dashboard actions? (Recommend single `update_trip` for MVP; confirm in spec.)
- Exact Zod schema shapes and pagination conventions (page/cursor, page size defaults) for each list tool — to be defined in the spec phase against `data.ts` signatures.
