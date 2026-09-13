# Delta for Eve WhatsApp Agent

## ADDED Requirements

### Requirement: Eve agent structure

The system SHALL provide an Eve agent under the `agent/` directory at the project root. The agent SHALL include `agent.ts` (runtime config), `instructions.md` (system prompt), `channels/whatsapp.ts` (WhatsApp channel integration), `tools/*.ts` (six TravelHub tools), `skills/*.md` (three procedural guides), and `trusted-contact-context.ts` (WhatsApp phone verification). The agent SHALL be named "Luna" in the system prompt and SHALL operate as a travel assistant for TravelHub.

#### Scenario: Agent directory structure is valid

- GIVEN the `agent/` directory exists
- WHEN Eve's build process walks the filesystem
- THEN it discovers `agent.ts`, `instructions.md`, `channels/whatsapp.ts`, six tools, three skills, and `trusted-contact-context.ts`

#### Scenario: Agent name is Luna

- GIVEN the agent loads `instructions.md`
- WHEN the system prompt is rendered
- THEN it identifies the agent as "Luna, la asistente virtual de TravelHub"

### Requirement: Eve agent config

The agent SHALL use `defineAgent` from `eve` to configure the runtime. The config SHALL specify an OpenAI-compatible provider (DeepSeek V4 Flash via AI Gateway) using environment variables `WHATSAPP_AGENT_LLM_API_KEY`, `WHATSAPP_AGENT_LLM_BASE_URL`, and `WHATSAPP_AGENT_LLM_MODEL`. The config SHALL set a session timeout of 30 minutes and a context window of 64,000 tokens.

#### Scenario: Agent config loads successfully

- GIVEN the environment variables are configured
- WHEN the agent initializes
- THEN it creates an OpenAI-compatible provider with the specified model and context window

#### Scenario: Agent config degrades gracefully without credentials

- GIVEN the environment variables are missing
- WHEN the agent initializes
- THEN it uses empty strings for API key and base URL (Eve handles the error at runtime)

### Requirement: WhatsApp channel integration

The agent SHALL expose a WhatsApp channel at `agent/channels/whatsapp.ts` using `createWhatsAppAdapter` from `@chat-adapter/whatsapp` and `chatSdkChannel` from `eve/channels/chat-sdk`. The channel SHALL read credentials from environment variables (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`) with fallback to "unconfigured" placeholder for builds without credentials. The channel SHALL use in-memory state from `@chat-adapter/state-memory` and SHALL disable streaming (WhatsApp delivers single messages).

#### Scenario: WhatsApp channel registers successfully

- GIVEN the WhatsApp credentials are configured
- WHEN Eve's build process discovers channels
- THEN it registers the WhatsApp channel with the adapter and state

#### Scenario: WhatsApp channel degrades gracefully without credentials

- GIVEN the WhatsApp credentials are missing
- WHEN Eve's build process discovers channels
- THEN it registers the channel with placeholder credentials (route is registered but runtime calls fail gracefully)

### Requirement: Trusted contact context

The agent SHALL attach the sender's WhatsApp phone as trusted context in every message using `buildTrustedContactSendPayload` from `agent/trusted-contact-context.ts`. The trusted context SHALL include the sender's phone number in E.164 format and SHALL be used by tools to identify the client. The agent SHALL NOT allow the client to override the trusted phone number via chat.

#### Scenario: Trusted context is attached to new messages

- GIVEN a new WhatsApp message arrives
- WHEN the channel handler processes it
- THEN it calls `buildTrustedContactSendPayload` to attach the sender's phone as trusted context

#### Scenario: Trusted context is attached to subscribed messages

- GIVEN a WhatsApp message arrives in an existing thread
- WHEN the channel handler processes it
- THEN it calls `buildTrustedContactSendPayload` to attach the sender's phone as trusted context

### Requirement: lookup-client tool

The agent SHALL provide a `lookup-client` tool that identifies a TravelHub client by WhatsApp phone number. The tool SHALL accept a `phone` parameter (string, 5-32 characters), normalize it to digits-only, and query `clients.whatsapp_normalized`, `whatsapp_contacts.linked_client_id`, and `clients.phone` (fallback). The tool SHALL return `found: true` with `clientId` and `displayName` if exactly one client matches, `found: false` with `matchConfidence: "possible"` if multiple clients match, or `found: false` with `matchConfidence: "none"` if no client matches.

#### Scenario: Single client match returns exact confidence

- GIVEN one client has `clients.whatsapp_normalized` matching the phone
- WHEN the tool executes
- THEN it returns `{ success: true, found: true, clientId, displayName, matchConfidence: "exact" }`

#### Scenario: Multiple client matches return possible confidence

- GIVEN multiple clients match the phone
- WHEN the tool executes
- THEN it returns `{ success: true, found: false, matchConfidence: "possible", reason: "Multiple TravelHub clients match this WhatsApp phone." }`

#### Scenario: No client match returns none confidence

- GIVEN no client matches the phone
- WHEN the tool executes
- THEN it returns `{ success: true, found: false, matchConfidence: "none", reason: "No TravelHub client is linked to this WhatsApp phone." }`

### Requirement: get-active-trips tool

The agent SHALL provide a `get-active-trips` tool that lists active or recent trips for a client. The tool SHALL accept a `clientId` parameter, query `trip_clients` and `trips` tables, and return up to 5 trips ordered by `created_at` descending. The tool SHALL return `status: "success"` with one trip, `status: "ambiguous"` with multiple trips, or `status: "not_found"` with no trips. Unpublished trips SHALL be labeled "Viaje en planeación" with null dates.

#### Scenario: Single active trip returns success

- GIVEN a client has exactly one active trip
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", trips: [{ tripId, title, slug, startDate, endDate, status }] }`

#### Scenario: Multiple active trips return ambiguous

- GIVEN a client has multiple active trips
- WHEN the tool executes
- THEN it returns `{ success: true, status: "ambiguous", trips: [...], reason: "Multiple active or recent trips require clarification." }`

#### Scenario: No active trips return not_found

- GIVEN a client has no active trips
- WHEN the tool executes
- THEN it returns `{ success: true, status: "not_found", trips: [], reason: "No active or recent trips were found for this client." }`

### Requirement: get-trip-summary tool

The agent SHALL provide a `get-trip-summary` tool that retrieves general information about a specific trip. The tool SHALL accept `clientId` and `tripId` parameters, verify trip ownership via `trip_clients` or `trips.client_id`, and return trip metadata (title, slug, dates, status, traveler count, currency). The tool SHALL return `status: "blocked"` if the trip does not belong to the client, `status: "not_found"` if the trip does not exist, or `status: "success"` with trip data. Unpublished trips SHALL return a generic planning-safe message.

#### Scenario: Owned published trip returns success

- GIVEN a client owns a published trip
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", tripId, title, slug, startDate, endDate, tripStatus: "published", ... }`

#### Scenario: Owned unpublished trip returns planning message

- GIVEN a client owns an unpublished trip
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", title: "Viaje en planeación", tripStatus: "draft", reason: "Trip is not published yet." }`

#### Scenario: Non-owned trip returns blocked

- GIVEN a client attempts to query a trip not assigned to them
- WHEN the tool executes
- THEN it returns `{ success: false, status: "blocked", reason: "Requested trip does not belong to the resolved WhatsApp client." }`

### Requirement: get-trip-itinerary tool

The agent SHALL provide a `get-trip-itinerary` tool that retrieves the day-by-day itinerary for a trip. The tool SHALL accept `clientId` and `tripId` parameters, verify trip ownership, and return day counts, item counts by type, and the first 5 upcoming items with title, type, date, start time, location, and confirmation availability. The tool SHALL return `status: "blocked"` if the trip does not belong to the client, `status: "not_found"` if the trip does not exist, or `status: "success"` with itinerary data. Unpublished trips SHALL return empty itinerary.

#### Scenario: Owned published trip returns itinerary

- GIVEN a client owns a published trip with days and items
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", dayCount, itemCounts, nextItems: [{ title, type, date, startTime, location, confirmationAvailable }] }`

#### Scenario: Owned unpublished trip returns empty itinerary

- GIVEN a client owns an unpublished trip
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", dayCount: 0, itemCounts: {}, nextItems: [], reason: "Trip is not published yet." }`

### Requirement: get-trip-documents tool

The agent SHALL provide a `get-trip-documents` tool that checks if a trip has documents available. The tool SHALL accept `clientId` and `tripId` parameters, verify trip ownership, and return counts of trip-level and item-level documents. The tool SHALL return `status: "blocked"` if the trip does not belong to the client, `status: "not_found"` if the trip does not exist, or `status: "success"` with document counts. The tool SHALL NOT return signed URLs, storage paths, or private document contents.

#### Scenario: Owned trip with documents returns counts

- GIVEN a client owns a trip with documents
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", tripDocumentCount, itemDocumentCount, hasDocuments: true, linksIncluded: false }`

#### Scenario: Owned trip without documents returns zero counts

- GIVEN a client owns a trip without documents
- WHEN the tool executes
- THEN it returns `{ success: true, status: "success", tripDocumentCount: 0, itemDocumentCount: 0, hasDocuments: false }`

### Requirement: escalate-to-human tool

The agent SHALL provide an `escalate-to-human` tool that escalates a conversation to a human agent. The tool SHALL accept `reason` (string, 1-500 characters) and `priority` (enum: low, normal, high, urgent, default: normal) parameters. The tool SHALL return `{ success: true, escalated: true, reason, priority, message: "La conversación ha sido escalada a un asesor de TravelHub." }`.

#### Scenario: Escalation succeeds

- GIVEN the agent calls the tool with a reason and priority
- WHEN the tool executes
- THEN it returns `{ success: true, escalated: true, reason, priority, message }`

### Requirement: search-knowledge tool

The agent SHALL provide a `search-knowledge` tool that searches the approved knowledge base. The tool SHALL accept a `query` parameter (string, min 1 character), normalize the query to lowercase without accents, score knowledge entries by topic, tags, question, and answer relevance, and return up to 3 matches. The tool SHALL return `found: true` with entries if matches are found, or `found: false` with a message if no matches are found.

#### Scenario: Knowledge matches are returned

- GIVEN the knowledge base contains entries matching the query
- WHEN the tool executes
- THEN it returns `{ success: true, found: true, entries: [{ topic, question, answer }] }`

#### Scenario: No knowledge matches return not found

- GIVEN the knowledge base contains no entries matching the query
- WHEN the tool executes
- THEN it returns `{ success: true, found: false, entries: [], message: "No encontré información aprobada relacionada. Si es necesario, escala a humano." }`

### Requirement: Skills system

The agent SHALL provide three skills under `agent/skills/`: `trip-inquiry.md` (step-by-step flow for trip queries), `escalation.md` (when and how to escalate to human agent), and `knowledge-answers.md` (how to use the approved knowledge base). Skills SHALL be loaded on-demand by the agent based on user intent. Skills SHALL reference tools by name and provide procedural guidance.

#### Scenario: Trip inquiry skill is loaded

- GIVEN the user asks about their trip
- WHEN the agent decides which skill to load
- THEN it loads `trip-inquiry.md` and follows the step-by-step flow

#### Scenario: Escalation skill is loaded

- GIVEN the user requests a quote, payment, or cancellation
- WHEN the agent decides which skill to load
- THEN it loads `escalation.md` and follows the escalation procedure

#### Scenario: Knowledge answers skill is loaded

- GIVEN the user asks a general question about TravelHub
- WHEN the agent decides which skill to load
- THEN it loads `knowledge-answers.md` and uses `search-knowledge` to find answers

### Requirement: Service-role Supabase access

The system SHALL provide `getSupabaseAdmin()` in `src/lib/supabase/server.ts` that returns a singleton service-role Supabase client. The function SHALL use `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` environment variables. The function SHALL throw an error if the environment variables are missing. The function SHALL use `auth: { persistSession: false, autoRefreshToken: false }` to disable session management.

#### Scenario: Service-role client is created successfully

- GIVEN the environment variables are configured
- WHEN `getSupabaseAdmin()` is called
- THEN it returns a Supabase client with service-role privileges

#### Scenario: Service-role client is a singleton

- GIVEN `getSupabaseAdmin()` has been called once
- WHEN it is called again
- THEN it returns the same client instance

#### Scenario: Service-role client fails without credentials

- GIVEN the environment variables are missing
- WHEN `getSupabaseAdmin()` is called
- THEN it throws an error: "Supabase admin client is not configured"

### Requirement: No impact on existing routes and RLS

The Eve agent SHALL be additive only. It SHALL NOT modify `/t/[slug]`, `/c/[slug]`, the dashboard UI, existing Server Actions, RLS policies, or the existing `/api/cron/*`, `/api/flight-status`, and `/api/whatsapp/webhook` routes. Public read isolation (published trips only) and existing auth boundaries MUST remain intact.

#### Scenario: Existing API routes are unaffected

- GIVEN the Eve agent is deployed
- WHEN a request hits `/api/flight-status` or `/api/cron/trip-reminders`
- THEN those routes behave exactly as before the change

#### Scenario: Public traveler view is unaffected

- GIVEN a published trip exists
- WHEN a visitor opens `/t/[slug]`
- THEN only published data is shown and no Eve-only field leaks

### Requirement: Existing tests continue to pass

The Eve agent SHALL NOT break any existing tests. All 280 tests in the test suite SHALL continue to pass after the migration. The agent SHALL NOT introduce new test failures.

#### Scenario: All tests pass

- GIVEN the Eve agent is deployed
- WHEN `npm run test` is executed
- THEN all 280 tests pass with no failures
