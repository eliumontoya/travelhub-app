# Exploration: WCC Contacts List and Detail

Current WCC shell exists under `src/app/dashboard/wcc` with placeholder contact links and a safe dashboard helper. WhatsApp tables and types already include contacts, conversations, intents, escalations, and optional `linked_client_id`; indexes exist on `whatsapp_contacts.last_message_at`, linked client, and related table contact ids/status dates.

Affected areas: `src/app/dashboard/wcc/layout.tsx` for real contacts nav, new contacts routes under `src/app/dashboard/wcc/contacts`, new `src/lib/wcc-contacts.ts`, focused tests, and `wcc-command-center` spec.

Recommended approach: add read-only Server Component routes and one safe Supabase helper. The list orders by recent activity (`last_message_at` then `created_at`) and paginates with range/count. Detail loads the contact plus limited related conversations, escalations, and intents for context only. If Supabase is absent or WhatsApp tables are unavailable, render safe empty/unavailable states.

Risks: Supabase nested client joins can fail in partially migrated environments; catch helper errors and avoid page crashes. Scope creep into escalation queue/conversation main/knowledge CRUD is avoided by linking only to future placeholders/context.
