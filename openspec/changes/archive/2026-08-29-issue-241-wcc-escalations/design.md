# Design: WCC Escalations Queue

## Overview
Add the third WCC stacked slice as a server-rendered, read-only queue route. Data access lives in a dedicated helper so the page stays presentation-only and tests can mock Supabase behavior.

## Data Access
- `getWccEscalationsQueue(filters)` validates page/status/priority inputs with allowlists.
- Primary query: `whatsapp_escalations.select(..., { count: "exact" })` ordered by `opened_at desc`, then ranged to the first page size.
- Optional filters use `eq("status", value)` and `eq("priority", value)` only after allowlist validation.
- Related contacts and conversations are loaded in two batched queries using `.in("id", ids)` to avoid N+1 lookups.
- Supabase unconfigured returns mock-safe empty state; configured read errors return unavailable empty state.

## UI
- `/dashboard/wcc/escalations` reads promise-based `searchParams` per Next 16 docs.
- Header includes WCC dashboard link and filter chips for all statuses/priorities plus clear state.
- Queue rows visually distinguish `urgent`/`high` priorities and `open`/`acknowledged` statuses.
- Contact links point to `/dashboard/wcc/contacts/[id]`; conversation context remains a non-mutating status/id label until #242 adds the main conversations view.

## Non-goals
- No status, assignment, or resolution mutations.
- No conversation main view and no knowledge CRUD.
- No schema changes; existing indexes cover status/opened_at and related IDs.

## Verification
Run focused Vitest for the helper, then TypeScript, lint, full tests, build, and e2e smoke.
