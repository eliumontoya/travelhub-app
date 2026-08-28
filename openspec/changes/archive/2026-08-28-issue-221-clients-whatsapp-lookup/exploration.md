# Exploration: issue #221 clients.whatsapp lookup

## Current State
Dynamic TravelHub tools are server-side and allowlisted in `src/lib/ai/tools/travelhub-client-tools.ts`. `getClientByWhatsappPhone` currently resolves `whatsapp_contacts.linked_client_id` first, then falls back to an exact `.in("phone", [raw, digits])` match on `clients.phone`. The inbound service passes `event.fromPhone`, already normalized as E.164 digits without `+`, then uses the resolved client id to query `trip_clients` and legacy `trips.client_id`.

## Affected Areas
- `supabase/migrations/` — add CRM WhatsApp field, backfill, trigger, and lookup index.
- `src/lib/ai/tools/travelhub-client-tools.ts` — change client lookup priority and normalized comparison.
- `src/lib/ai/__tests__/travelhub-client-tools.test.ts` — unit coverage for CRM WhatsApp priority, ambiguity, and manual-link fallback.
- `src/__tests__/whatsapp-client-lookup-migration.test.ts` — migration contract coverage.
- `openspec/specs/whatsapp-inbound-automation/spec.md` — archive updated behavior.
- `doc/whatsapp-simulated-inbound-tests.md` — operator setup note for `clients.whatsapp`.

## Approaches
1. **CRM WhatsApp first, manual link fallback** — Query normalized `clients.whatsapp`, then `whatsapp_contacts.linked_client_id`, then legacy `clients.phone`.
   - Pros: matches new CRM source-of-truth while preserving manual override for contacts not reflected in CRM.
   - Cons: one extra query before manual link.
   - Effort: Low.
2. **Manual link override first, CRM WhatsApp second** — Keep current override precedence and add `clients.whatsapp` before `phone`.
   - Pros: least behavioral change.
   - Cons: conflicts with issue request that `clients.whatsapp` be reliable/prioritary.
   - Effort: Low.

## Recommendation
Use Approach 1. Priority: exact normalized `clients.whatsapp`; if absent/no match, honor `whatsapp_contacts.linked_client_id` as a manual compatibility override; finally keep normalized `clients.phone` fallback for old rows and migration lag.

## Risks
- Existing CRM phone formats vary; use an expression index on `regexp_replace(whatsapp, '\\D', '', 'g')` and query the same expression via `.or(...)` patterns compatible with PostgREST.
- Duplicate WhatsApp values can create ambiguity; return `ambiguous` rather than exposing trip data.

## Ready for Proposal
Yes — requirements are bounded to database schema, lookup priority, tests, and docs.
