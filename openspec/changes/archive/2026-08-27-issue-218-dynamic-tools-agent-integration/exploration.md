# Exploration: issue #218 — Dynamic TravelHub tools in WhatsApp inbound agent

## Existing context
- Issue #209 / PR #216 is merged into `main` and provides `src/lib/ai/tools/travelhub-client-tools.ts`.
- Those tools already enforce an allowlist, typed inputs, phone/client lookup, trip ownership, data minimization, payment escalation, and best-effort CRM audit.
- `processWhatsAppInboundEvents` currently persists an inbound message, loads conversation context, calls `decideWhatsAppInboundMessage`, then records either auto-answer or human escalation side effects.
- `decideWhatsAppInboundMessage` currently gives providers approved knowledge only; internal TravelHub data is unavailable to the provider.
- `createWhatsAppLLMProvider` prompts the model to escalate when customer/trip data is needed.

## Constraints
- Do not expose Supabase credentials, raw SQL, or unrestricted table access to the LLM.
- Keep the tool router server-side and allowlisted.
- Keep inbound idempotency: duplicate provider ids must skip tool execution, model calls, and sends.
- Payment questions remain human-handled until explicit payment schema/policy exists.
- Audit failures must not block a safe customer response.

## Integration points
- Add a dynamic tool context type to the inbound agent contract.
- Build a server-side orchestrator in `src/lib/whatsapp/inbound-service.ts` that detects dynamic TravelHub questions, resolves the sender by `event.fromPhone`, then calls allowlisted tools.
- Pass sanitized tool results to `decideWhatsAppInboundMessage` and to the LLM provider prompt.
- Persist dynamic tool evidence through the existing intent/CRM payloads without storing secrets.

## Risks
- If the model sees raw tool outputs without guardrails, it may overstate certainty. Mitigation: only pass minimized tool output and require citations to successful tool call ids.
- If no approved knowledge exists, the old agent path short-circuits. Mitigation: allow provider evaluation when dynamic tool results exist.
- Ambiguous trips must not result in guessed answers. Mitigation: model prompt and safety gates distinguish `success` from `ambiguous`/`not_found`/`blocked`/`error`/`needs_human`.
