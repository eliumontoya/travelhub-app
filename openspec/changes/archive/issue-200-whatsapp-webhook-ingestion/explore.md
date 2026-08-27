# Explore: WhatsApp webhook ingestion (issue #200)

## Sources read

- `AGENTS.md`, `project.md`, `architecture.md`
- GitHub issue #200 and epic #198
- `openspec/config.yaml`
- `openspec/specs/whatsapp-inbound-automation/spec.md`
- `openspec/specs/crm-sync-staging/spec.md`
- `supabase/migrations/20260826194451_whatsapp_inbound_data_foundation.sql`
- Next.js local docs: `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and route file convention docs
- Supabase/Postgres best-practices skill: upsert, constraints, privileges

## Current state

Issue #199 added private Supabase tables for WhatsApp contacts, conversations, messages, intents, escalations, knowledge, and CRM sync events. The existing WhatsApp spec includes contact persistence, conversation lifecycle representation, idempotent message ledger, and privacy requirements, but it does not yet specify HTTP webhook ingestion behavior.

## Missing referenced doc

`doc/whatsapp-inbound-agent-architecture.md` is referenced by #198/#200 but is absent in this worktree. The implementation will rely on the issue bodies, #199 specs/migration, and project architecture.

## Meta webhook payload shape assumptions

This phase supports the stable WhatsApp Cloud API webhook structure:

- `object: "whatsapp_business_account"`
- `entry[].changes[].value.metadata.phone_number_id`
- `entry[].changes[].value.contacts[]`
- `entry[].changes[].value.messages[]`
- inbound messages include `from`, `id`, `timestamp`, `type`
- text messages include `text.body`

Unsupported message types are still normalized with `messageType` and full raw payload, while `body` remains absent unless a safe textual body exists.

## Data mapping

- `contacts[].wa_id` / `message.from` -> `whatsapp_contacts.phone_e164`
- profile name -> `whatsapp_contacts.whatsapp_profile_name` and default display name
- message -> `whatsapp_messages` with `direction='inbound'`, provider id, message type, body/media/payload, and timestamp
- one open conversation per contact is reused or created for this ingestion phase

## Constraints and risks

- Webhook writes require server-side Supabase service role access because #199 tables are private and RLS forced.
- Route handler must remain thin per project instruction.
- Idempotency must be enforced by `whatsapp_messages.whatsapp_message_id` unique constraint and insert-ignore/upsert behavior, not a race-prone pre-check alone.
- Signature verification is deferred because this issue can satisfy Meta GET token verification without coding signature validation against potentially changing Meta docs.
