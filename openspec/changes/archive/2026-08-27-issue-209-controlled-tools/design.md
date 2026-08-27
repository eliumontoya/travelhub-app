# Design: Controlled TravelHub Data Tools

## Overview
Add a server-only controlled tool layer for future WhatsApp agent use. The layer exposes a small allowlist of typed functions and a router; the LLM can request tool names/arguments, but only application code runs Supabase queries.

## Decisions

1. **Single module first**: implement `src/lib/ai/tools/travelhub-client-tools.ts` for the first slice. It keeps contracts, guards, and query helpers together while the tool surface is small.
2. **Service-role server adapter**: use server-side Supabase service-role configuration inside the module. The key is never passed to the LLM; only safe structured results are returned.
3. **Ownership before details**: trip-scoped tools call a shared ownership guard using `trip_clients` plus legacy `trips.client_id` fallback before reading summaries, itinerary, or documents.
4. **Safe payment response**: no payment tables exist, so `getTripPaymentStatus` returns `needs_human`/`policy_required` instead of fabricated amounts.
5. **Audit via CRM staging**: reuse `crm_sync_events` for sanitized `whatsapp.tool_called` events. Audit is best-effort and non-fatal.

## Tool Contracts
- `getClientByWhatsappPhone({ phone })`
- `getClientActiveTrips({ clientId })`
- `getTripSummary({ clientId, tripId })`
- `getTripItineraryStatus({ clientId, tripId })`
- `getTripPaymentStatus({ clientId, tripId })`
- `getTripDocumentsStatus({ clientId, tripId })`

Each returns `{ tool, status, data?, reason?, audit? }`, where `status` is one of `success`, `not_found`, `ambiguous`, `blocked`, `needs_human`, or `error`.

## Data Flow
```txt
LLM structured tool request
→ runTravelHubClientTool allowlist + typed validation
→ ownership/client lookup guard
→ code-authored Supabase query
→ safe projection
→ best-effort crm_sync_events audit
→ structured result back to orchestrator/agent
```

## Safety Notes
- No raw SQL strings are accepted from caller input.
- No storage paths, signed URLs, secrets, or raw Supabase errors are returned.
- Invalid tool names and invalid input are blocked before domain-table reads.
- Ambiguity returns concise choices rather than selecting silently.

## Verification
- Unit tests use a mocked Supabase chain to prove query ordering, ownership blocking, ambiguity, safe payment handling, and non-fatal audit failures.
- Run focused Vitest, full Vitest, typecheck, and build.
