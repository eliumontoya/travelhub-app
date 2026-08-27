# Exploration: MCP Server for Agent Actions

## Executive Summary

TravelHub is a single-tenant Next.js App Router application for an independent travel agent. All business data (clients, suppliers, trips, trip days/items/documents) lives in Supabase Postgres, and all mutations today flow through Server Actions co-located under `src/app/dashboard/**/actions.ts`. Those Server Actions are not remotely callable; they rely on the Supabase Auth cookie session established by `src/middleware.ts` and are inaccessible to an external MCP client. The only remotely callable code today is two Route Handlers under `src/app/api/` (cron reminders and flight status), both read-only or triggered by Vercel Cron.

Adding an MCP server therefore requires a new, authenticated remote entry point. The most natural fit for the current Vercel-only hosting is a Next.js Route Handler (for example `src/app/api/mcp/route.ts`) that exposes MCP over **Streamable HTTP** using the official `@modelcontextprotocol/server` SDK. It would reuse the existing `src/lib/data.ts` functions, but because it cannot rely on a browser cookie session, it must authenticate via a server-side secret (likely a long-lived API key or OAuth2-style token) and use Supabase with a service-role or similarly privileged key. The public traveler view `/t/[slug]` must remain untouched; it already reads only `status = 'published'` rows via RLS.

## 1. Domain Model

Source of truth: `src/types/index.ts` and `supabase/migrations/*.sql`.

```text
clients
  ↓ 1..N via trip_clients (many-to-many, source of truth)
trips
  ↓ 1..N
trip_days (soft-deleted via deleted_at)
  ↓ 1..N
items (soft-deleted via deleted_at; JSONB item_metadata per type)
  ↓ 1..N
documents (file_url → private Supabase Storage bucket trip-documents)

suppliers — catalog of hotels, restaurants, transports, tour operators, etc.
tags — global catalog, shared by trips and clients
client_tags / trip_tags — many-to-many bridges
trip_photos → public bucket trip-photos
client_documents → private bucket trip-documents under clients/{id}/
trip_documents → private bucket trip-documents under trips/{id}/
packing_items — checklist per trip
trip_status_history — audit log of status transitions
trip_feedback — public inserts from /t/{slug}
site_settings — singleton agency branding/contact
```

Key type constraints from the schema:

- `trips.status` ∈ `{draft, published, archived}`.
- `trips.currency` ∈ `{MXN, USD, EUR}`.
- `items.type` ∈ `{flight, hotel, activity, restaurant, transport, note}`.
- `items.item_metadata` is JSONB; type-specific shape is validated by `src/lib/item-metadata-schemas.ts`.
- Soft delete applies only to `trip_days` and `items` (`deleted_at` column). Trips and clients are not soft-deleted today.
- A trip must have at least one client (`trip_clients` enforces this in logic; DB FKs are `on delete cascade` for the bridge and `on delete set null` for `trips.client_id`).

## 2. Actions an Agent Performs Today

The tables below map every agent-facing operation to its implementation layer. Read operations use `src/lib/data.ts`; mutations go through a Server Action that wraps `src/lib/data.ts`.

### Clients

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| List clients (paginated) | — | `getClients`, `getClientsWithTags` | Dashboard list + client selector |
| Get client by ID | — | `getClientById` | |
| Create client | `src/app/dashboard/clients/actions.ts` | `createClient` | Generates public slug for `/c/{slug}` |
| Update client | `src/app/dashboard/clients/[id]/actions.ts` | `updateClient` | |
| Get client tags | — | `getClientTags` | |
| Set client tags | `src/app/dashboard/clients/[id]/actions.ts` | `setClientTags`, `getOrCreateTag` | Diff semantics |
| Get trips by client | — | `getTripsByClientId`, `getClientTripSummary` | |
| Upload client document | `src/app/dashboard/clients/[id]/actions.ts` | `uploadClientDocument` | Private bucket `trip-documents` |
| List client documents | `src/app/dashboard/clients/[id]/actions.ts` | `getClientDocuments` | |
| Delete client document | `src/app/dashboard/clients/[id]/actions.ts` | `deleteClientDocument` | |
| Upload client cover | `src/app/dashboard/clients/[id]/actions.ts` | `uploadClientCoverImage` | Public bucket `client-covers` |
| Remove client cover | `src/app/dashboard/clients/[id]/actions.ts` | `removeClientCoverImage` | |

### Suppliers

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| List suppliers (paginated, filter by query/type/tag) | — | `getSuppliers` | `ALL_SUPPLIERS_PAGE_SIZE` for catalog |
| Get supplier by ID | — | `getSupplierById` | |
| Create supplier | `src/app/dashboard/suppliers/actions.ts` | `createSupplier` | |
| Update supplier | `src/app/dashboard/suppliers/actions.ts` | `updateSupplier` | |
| Soft delete supplier | `src/app/dashboard/suppliers/actions.ts` | `softDeleteSupplier` | Rejects if referenced by items unless `force=true` |
| Force delete supplier | `src/app/dashboard/suppliers/actions.ts` | `softDeleteSupplier(..., true)` | |
| Restore supplier | `src/app/dashboard/suppliers/actions.ts` | `restoreSupplier` | |
| Count items for supplier | — | `getSupplierItemCount` | Used by delete guard |

### Trips

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| List trips (paginated, filters) | — | `getTrips`, `getTripsWithClients` | Filters: query, status, dates, clients, tags, currency |
| Get trip details | — | `getTripById` | Full graph: clients, tags, days, items, docs, photos, packing, history |
| Create trip | `src/app/dashboard/trips/new/actions.ts` | `createTrip` | Requires ≥1 client; auto-generates slug |
| Create trip from template | `src/app/dashboard/trips/new/actions.ts` | `createTripFromTemplate` | Copies days/items without documents |
| Duplicate trip | `src/app/dashboard/trips/[id]/actions.ts` | `createTrip`, `createTripDay`, `createItem` | Copies days/items without documents |
| Update trip metadata | `src/app/dashboard/trips/[id]/actions.ts` | `updateTrip` | Title, dates, instructions, budget, status, currency, showCostsToClient, salePrice, commissionRate |
| Publish / archive / draft | `src/app/dashboard/trips/[id]/actions.ts`, `src/app/dashboard/actions.ts` | `updateTrip` | `publishTripStatusAction`, `moveTripStatusAction`, `bulkUpdateTripStatusAction` |
| Set trip clients | `src/app/dashboard/trips/[id]/actions.ts` | `setTripClients` | Diff semantics; ≥1 client |
| Set trip tags | `src/app/dashboard/trips/[id]/actions.ts` | `setTripTags`, `getOrCreateTag` | Diff semantics |
| Internal notes | `src/app/dashboard/trips/[id]/actions.ts` | `getTripInternalNotes`, `updateTripInternalNotes` | Never exposed to `/t/[slug]` |
| Save trip as template | `src/app/dashboard/trips/[id]/actions.ts` | `saveTripAsTemplate` | Creates `is_template=true` trip |
| List templates | — | `getTemplates` | |

### Trip Days

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| Add day | `src/app/dashboard/trips/[id]/actions.ts` | `createTripDay` | |
| Edit day | `src/app/dashboard/trips/[id]/actions.ts` | `updateTripDay` | Date + notes |
| Delete day | `src/app/dashboard/trips/[id]/actions.ts` | `deleteTripDay` | Soft delete |
| Restore day | `src/app/dashboard/trips/[id]/actions.ts` | `restoreTripDay` | |
| Generate days from start/end dates | `src/app/dashboard/trips/[id]/actions.ts` | `generateTripDays` | Creates missing days and reorders chronologically |
| Reorder days (move up/down) | `src/app/dashboard/trips/[id]/actions.ts` | `reorderTripDays` | Swaps `sort_order` |

### Items

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| Add item | `src/app/dashboard/trips/[id]/actions.ts` | `createItem` | Type-specific metadata validated |
| Edit item | `src/app/dashboard/trips/[id]/actions.ts` | `updateItem` | |
| Delete item | `src/app/dashboard/trips/[id]/actions.ts` | `deleteItem` | Soft delete |
| Restore item | `src/app/dashboard/trips/[id]/actions.ts` | `restoreItem` | |
| Move item to another day | `src/app/dashboard/trips/[id]/actions.ts` | `moveItemToDay` | |
| Duplicate item | `src/app/dashboard/trips/[id]/actions.ts` | `duplicateItem` | |
| Reorder items (move up/down) | `src/app/dashboard/trips/[id]/actions.ts` | `reorderItems` | Swaps `sort_order` |
| Get item documents | `src/app/dashboard/trips/[id]/actions.ts` | `getItemDocuments` | |
| Upload item document | `src/app/dashboard/trips/[id]/actions.ts` | `uploadItemDocument` | Private bucket `trip-documents` |
| Delete item document | `src/app/dashboard/trips/[id]/actions.ts` | `deleteDocument` | |

### Packing List

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| Add packing item | `src/app/dashboard/trips/[id]/actions.ts` | `createPackingItem` | |
| Toggle checked | `src/app/dashboard/trips/[id]/actions.ts` | `updatePackingItem` | |
| Delete packing item | `src/app/dashboard/trips/[id]/actions.ts` | `deletePackingItem` | |

### Photos / Global Trip Documents / Cover

| Action | Server Action | Data Function(s) | Notes |
|--------|---------------|------------------|-------|
| Upload trip photo | `src/app/dashboard/trips/[id]/actions.ts` | `uploadTripPhoto` | Public bucket `trip-photos` |
| Delete trip photo | `src/app/dashboard/trips/[id]/actions.ts` | `deleteTripPhoto` | |
| Upload trip cover | `src/app/dashboard/trips/[id]/actions.ts` | `uploadTripCoverImage` | Public bucket `trip-photos` |
| Remove trip cover | `src/app/dashboard/trips/[id]/actions.ts` | `removeTripCoverImage` | |
| Upload trip document | `src/app/dashboard/trips/[id]/actions.ts` | `uploadTripDocument` | Private bucket `trip-documents` under trips/{id}/ |
| List trip documents | `src/app/dashboard/trips/[id]/actions.ts` | `getTripDocuments` | |
| Delete trip document | `src/app/dashboard/trips/[id]/actions.ts` | `deleteTripDocument` | |

## 3. Data Access Layer

`src/lib/data.ts` is the single source of truth for all data access. It implements a dual-mode branch:

- **Supabase mode**: uses `createClient()` from `src/lib/supabase/server.ts`, which creates a cookie-aware Supabase SSR client with the anon key. RLS enforces that only an authenticated Supabase Auth session can read/write private tables; the public view `/t/[slug]` uses the same client but is limited by RLS to published trips.
- **Mock mode**: if `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` are missing, it falls back to in-memory arrays in `src/lib/mock-data.ts`.

For an MCP server running on Vercel, the mock path is irrelevant in production. The real question is how to bypass RLS without a browser cookie session. Options:

1. **Service role key** (`SUPABASE_SERVICE_ROLE_KEY`): already used for server-side storage and could be used with `createClient(url, serviceRoleKey, { ... })` to bypass RLS. This is the simplest path, but the key is all-powerful and must never be exposed to the client.
2. **PostgREST/Postgres direct connection**: possible, but introduces a second query language and abandons the `src/lib/data.ts` abstraction.
3. **Reuse `src/lib/data.ts` via a service-role Supabase client**: preferred. Refactor `src/lib/supabase/server.ts` to expose a service-role client factory that the MCP Route Handler can request explicitly, then call existing `data.ts` functions.

Important: `src/lib/data.ts` relies on `crypto.randomUUID()`, which is available in Node.js 19+ and in modern edge runtimes. Vercel's Node.js runtime supports it.

## 4. Auth Model

- Supabase Auth with email+password.
- Single admin user; no public registration (`src/app/login/actions.ts`).
- `src/middleware.ts` protects `/dashboard/**`; unauthenticated users are redirected to `/login`.
- RLS policies (`0001_init.sql`, `0003_rls_harden.sql`) grant full CRUD to any `auth.uid() is not null` session and read-only public access only to published trips.

An MCP client cannot log in through the browser login form and cannot send the Supabase session cookie in a machine-to-machine call (or should not be expected to). Therefore the MCP layer needs its own authentication boundary. The most pragmatic choices for a single-tenant app:

- **API key** (`MCP_API_KEY` env var): the MCP Route Handler rejects requests without a valid `Authorization: Bearer <key>` header. Simple, stateless, easy to rotate.
- **Supabase service role key as the MCP bearer token**: reuses an existing secret, but couples transport auth to database privilege. Not recommended.
- **OAuth2 / JWT with a small allow-list**: over-engineered for one agent today, but more scalable if the agent later wants to give limited access to assistants.

Recommendation: start with a dedicated `MCP_API_KEY` secret and document rotation.

## 5. Hosting Options

TravelHub deploys to Vercel on every push to `main`. There is no separate API server today. Viable MCP hosting options:

### Option A: Next.js Route Handler inside the same app (recommended)

Add `src/app/api/mcp/route.ts` that exposes MCP over Streamable HTTP using `@modelcontextprotocol/server` and `WebStandardStreamableHTTPServerTransport` (web-standard Request/Response objects, matching Next.js Route Handlers).

- **Pros**: no extra service, same repo, same deploy pipeline, reuse `src/lib/data.ts`, Vercel supports HTTP streaming natively, no extra cost tier for a separate server.
- **Cons**: MCP handler competes for the same function concurrency/timeout budget as the web app; long-lived SSE sessions are still bounded by Vercel's serverless limits; cold starts affect the first MCP request.
- **Effort**: Low-Medium.

### Option B: Standalone long-running Node MCP server

Deploy a separate Node process (for example on Railway, Fly.io, or a Vercel function pretending to be long-running). Uses stdio or SSE over a persistent HTTP server.

- **Pros**: no coupling to Next.js build/deploy, can hold long-lived SSE sessions, easier to scale independently.
- **Cons**: contradicts the stated constraint of hosting on the existing Vercel setup; requires a second service, second repo or monorepo changes, extra cost, separate secret management. Vercel functions are not designed for persistent long-running processes.
- **Effort**: Medium-High.

### Option C: Supabase Edge Functions / Deno

Run the MCP server as a Supabase Edge Function.

- **Pros**: co-located with the database, low latency, same auth domain if using Supabase service key.
- **Cons**: another runtime (Deno), another deployment step, limited npm compatibility, separate from the Next.js/Vercel workflow the user specified.
- **Effort**: Medium.

**Recommendation**: Option A. It satisfies the user's requirement to install on existing Vercel hosting, reuses the existing data layer, and the Next.js docs confirm Route Handlers support streaming/SSE responses.

## 6. Existing API Surface

The only remotely callable endpoints are:

- `src/app/api/cron/trip-reminders/route.ts` — `GET`, protected by optional `CRON_SECRET`, sends reminder emails via Resend.
- `src/app/api/flight-status/route.ts` — `GET`, public, returns live flight status (if `FLIGHT_API_KEY` is set).

All other mutations are Server Actions (`"use server"`). Server Actions:

- Are invoked only from the React server runtime with the current request's cookies.
- Are not exposed as HTTP endpoints that an external client can call directly.
- Cannot be reused by an MCP client without reimplementing cookie/session handling.

Therefore the MCP server should not attempt to call Server Actions; it should call `src/lib/data.ts` directly from a Route Handler.

## 7. MCP Server/Client Design Considerations

### Server surface

The MCP server should expose the agent's capabilities as **tools**. Examples:

- `list_clients`, `get_client`, `create_client`, `update_client`
- `list_suppliers`, `get_supplier`, `create_supplier`, `update_supplier`, `delete_supplier`
- `list_trips`, `get_trip`, `create_trip`, `update_trip`, `publish_trip`, `archive_trip`
- `add_trip_day`, `update_trip_day`, `delete_trip_day`, `generate_trip_days`
- `add_item`, `update_item`, `delete_item`, `move_item`, `duplicate_item`
- `upload_document` (with a documented limitation on binary content over JSON-RPC)
- `list_templates`, `create_trip_from_template`

**Resources** could expose read-only data (for example `trip://{id}`), but tools are more natural for the CRUD operations the agent performs.

**Prompts** could provide a reusable "build a trip itinerary" prompt template, but are optional for an MVP.

Input schemas should be defined with Zod v4 (already a dependency via the MCP SDK's Standard Schema support) or JSON Schema via `fromJsonSchema`. The project already uses Zod v4 in `src/lib/item-metadata-schemas.ts`.

### Transport

The MCP spec supports two primary transports: stdio and Streamable HTTP. For a Vercel-hosted remote server, **Streamable HTTP** is the only viable choice. The current SDK version uses:

- `WebStandardStreamableHTTPServerTransport` for web-standard Request/Response environments (matches Next.js Route Handlers).
- `NodeStreamableHTTPServerTransport` for Node `IncomingMessage`/`ServerResponse`.

The older `SSEServerTransport` has been removed from the main SDK in favor of Streamable HTTP; a legacy package exists only as a bridge.

Streamable HTTP means the client makes `POST /mcp` calls with JSON-RPC bodies. Server-sent events can stream progress or partial results if needed. There is no persistent WebSocket and no long-running process required at the protocol level, which fits Vercel's serverless model.

### Client generation

The user asked for "specifications needed so an MCP client can be generated." The MCP server itself is the specification: a client using the official `@modelcontextprotocol/client` SDK can call `client.listTools()` and discover names, descriptions, and input schemas at runtime. There is no need to generate a separate OpenAPI spec for that purpose.

However, if the team wants documentation or codegen that is not MCP-native (for example a Swagger UI or generated TypeScript client), an OpenAPI bridge could be built by enumerating the tool schemas and mapping them to operation objects. This is extra work and not required for MCP client generation.

**Recommendation**: document the MCP endpoint URL, required `Authorization` header, and protocol version. Provide a sample client connection snippet using `@modelcontextprotocol/client` with `HttpClientTransport`. Treat OpenAPI as a future optional layer, not as the primary intermediary.

## 8. Constraints, Risks, and Open Questions

### Constraints

1. **Vercel serverless**: functions have a maximum execution time (default hobby 10 s, pro 60 s, enterprise 300 s/900 s). Heavy bulk operations must be kept within these bounds or split into multiple tool calls.
2. **No persistent state**: each MCP request runs in a fresh invocation. Session-based multi-turn tool logic must be stateless or use the database.
3. **Binary uploads**: MCP tools exchange JSON. Uploading documents or images through the MCP tool layer is awkward; a common pattern is to return a pre-signed upload URL as a tool result and have the client upload to Supabase Storage directly.
4. **RLS/auth boundary**: the MCP handler must use a service-role or equivalent privileged Supabase client and enforce its own authorization via `MCP_API_KEY`.
5. **Mock mode**: in local development without Supabase, the MCP server would operate on in-memory mock data. That is acceptable for local testing but must not be enabled in production.
6. **Public view isolation**: `/t/[slug]` must continue to read only published trips. The MCP server must not weaken RLS or expose internal notes/salePrice/commissionRate to public clients.

### Risks / Blockers

- **Service role key exposure**: if `SUPABASE_SERVICE_ROLE_KEY` leaks, an attacker has full database access. Strict env var discipline is required.
- **Blast radius**: a single `MCP_API_KEY` gives an AI agent the same power as the human admin. There is no role-based access control today.
- **Transport SDK stability**: Streamable HTTP is the current spec direction, but SDK APIs (especially around `@modelcontextprotocol/server` v2) may still shift. Pin a specific version and review upgrade notes.
- **Cold starts + streaming**: Vercel function cold starts plus SDK initialization could add noticeable latency to the first MCP tool call.
- **File upload semantics**: MCP does not define a standard file-upload tool shape; the proposal must decide how documents/photos/covers are handled.
- **Next.js Route Handler + SDK compatibility**: need to confirm that `createMcpHandler` or `WebStandardStreamableHTTPServerTransport` integrates cleanly with Next.js 16 Route Handlers and Node.js runtime (not Edge runtime).

### Open questions for the proposal phase

1. Should the MCP server run at `/api/mcp` or a dedicated subdomain/path?
2. What is the exact auth mechanism: single `MCP_API_KEY`, signed JWT, or OAuth2 machine-to-machine?
3. Should the MCP server support document/photo upload, or only return pre-signed URLs?
4. Which subset of the actions above should be exposed in the first release (MVP)?
5. Should internal notes, sale price, and commission rate be exposed to the MCP agent? (They are currently dashboard-only.)
6. Is mock-mode MCP support required for local development, or should the MCP server require Supabase configuration?
7. Do we need an OpenAPI bridge in addition to the native MCP tool surface?

## Recommendation to the Proposal Phase

Proceed with **Option A**: a Next.js Route Handler at `src/app/api/mcp/route.ts` exposing MCP over **Streamable HTTP** via the official TypeScript SDK, authenticating with a dedicated `MCP_API_KEY`, and calling existing `src/lib/data.ts` functions through a service-role Supabase client. Defer OpenAPI, document upload details, and fine-grained authorization to the proposal/design phase.
