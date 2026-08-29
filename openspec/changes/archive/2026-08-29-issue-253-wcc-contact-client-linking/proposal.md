# Proposal: WCC Contact Client Linking

## Intent
Persist the TravelHub client identity already inferred by WhatsApp automation so WCC humans see linked clients consistently.

## Scope
- Auto-link `whatsapp_contacts.linked_client_id` from exact unique `clients.whatsapp_normalized` phone matches.
- Backfill existing contacts and recalculate on contact/client WhatsApp changes.
- Leave no-match/ambiguous contacts unlinked; preserve manual links.
- Out of scope: manual link UI, LLM-driven linking, public WCC exposure.

## Capabilities
- Modified: `wcc-command-center`, `whatsapp-inbound-automation`.

## Approach
Add DB-owned functions/triggers with `linked_client_source` and `linked_client_matched_at`; WCC keeps reading persisted `linked_client_id`.

## Risks / Mitigation
- Wrong link: unique exact match only.
- Manual override loss: only auto-update null/`auto_phone` rows.
- Rollback: revert migration, tests, specs, and archive files.
