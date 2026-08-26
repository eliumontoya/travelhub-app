# Proposal: WhatsApp inbound agent decisioning (issue #201)

## Summary

Add a side-effect-free WhatsApp inbound decisioning module that loads approved knowledge, asks an injected LLM/decision provider for structured output, validates the result, and conservatively decides between `auto_answer` and `needs_human`.

## Scope

In scope:

- Approved knowledge retrieval from `whatsapp_knowledge_entries`.
- `src/lib/ai/whatsapp-inbound-agent.ts` public contracts and decisioning function.
- Strict output validation for intent, summary, confidence, decision, response text, escalation reason, and cited knowledge ids.
- Conservative safety/commercial-specific escalation.
- Unit tests with injected mocks; no live OpenAI key required.

Out of scope:

- Webhook route orchestration changes beyond type compatibility if needed.
- Writing `whatsapp_intents`, message status, escalation rows, or CRM events.
- Sending WhatsApp outbound messages.
- Dashboard/UI.
- Adding/pinning AI SDK/OpenAI package dependencies.

## Rollback plan

Remove `src/lib/ai/whatsapp-inbound-agent.ts`, its tests, and the OpenSpec delta. No database migration is introduced, so rollback is code-only.
