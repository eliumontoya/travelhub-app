# Proposal: WhatsApp inbound data foundation (issue #199)

## Intent

Create the Supabase/Postgres and TypeScript contracts needed by the WhatsApp inbound agent epic (#198) before implementing webhooks, LLM decisioning, orchestration, or UI.

## Scope

### In scope

- Add Supabase tables:
  - `whatsapp_contacts`
  - `whatsapp_conversations`
  - `whatsapp_messages`
  - `whatsapp_intents`
  - `whatsapp_escalations`
  - `whatsapp_knowledge_entries`
  - `crm_sync_events`
- Enable/force RLS, revoke `anon`, grant mono-admin access to `authenticated`, and rely on service role for server writes.
- Add indexes for phone, conversations, WhatsApp message ids, status filters, and timestamp polling/sorting.
- Add TypeScript domain types in `src/types/index.ts`.
- Add OpenSpec capabilities for `whatsapp-inbound-automation` and `crm-sync-staging`.

### Out of scope

- Meta webhook route, validation, normalization, and idempotent ingest logic.
- WhatsApp outbound API client.
- LLM agent prompts/decisioning.
- `src/lib/whatsapp/inbound-service.ts` orchestration.
- Dashboard UI.
- Actual external CRM API integration.

## Capability split

This change introduces two capabilities:

1. `whatsapp-inbound-automation`: contacts, conversations, messages, intents, escalations, and approved knowledge.
2. `crm-sync-staging`: durable pending/processed/failed event queue for external CRM sync.

`crm_sync_events` is shipped in this issue because #199 explicitly includes CRM staging, but it is specified separately because the queue should remain reusable beyond WhatsApp.

## Risks

| Risk | Likelihood | Mitigation |
|---|---:|---|
| Schema too broad for phase 1 | Medium | Keep tables additive, no app/UI code depends on them yet. |
| RLS accidentally exposes private WhatsApp messages | Low | No `anon` grants; RLS enabled/forced on all new tables; tests inspect grants/policies. |
| Status values need adjustment in later phases | Medium | Use `text check` constraints, matching existing project style and easier additive migration changes than enums. |
| External CRM processor auth model not finalized | Medium | Queue is service-role/admin accessible only now; dedicated processor auth can be added later without anon exposure. |

## Rollback plan

Because the change is additive and no runtime code writes these tables yet, rollback is a single revert of the PR before deployment. If already applied to a database, a follow-up migration can drop the seven new tables and their indexes/policies/triggers in reverse dependency order.

## Success criteria

- The seven required tables exist in the migration.
- RLS is enabled/forced and `anon` has no direct grants.
- Admin `authenticated` access is explicit.
- Indexes cover phone lookup, conversation/message joins, WhatsApp message id dedupe, statuses, and timestamp processing.
- TypeScript contracts expose row/status shapes for later implementation phases.
- Verification commands from `openspec/config.yaml` pass or have documented environment-only warnings.
