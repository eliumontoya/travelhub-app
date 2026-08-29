# Design: WCC Contact Client Linking

## Approach
Database-owned deterministic linking. Migration adds provenance columns, normalizer/resolver functions, contact/client triggers, and backfill. Existing WCC helpers already map `linked_client_id` to `linkedClient`.

## Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Owner | Postgres | Consistent for webhook, imports, client edits, WCC. |
| Match | exact unique digits-only | Avoids wrong private-data linkage. |
| Provenance | `linked_client_source`, `linked_client_matched_at` | Distinguishes auto vs manual links. |
| Manual preservation | Do not overwrite non-auto links | Future manual links stay authoritative. |

## Files
- `supabase/migrations/20260829142000_wcc_contact_client_linking.sql`
- `src/__tests__/wcc-contact-client-linking-migration.test.ts`
- `src/lib/__tests__/wcc-contacts.test.ts`
- `openspec/specs/{wcc-command-center,whatsapp-inbound-automation}/spec.md`

## Testing
Focused Vitest for SQL contracts/WCC mapping; `tsc`; `next build`.

## Rollout
Additive migration; rollback drops triggers/functions/provenance columns to restore prior manual-compatible behavior.
