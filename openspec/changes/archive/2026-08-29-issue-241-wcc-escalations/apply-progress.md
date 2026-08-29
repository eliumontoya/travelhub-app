# Apply Progress: WCC Escalations Queue

## Completed
- Added `src/lib/wcc-escalations.ts` with read-only queue reads, allowlisted status/priority filters, recent-first ordering, and batched contact/conversation enrichment.
- Added `/dashboard/wcc/escalations` page and loading state.
- Updated WCC navigation to link Escalaciones to the real route.
- Added focused Vitest coverage for fallback, mapping/enrichment, filter allowlisting, and unavailable states.

## Scope Guard
- No escalation mutations were added.
- No conversations main view or knowledge CRUD was implemented.
- No webhook, bot, schema, or migration behavior changed.
