# Proposal: WhatsApp Agent Migration to Vercel Eve

**Change slug:** `eve-whatsapp-agent-migration`
**Phase:** propose
**Status:** ready for spec + design

## 1. Why

Today the WhatsApp inbound agent runs as a collection of Next.js API routes and server-side modules (`src/lib/ai/whatsapp-inbound-agent.ts`, `src/lib/whatsapp/inbound-service.ts`, `src/lib/ai/tools/travelhub-client-tools.ts`). While functional, this architecture has limitations:

- **Tight coupling**: The agent logic is embedded in Next.js API routes, making it harder to evolve independently from the web app.
- **Limited orchestration**: No built-in session management, tool chaining, or multi-turn conversation handling beyond what we manually implement.
- **Channel abstraction**: The WhatsApp channel is tightly coupled to the agent logic; adding other channels (web chat, SMS) would require significant refactoring.
- **Tool management**: Tools are manually registered and dispatched; no native tool discovery or schema validation at the framework level.

Vercel Eve provides a purpose-built agent framework with:
- **Native tool system**: `defineTool` with Zod schemas, automatic validation, and tool discovery.
- **Channel abstraction**: `chatSdkChannel` with adapter pattern for WhatsApp, Slack, Discord, etc.
- **Session management**: Built-in session tracking, compaction, and durability via Eve Workflows.
- **Skills system**: Markdown-based procedural guides that can be loaded on-demand.
- **Subagent support**: Ability to delegate to specialist child agents.

This migration moves the WhatsApp agent into the Eve framework while preserving all existing business logic, guardrails, and data access patterns.

## 2. What Changes

- A new **`agent/`** directory at the project root containing the Eve agent structure:
  - `agent.ts` — Agent config with OpenAI-compatible provider (DeepSeek V4 Flash via AI Gateway).
  - `instructions.md` — System instructions for Luna, the TravelHub travel assistant.
  - `channels/whatsapp.ts` — WhatsApp channel integration using `@chat-adapter/whatsapp`.
  - `tools/*.ts` — Six Eve tools wrapping the existing TravelHub data access logic.
  - `skills/*.md` — Three procedural guides for trip inquiry, escalation, and knowledge base usage.
  - `trusted-contact-context.ts` — WhatsApp phone verification for secure client identification.
- **`src/lib/supabase/server.ts`** gains `getSupabaseAdmin()` — a singleton service-role Supabase client for Eve tools (no cookie/auth context).
- **Dependencies added**: `eve`, `ai`, `@ai-sdk/openai-compatible`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory`.
- The existing WhatsApp webhook route (`src/app/api/whatsapp/webhook/route.ts`) and inbound service (`src/lib/whatsapp/inbound-service.ts`) remain unchanged for backward compatibility during the transition.

## 3. Scope

### IN scope (first release / MVP)

- **Eve agent structure**: Full `agent/` directory with agent config, instructions, channel, tools, and skills.
- **Six TravelHub tools**:
  - `lookup-client` — Identify client by WhatsApp phone (wraps `getClientByWhatsappPhone` logic).
  - `get-active-trips` — List active/recent trips for a client (wraps `getClientActiveTrips` logic).
  - `get-trip-summary` — Get trip overview (wraps `getTripSummary` logic).
  - `get-trip-itinerary` — Day-by-day itinerary (wraps `getTripItineraryStatus` logic).
  - `get-trip-documents` — Check document availability (wraps `getTripDocumentsStatus` logic).
  - `escalate-to-human` — Escalate conversation to human agent.
  - `search-knowledge` — Search approved knowledge base (updated for travel context).
- **Three skills**:
  - `trip-inquiry.md` — Step-by-step flow for trip queries.
  - `escalation.md` — When and how to escalate to human agent.
  - `knowledge-answers.md` — How to use the approved knowledge base.
- **WhatsApp channel**: Integration with `@chat-adapter/whatsapp` using `chatSdkChannel` bridge.
- **Trusted contact context**: WhatsApp phone verification for secure client identification (preserves existing security model).
- **Service-role Supabase access**: `getSupabaseAdmin()` for Eve tools to access data without browser session.

### OUT of scope (first release)

- **Replacing the existing webhook route**: The current `/api/whatsapp/webhook` route remains active; Eve channel runs in parallel for testing.
- **Session durability**: Eve Workflows integration for session persistence is deferred; in-memory state is used initially.
- **Subagents**: No specialist child agents in this migration.
- **Additional channels**: Web chat, SMS, or other channels are deferred.
- **Prompts/Resources**: Eve's prompt and resource system is not used in this migration.

### Deferred / later slices

- Eve Workflows integration for durable sessions.
- Subagent delegation for specialized tasks (e.g., payment handling, emergency response).
- Multi-channel support (web chat, SMS).
- Native Eve prompts and resources.

## 4. Impact

- **New directory**: `agent/` — Eve agent structure with tools, skills, channel, and config.
- **New file**: `src/lib/supabase/server.ts` — `getSupabaseAdmin()` function added.
- **New dependencies**: `eve`, `ai`, `@ai-sdk/openai-compatible`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory`.
- **No impact** to existing WhatsApp webhook route, inbound service, or data access layer.
- **No impact** to `/t/[slug]`, `/c/[slug]`, dashboard, Server Actions, or RLS policies.
- **No impact** to existing tests (280 tests continue to pass).

## 5. Risks

- **Dual agent coexistence**: Running both the old webhook-based agent and the new Eve agent in parallel requires careful routing to avoid duplicate responses. *Mitigation*: Eve channel is initially disabled in production; enabled only after validation.
- **Service-role key exposure**: `getSupabaseAdmin()` uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses RLS. *Mitigation*: Server-only import; never referenced in client bundles; Vercel env configured as "sensitive"; no logs of the key.
- **Session state loss**: In-memory state means session data is lost on restart. *Mitigation*: Acceptable for MVP; Eve Workflows integration planned for durability.
- **Eve framework maturity**: Eve is relatively new and APIs may evolve. *Mitigation*: Pin exact versions; isolate Eve-specific code in `agent/` directory.
- **Tool behavior parity**: Eve tools must behave identically to the existing `travelhub-client-tools.ts` functions. *Mitigation*: Tools wrap the same logic; existing tests validate behavior.

## 6. Open Questions

- Should the Eve agent eventually replace the webhook route entirely, or should both coexist for different use cases? (Recommend full replacement after validation; confirm in design.)
- Should Eve Workflows be integrated in this change or deferred to a follow-up? (Recommend deferred; in-memory state is sufficient for MVP.)
- Should the agent name "Luna" be configurable via environment variable, or is hardcoding acceptable for now? (Recommend hardcoding for MVP; make configurable later if needed.)
