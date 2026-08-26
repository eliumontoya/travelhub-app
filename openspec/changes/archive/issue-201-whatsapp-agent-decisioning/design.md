# Design: WhatsApp inbound agent decisioning (issue #201)

## Module

Add `src/lib/ai/whatsapp-inbound-agent.ts`.

## Public API

- `loadApprovedWhatsAppKnowledgeEntries(client?)`
  - Reads approved knowledge entries from Supabase when configured.
  - Returns `[]` when configuration/read is unavailable to preserve local/test graceful degradation.
- `decideWhatsAppInboundMessage(input, options?)`
  - Accepts message text plus optional contact/conversation metadata and optional preloaded knowledge.
  - Accepts an injected `provider` returning unknown structured output or JSON string.
  - Performs deterministic conservative gates before provider invocation.
  - Validates provider output with `zod`.
  - Returns `WhatsAppInboundAgentDecision`.

## Provider strategy

No new AI package is added in this issue. Production orchestration can inject an OpenAI/Vercel provider in a later issue. The default provider degrades safely by returning `needs_human` so tests/local runs require no API key.

## Safety rules

- Empty message → `needs_human`.
- No approved knowledge → `needs_human`.
- Sensitive/commercial-specific keywords → `needs_human` before provider call.
- `auto_answer` requires:
  - confidence >= 0.7
  - non-empty response text
  - at least one cited knowledge id
  - every cited id exists in the approved knowledge set
- Invalid/malformed provider output → `needs_human`.

## Data access

Read only from `whatsapp_knowledge_entries` using Supabase. Query filters `status = approved`, orders by `approved_at`, and limits rows to avoid unbounded reads. No writes are made.
