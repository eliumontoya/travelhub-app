# Proposal: WhatsApp response orchestration and escalation (#202)

## Summary

Create the WhatsApp inbound orchestrator that takes normalized webhook events through persistence, context loading, agent decisioning, auto-answer or human escalation, outbound message persistence, and CRM staging events.

## Scope

In scope:

- `src/lib/whatsapp/inbound-service.ts` orchestration module.
- `src/lib/whatsapp/client.ts` server-side Meta WhatsApp Cloud API text transport.
- `src/lib/whatsapp/escalation.ts` escalation work composition.
- Store extensions for inbound persistence results, context reads, intent writes, outbound message writes, escalation writes, CRM event writes, and conversation/message status updates.
- Webhook POST delegation to the orchestrator.
- Unit tests for auto-answer, human escalation, unsupported message escalation, client request construction, and duplicate send suppression.

Out of scope:

- Dashboard inbox UI.
- Proactive outbound/cron queue agent.
- Broad retry/reliability operations beyond deterministic immediate idempotency.
- Marketing templates/campaigns.
- New Supabase tables or RLS policy changes.

## Rollback plan

Revert the code modules/tests and restore webhook POST delegation to `ingestWhatsAppInboundEvents`. No database migration is introduced, so rollback is code-only.
