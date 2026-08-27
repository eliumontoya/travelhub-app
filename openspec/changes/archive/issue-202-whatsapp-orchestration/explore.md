# Explore: WhatsApp response orchestration and escalation (#202)

## Context

Issue #202 completes the first end-to-end inbound WhatsApp loop under epic #198 by connecting the existing data foundation (#199), webhook ingestion (#200), and side-effect-free agent decisioning (#201). All dependencies are merged into `origin/main` and the architecture document now exists at `doc/whatsapp-inbound-agent-architecture.md`.

## Inputs read

- `AGENTS.md`, `project.md`, `architecture.md`
- `doc/whatsapp-inbound-agent-architecture.md`
- GitHub issue #202 body and epic reference #198
- `openspec/config.yaml`
- `openspec/specs/whatsapp-inbound-automation/spec.md`
- `openspec/specs/crm-sync-staging/spec.md`
- `src/app/api/whatsapp/webhook/route.ts`
- `src/lib/whatsapp/normalize.ts`, `src/lib/whatsapp/store.ts`
- `src/lib/ai/whatsapp-inbound-agent.ts`
- `supabase/migrations/20260826194451_whatsapp_inbound_data_foundation.sql`
- Local Next.js 16.2.10 Route Handler docs under `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- Supabase/Supabase Postgres skills; current Supabase docs/changelog were checked for relevant RLS/Data API/security guidance.

## Baseline

- The webhook currently parses JSON, normalizes messages, and delegates only to `ingestWhatsAppInboundEvents`.
- Store persistence can upsert contacts, open conversations, inbound messages, and update conversation timestamps.
- The agent module can classify a text message and returns a structured decision, but intentionally performs no writes or outbound sends.
- Tables for messages, intents, escalations, knowledge, and CRM staging already exist with service-role private access patterns.

## Decisions

- Add `inbound-service.ts` as the only coordinator of side effects after route JSON parsing.
- Keep `route.ts` thin and synchronous: it delegates the payload to the service and returns structured processing results.
- Use dependency injection for store, agent, and WhatsApp sender so tests never call live Supabase, Meta, or OpenAI.
- Use the inbound `whatsapp_messages.id` as the service idempotency boundary: if persistence reports an existing inbound row, skip decisioning and outbound sends.
- Use deterministic outbound message ids and CRM event keys derived from the inbound message id for immediate duplicate safety.
- Missing WhatsApp credentials return structured skipped/failed send results; orchestration still records intent/outbound/escalation/CRM work.

## Supabase/Postgres considerations

No new migration is required: issue #199 already created the required private tables and the current behavior is additive code on top of them. Store methods use the service role server-side only and preserve existing RLS/private table assumptions. New queries remain indexed by existing ids, statuses, and unique keys.
