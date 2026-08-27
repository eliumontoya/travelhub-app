# Design: issue #218 — Dynamic TravelHub tools in WhatsApp inbound agent

## Architecture

```txt
WhatsApp webhook
  -> normalize event
  -> persist inbound message (idempotent)
  -> dynamic TravelHub tool orchestration (server-side only)
     -> getClientByWhatsappPhone(fromPhone)
     -> getClientActiveTrips(clientId)
     -> getTripSummary / getTripItineraryStatus / getTripDocumentsStatus / getTripPaymentStatus
  -> decideWhatsAppInboundMessage(message + approved knowledge + safe tool results)
  -> outbound auto-answer or escalation side effects
```

## Dynamic tool orchestration
- The inbound service classifies text messages with conservative regexes for trip/status/itinerary/document/payment questions.
- Every dynamic flow starts with `getClientByWhatsappPhone({ phone: event.fromPhone })`.
- If client resolution is not `success`, the tool result is still passed to the agent so it can answer/escalate safely without private data.
- If a conversation already has `assignedTripId`, run the relevant trip-scoped tool directly after ownership guard validation.
- Otherwise, run `getClientActiveTrips({ clientId })`.
  - `not_found`: no trip data is exposed beyond the result status.
  - `ambiguous`: pass concise trip choices so the provider can ask the client to clarify.
  - `success`: run the relevant trip-scoped tool for the single returned trip.
- Payment requests execute `getTripPaymentStatus`, which intentionally returns `needs_human`.

## Agent contract
- Add `dynamicToolResults` to provider input and decision options.
- Add `citedToolCallIds` to decisions.
- Auto-answer can be allowed when it cites either approved knowledge or successful dynamic tool calls.
- Non-success dynamic statuses must not be used as auto-answer citations.

## Persistence
- `createWhatsAppIntent` stores `citedToolCallIds` and sanitized `dynamicToolResults` inside intent entities.
- Existing CRM events include the decision payload; this now includes cited dynamic tool ids and safe results.
- Tool-level audit from PR #216 remains best-effort and non-blocking.

## Security
- LLM receives only tool names, statuses, reasons, safe payload fields, and audit metadata.
- No SQL, Supabase client, credentials, storage paths, signed URLs, or service role values are passed to the LLM.
- Ownership guard remains in `travelhub-client-tools.ts`.
