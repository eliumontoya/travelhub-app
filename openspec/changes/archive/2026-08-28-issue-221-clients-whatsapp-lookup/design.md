# Design: CRM WhatsApp Client Lookup

## Technical Approach
Use Hybrid SDD artifacts and an additive Supabase migration. The lookup tool remains server-side/allowlisted; the LLM receives only safe tool results. `event.fromPhone` stays the input contract and is normalized with the existing digits-only helper.

## Architecture Decisions
| Decision | Choice | Alternatives | Rationale |
|---|---|---|---|
| Lookup priority | `clients.whatsapp` first, then manual `whatsapp_contacts.linked_client_id`, then legacy `clients.phone` | Keep manual link first | Issue #221 makes CRM WhatsApp the source of truth; manual link still helps as fallback/override when CRM is absent. |
| DB defaulting | BEFORE insert/update trigger copies `phone` into blank `whatsapp` | App-only copy | DB rule protects imports, scripts, and future UI paths. |
| Index | Partial btree on `clients.whatsapp_normalized`, maintained by the same trigger, where non-null | Plain index on raw text | PostgREST can reliably filter a stored normalized column; partial index avoids empty rows. |
| Ambiguity | Return `ambiguous` at current tier | Pick first row | Safer privacy behavior: do not expose trips when identity is uncertain. |

## Data Flow

    Meta webhook fromPhone (digits) -> inbound-service
      -> getClientByWhatsappPhone
        -> clients.whatsapp normalized exact match
        -> whatsapp_contacts.linked_client_id fallback
        -> clients.phone normalized legacy fallback
      -> getClientActiveTrips -> trip-scoped tools -> safe LLM context

## File Changes
| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/<timestamp>_clients_whatsapp_lookup.sql` | Create | WhatsApp column, normalized helper column, backfill, trigger/function, normalized index. |
| `src/lib/ai/tools/travelhub-client-tools.ts` | Modify | Add tiered normalized lookup helpers and priority. |
| `src/lib/ai/__tests__/travelhub-client-tools.test.ts` | Modify | Unit tests for CRM match, ambiguity, fallback. |
| `src/__tests__/whatsapp-client-lookup-migration.test.ts` | Create | Migration SQL contract test. |
| `src/types/index.ts`, `src/lib/data.ts`, `src/lib/mock-data.ts` | Modify | Surface optional `whatsapp` client field safely. |
| `doc/whatsapp-simulated-inbound-tests.md` | Modify | Add setup/verification note. |

## Interfaces / Contracts
`Client.whatsapp?: string` maps to `clients.whatsapp`. Tool result shape stays unchanged: `{ found, clientId, displayName, matchConfidence }`.

## Testing Strategy
| Layer | What to Test | Approach |
|---|---|---|
| Unit | Lookup priority, ambiguity, fallback | Vitest mock Supabase query chain. |
| Unit | Migration contract | Read SQL file and assert column/backfill/trigger/index. |
| Type/build | Type compatibility | `npx tsc --noEmit`, `npm run build`. |

## Threat Matrix
N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is introduced.

## Migration / Rollout
Apply the migration to production Supabase before relying on CRM WhatsApp lookup. It is additive and nullable; existing rows backfill from `phone`. Existing manual links and phone fallback remain available during rollout.

## Open Questions
None.
