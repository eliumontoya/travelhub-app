# Design: WhatsApp Agent Migration to Vercel Eve

## Technical Approach

Migrate the WhatsApp inbound agent from Next.js API routes to the Vercel Eve agent framework by creating an `agent/` directory at the project root with Eve's filesystem-based agent structure. The agent uses `defineAgent` for config, `defineTool` for tools, `chatSdkChannel` for the WhatsApp channel, and markdown files for instructions and skills. Data access is provided via `getSupabaseAdmin()`, a singleton service-role Supabase client that bypasses RLS without a browser session.

## Architecture Overview

```text
WhatsApp Cloud API
   │  Webhook POST
   ▼
agent/channels/whatsapp.ts
   │ 1. createWhatsAppAdapter() with credentials from env
   │ 2. chatSdkChannel() bridge with in-memory state
   │ 3. bot.onNewMention() / bot.onSubscribedMessage() handlers
   ▼
Eve Agent Runtime
   │ 1. Load agent/instructions.md (system prompt)
   │ 2. Load agent/skills/*.md (procedural guides)
   │ 3. Register agent/tools/*.ts (defineTool)
   │ 4. Execute agent loop with tool calls
   ▼
agent/tools/*.ts
   │ each tool: validate Zod input → call getSupabaseAdmin() → query Supabase
   ▼
getSupabaseAdmin()  ◀── service-role client, bypasses RLS
   │
   ▼
Supabase (Postgres)
```

The Eve agent is **stateless per-request** at the tool level: each tool call creates a fresh Supabase client via `getSupabaseAdmin()` (singleton pattern). Session state is managed by Eve's in-memory state adapter; durability via Eve Workflows is deferred.

## Architecture Decisions

### Decision: Eve agent structure
**Choice**: Filesystem-based agent structure under `agent/` with subdirectories for tools, skills, channels, and config.
**Alternatives**: Programmatic agent definition (not supported by Eve); keeping agent logic in `src/lib/ai/`.
**Rationale**: Eve's filesystem convention is the idiomatic approach; it enables hot-reloading, clear separation of concerns, and native tool/skill discovery.

### Decision: Service-role Supabase client for Eve tools
**Choice**: Add `getSupabaseAdmin()` to `src/lib/supabase/server.ts` using `SUPABASE_SERVICE_ROLE_KEY` via the plain `createClient` from `@supabase/supabase-js` with `auth: { autoRefreshToken: false, persistSession: false }`. Eve tools call this function to get a singleton client.
**Alternatives**: Reusing the cookie-aware server client (not available in Eve context); creating a new client per tool call (inefficient).
**Rationale**: Eve tools run outside the Next.js request context (no cookies), so a service-role client is required. Singleton pattern avoids repeated client creation.

### Decision: WhatsApp channel adapter
**Choice**: Use `@chat-adapter/whatsapp` with `chatSdkChannel` bridge from `eve/channels/chat-sdk`. Credentials are read from environment variables with fallback to "unconfigured" placeholder for builds without credentials (e.g., Vercel preview).
**Alternatives**: Custom webhook handler (duplicates existing logic); using a different adapter library.
**Rationale**: `@chat-adapter/whatsapp` is the official Eve adapter for WhatsApp; it handles webhook verification, message parsing, and response sending. The placeholder pattern allows the channel to be registered even when credentials are missing (Eve requires at least one route).

### Decision: In-memory state for MVP
**Choice**: Use `createMemoryState()` from `@chat-adapter/state-memory` for the channel's subscription/lock bookkeeping. Session durability is owned by Eve Workflows, but that integration is deferred.
**Alternatives**: Redis-backed state (adds infrastructure); Eve Workflows integration in this change (increases scope).
**Rationale**: In-memory state is sufficient for MVP; the agent is single-instance on Vercel serverless. Durability can be added later without changing the agent logic.

### Decision: Tool implementation pattern
**Choice**: Each tool is a separate file under `agent/tools/` using `defineTool` from `eve/tools`. Tools validate input with Zod schemas, call `getSupabaseAdmin()`, and return structured results.
**Alternatives**: Reusing `src/lib/ai/tools/travelhub-client-tools.ts` directly (not compatible with Eve's tool interface); wrapping the existing functions (adds indirection).
**Rationale**: Eve's `defineTool` is the idiomatic approach; it provides automatic validation, tool discovery, and error handling. The tools implement the same logic as the existing functions but in Eve's format.

### Decision: Skills as markdown files
**Choice**: Three skills under `agent/skills/` as markdown files: `trip-inquiry.md`, `escalation.md`, `knowledge-answers.md`. Skills are loaded on-demand by the agent based on user intent.
**Alternatives**: Programmatic skills (not supported by Eve); embedding instructions in `instructions.md` (less modular).
**Rationale**: Markdown skills are Eve's convention; they are human-readable, version-controlled, and can be updated without code changes.

### Decision: Agent name "Luna"
**Choice**: The agent is named "Luna" in `instructions.md`, replacing the base agent's "Eva" (from the dental clinic template).
**Alternatives**: Making the name configurable via env var; using a different name.
**Rationale**: "Luna" is a warm, approachable name suitable for a travel assistant. Hardcoding is acceptable for MVP; configurability can be added later if needed.

## Data Flow (per WhatsApp message)

1. WhatsApp Cloud API sends a webhook POST to the Eve channel endpoint.
2. `agent/channels/whatsapp.ts` receives the webhook via `createWhatsAppAdapter()`.
3. The adapter normalizes the payload and invokes `bot.onNewMention()` or `bot.onSubscribedMessage()`.
4. The handler calls `buildTrustedContactSendPayload()` to attach the sender's WhatsApp phone as trusted context.
5. Eve's agent runtime loads `agent/instructions.md` (system prompt) and relevant skills.
6. The agent decides which tools to call based on the user's message and instructions.
7. Each tool call:
   - Validates input via Zod schema.
   - Calls `getSupabaseAdmin()` to get a service-role Supabase client.
   - Executes the query/mutation.
   - Returns a structured result.
8. The agent synthesizes a response from tool results and sends it back via the WhatsApp adapter.

## Tool Layer

Each tool is registered with `defineTool({ description, inputSchema, execute })`. Zod v4 schemas validate input. Tools return structured results with `success`, `status`, and data fields. Representative skeletons:

```ts
// lookup-client.ts
export default defineTool({
  description: "Identifica al cliente de TravelHub por su número de WhatsApp.",
  inputSchema: z.object({
    phone: z.string().min(5).max(32).describe("Número de WhatsApp del cliente"),
  }),
  async execute({ phone }) {
    const supabase = getSupabaseAdmin();
    // ... query logic ...
    return { success: true, found: true, clientId, displayName, matchConfidence: "exact" };
  },
});
```

```ts
// get-trip-summary.ts
export default defineTool({
  description: "Obtiene información general de un viaje específico.",
  inputSchema: z.object({
    clientId: z.string().min(1).max(100),
    tripId: z.string().min(1).max(100),
  }),
  async execute({ clientId, tripId }) {
    const supabase = getSupabaseAdmin();
    // ... ownership verification + query ...
    return { success: true, status: "success", tripId, title, startDate, endDate, ... };
  },
});
```

All six tools follow this pattern. The `escalate-to-human` tool is simpler: it returns a confirmation that the conversation has been escalated (actual escalation logic is handled by the existing webhook route).

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `agent/agent.ts` | Create | Agent config: OpenAI-compatible provider (DeepSeek V4 Flash), session timeout, context window. |
| `agent/instructions.md` | Create | System instructions for Luna, the TravelHub travel assistant. |
| `agent/channels/whatsapp.ts` | Create | WhatsApp channel: `createWhatsAppAdapter()`, `chatSdkChannel()`, trusted contact context. |
| `agent/tools/lookup-client.ts` | Create | Identify client by WhatsApp phone. |
| `agent/tools/get-active-trips.ts` | Create | List active/recent trips for a client. |
| `agent/tools/get-trip-summary.ts` | Create | Get trip overview (dates, status, travelers). |
| `agent/tools/get-trip-itinerary.ts` | Create | Day-by-day itinerary with activities. |
| `agent/tools/get-trip-documents.ts` | Create | Check document availability. |
| `agent/tools/escalate-to-human.ts` | Create | Escalate conversation to human agent. |
| `agent/tools/search-knowledge.ts` | Create | Search approved knowledge base (updated for travel context). |
| `agent/skills/trip-inquiry.md` | Create | Step-by-step flow for trip queries. |
| `agent/skills/escalation.md` | Create | When and how to escalate to human agent. |
| `agent/skills/knowledge-answers.md` | Create | How to use the approved knowledge base. |
| `agent/trusted-contact-context.ts` | Create | WhatsApp phone verification for secure client identification. |
| `agent/eve-shim.d.ts` | Create | Type shims for Eve modules (until Eve provides official types). |
| `src/lib/supabase/server.ts` | Modify | Add `getSupabaseAdmin()` function. |
| `package.json` | Modify | Add dependencies: `eve`, `ai`, `@ai-sdk/openai-compatible`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory`. |

No changes to `/t/[slug]`, `/c/[slug]`, dashboard, Server Actions, RLS, `/api/cron/*`, `/api/flight-status`, or the existing WhatsApp webhook route.

## Interfaces / Contracts

```ts
// src/lib/supabase/server.ts (added)
export function getSupabaseAdmin(): SupabaseClient;

// agent/tools/*.ts — each tool exports a default defineTool() result:
export default defineTool({
  description: string,
  inputSchema: z.ZodSchema,
  execute: (input: TInput) => Promise<TOutput>,
});

// agent/channels/whatsapp.ts — exports channel, bot, send:
export const { bot, channel, send } = chatSdkChannel({ ... });
export default channel;
```

## Testing & Verification Plan

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Type | `npx tsc --noEmit` clean | CI gate; catch Eve SDK type drift. |
| Unit | Existing 280 tests continue to pass | `npm run test`; no regressions. |
| Lint | `npm run lint` clean | ESLint; catch style issues. |
| Integration | Eve agent loads tools and skills | Manual test with `eve dev` (if available) or inspect compiled output. |
| E2E | WhatsApp message → Eve agent → tool call → response | Manual test with WhatsApp sandbox or preview deploy. |

Manual fallback: type-check + lint + existing tests suffice; full E2E requires a configured WhatsApp Business account and is run pre-merge.

## Threat Matrix

`N/A` — no routing/shell/subprocess/VCS/PR/executable-file/process-integration boundary is introduced. The only new HTTP surface is the Eve WhatsApp channel endpoint, which uses the same credentials and verification as the existing webhook route.

## Migration / Rollout

No data migration. Add `eve`, `ai`, `@ai-sdk/openai-compatible`, `@chat-adapter/whatsapp`, `@chat-adapter/state-memory` as dependencies. Deploy is the normal Vercel push-to-`main`; the Eve agent is additive and inert until the WhatsApp channel is enabled in production.

## Open Questions (resolved by this design)

- Dual agent coexistence → Eve channel runs in parallel; existing webhook route remains active. ✔
- Session durability → In-memory state for MVP; Eve Workflows integration deferred. ✔
- Agent name → "Luna" hardcoded in `instructions.md`; configurable later if needed. ✔

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Dual agent coexistence | Eve channel initially disabled in production; enabled only after validation. |
| Service-role key exposure | Server-only import; never returned in results/errors; Vercel "sensitive" flag; no key logging. |
| Session state loss | Acceptable for MVP; Eve Workflows integration planned for durability. |
| Eve framework maturity | Pin exact versions; isolate Eve-specific code in `agent/` directory. |
| Tool behavior parity | Tools implement the same logic as existing functions; existing tests validate behavior. |
