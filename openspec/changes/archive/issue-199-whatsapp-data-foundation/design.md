# Design: WhatsApp inbound data foundation (issue #199)

## Technical approach

Add a single additive Supabase migration for the seven required tables and append TypeScript domain contracts to `src/types/index.ts`. No runtime Next.js route, Server Action, UI, webhook, or LLM code is introduced in this phase.

## Migration

Use `supabase migration new whatsapp_inbound_data_foundation` per Supabase CLI guidance. The migration will:

1. Create WhatsApp tables in dependency order:
   - `whatsapp_contacts`
   - `whatsapp_conversations`
   - `whatsapp_messages`
   - `whatsapp_intents`
   - `whatsapp_escalations`
   - `whatsapp_knowledge_entries`
2. Create generic CRM staging table:
   - `crm_sync_events`
3. Use `uuid primary key default gen_random_uuid()` to match existing TravelHub migrations.
4. Use `text check (...)` constraints for statuses instead of Postgres enum types.
5. Use JSONB only for flexible provider payloads/entities/media, not as the primary model.
6. Add `updated_at` triggers for mutable tables using the existing `set_updated_at()` function from migration `0016_activity_feed.sql`.
7. Enable and force RLS for all new tables.
8. Revoke all privileges from `anon` and `authenticated`, then grant explicit CRUD only to `authenticated`.
9. Create one mono-admin policy per table: `for all to authenticated using ((select auth.uid()) is not null) with check ((select auth.uid()) is not null)`.

## Index strategy

- `whatsapp_contacts(phone_e164)` unique for lookup and identity.
- Conversation/contact FK indexes for joins.
- `whatsapp_messages(whatsapp_message_id)` unique for webhook idempotency.
- Status and timestamp indexes on conversations, messages, escalations, knowledge, and CRM events.
- Partial index on pending CRM events by `available_at` for efficient future polling.
- Partial unique index on `crm_sync_events(event_key)` where not null for optional idempotency.

## TypeScript contracts

Append status unions and interfaces to `src/types/index.ts`:

- `WhatsAppContact`
- `WhatsAppConversation`
- `WhatsAppMessage`
- `WhatsAppIntent`
- `WhatsAppEscalation`
- `WhatsAppKnowledgeEntry`
- `CrmSyncEvent`

Types mirror database row names in camelCase for app code while preserving flexible JSON payloads as `Record<string, unknown>`.

## Tests / verification

Strict TDD path:

1. Add a focused Vitest contract test that fails before the migration/types exist.
2. Implement migration and types.
3. Run focused test, full unit tests, lint, typecheck, and build.
4. Attempt `supabase db lint`/advisors if available; if credentials/Docker are unavailable, document the limitation.

## Future extension points

- Issue #200 can implement webhook ingestion against `whatsapp_contacts`, `whatsapp_conversations`, and `whatsapp_messages`.
- Issue #201 can populate `whatsapp_intents` and read approved `whatsapp_knowledge_entries`.
- Issue #202 can update conversation/escalation statuses and stage CRM events.
- Issue #203 can add operational retries/cron and queue processor hardening.
