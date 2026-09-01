# WhatsApp Inbound Automation Specification

**Baseline**: new-capability

## Purpose

Receive, understand, and operationalize inbound WhatsApp conversations for TravelHub while preserving private customer communication data.

## Requirements

### Requirement: WhatsApp contact records
The system MUST be able to store WhatsApp contact records by canonical phone number without requiring an existing TravelHub client.

#### Scenario: New sender has no linked client
- GIVEN a WhatsApp sender messages TravelHub for the first time
- WHEN the sender is persisted
- THEN a WhatsApp contact record MUST represent the phone identity
- AND the record MAY have no linked TravelHub client

### Requirement: Conversation lifecycle
The system MUST represent WhatsApp conversation state as open, awaiting agent attention, escalated, resolved, or archived.

#### Scenario: Conversation escalates
- GIVEN a conversation cannot be answered safely by automation
- WHEN it is handed off to the travel agent
- THEN the conversation MUST be representable as escalated

### Requirement: Idempotent message ledger
The system MUST store WhatsApp messages with a unique provider message id.

#### Scenario: Duplicate webhook delivery
- GIVEN the provider delivers the same message more than once
- WHEN the message is stored
- THEN only one row SHOULD exist for that provider message id

### Requirement: Intent staging
The system MUST store detected intents with confidence, extracted entities, summary, and review/sync status.

#### Scenario: Quote request detected
- GIVEN an inbound message asks for travel planning help
- WHEN intent extraction runs in a later phase
- THEN the intent MUST be representable with type, confidence, entities, and detected status

### Requirement: Escalation records
The system MUST store human escalations with reason, priority, status, and resolution metadata.

#### Scenario: Agent resolves escalation
- GIVEN an open escalation exists
- WHEN the agent resolves it in a later feature
- THEN the escalation MUST be able to record resolved status and resolved timestamp

### Requirement: Knowledge approval
The system MUST distinguish draft, approved, and archived knowledge entries for future agent answer sourcing.

#### Scenario: Approved answer source
- GIVEN a knowledge entry has approved status
- WHEN a future agent searches usable knowledge
- THEN the entry MAY be used as an answer source

### Requirement: Private WhatsApp data
The system MUST NOT expose WhatsApp contact, conversation, message, intent, escalation, or knowledge tables to anonymous users.

#### Scenario: Anonymous access denied
- GIVEN a request uses the anon database role
- WHEN it accesses WhatsApp inbound data tables
- THEN it MUST have no direct table privileges

### Requirement: Meta webhook verification
The system MUST expose `GET /api/whatsapp/webhook` so Meta can verify the webhook using the configured server-side verify token.

#### Scenario: Verification succeeds
- GIVEN `WHATSAPP_VERIFY_TOKEN` is configured
- AND Meta sends `hub.mode=subscribe`, the matching `hub.verify_token`, and a `hub.challenge`
- WHEN the webhook GET request is handled
- THEN the response MUST be HTTP 200
- AND the response body MUST equal the challenge value as plain text

#### Scenario: Verification fails
- GIVEN `WHATSAPP_VERIFY_TOKEN` is configured
- WHEN a webhook GET request omits the expected subscribe mode, challenge, or matching token
- THEN the response MUST be HTTP 403

### Requirement: Meta payload normalization
The system MUST normalize inbound WhatsApp webhook payloads into stable internal message events while preserving the raw provider payload needed for audit/debugging.

#### Scenario: Text payload normalized
- GIVEN a Meta WhatsApp webhook payload with an inbound text message
- WHEN the payload is normalized
- THEN the normalized event MUST include provider message id, sender phone, profile name, business phone number id, message type `text`, text body, occurred timestamp, raw message, and raw change value

#### Scenario: Unsupported payload normalized safely
- GIVEN a Meta WhatsApp webhook payload with an unsupported inbound message type
- WHEN the payload is normalized
- THEN the normalized event MUST include provider message id, sender phone, unsupported message type, raw message, and raw change value
- AND normalization MUST NOT throw solely because the type is unsupported

### Requirement: Inbound webhook persistence
The system MUST persist normalized inbound webhook messages into the private WhatsApp contact, conversation, and message tables created by issue #199.

#### Scenario: Text message persisted
- GIVEN Supabase service-role configuration is available
- AND Meta sends a valid inbound text webhook payload
- WHEN the webhook POST request is handled
- THEN a WhatsApp contact MUST be upserted for the sender
- AND an open WhatsApp conversation MUST exist for the contact
- AND a WhatsApp message row MUST be stored with raw payload and normalized text data
- AND the response MUST acknowledge the received message count

#### Scenario: Duplicate message delivery is idempotent
- GIVEN a WhatsApp message row already exists for a provider message id
- WHEN Meta retries the same inbound message payload
- THEN the webhook MUST return success
- AND no duplicate WhatsApp message row SHOULD be created for that provider message id

#### Scenario: Unsupported message type persisted safely
- GIVEN Meta sends an inbound message with an unsupported type
- WHEN the webhook POST request is handled
- THEN the message MUST be persisted with that message type and raw payload
- AND the webhook MUST NOT fail solely because the message type is unsupported

### Requirement: Webhook unavailable without server configuration
The webhook ingestion endpoint MUST fail safely without exposing secrets when required server-side Supabase configuration is missing.

#### Scenario: Supabase not configured for POST
- GIVEN Supabase URL or service-role key is missing
- WHEN the webhook POST request is handled
- THEN the response MUST be HTTP 503
- AND the response body MUST NOT include secret values

### Requirement: Approved knowledge retrieval for decisioning
The system MUST retrieve only active approved WhatsApp knowledge entries for inbound agent decisioning.

#### Scenario: Approved entries are loaded
- GIVEN Supabase configuration is available
- WHEN the decisioning module loads knowledge
- THEN only rows with `status = approved` MUST be requested
- AND the result MUST include ids, topics, questions, answers, tags, and sources needed for answer grounding

#### Scenario: Knowledge retrieval unavailable
- GIVEN Supabase configuration is missing or the read fails
- WHEN decisioning runs without explicitly supplied knowledge
- THEN the module MUST degrade to a safe empty knowledge set
- AND the final decision MUST NOT auto-answer solely from model imagination

### Requirement: Side-effect-free inbound agent decisioning
The system MUST classify inbound WhatsApp messages and return a validated structured decision without writing database rows or sending WhatsApp messages.

#### Scenario: Approved knowledge supports an answer
- GIVEN an inbound message and approved knowledge that directly answers it
- AND the model/provider returns valid structured output citing that knowledge
- WHEN the decisioning module evaluates the message
- THEN the result MUST include intent, summary, confidence, decision `auto_answer`, response text, and cited knowledge ids

#### Scenario: Knowledge is insufficient
- GIVEN an inbound message without sufficient approved knowledge
- WHEN the decisioning module evaluates the message
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason
- AND MUST NOT include auto-answer text

#### Scenario: Sensitive or commercial-specific request
- GIVEN an inbound message asks for pricing, booking, payment, cancellation, refund, emergency, medical, legal, or other commercial-specific action
- WHEN the decisioning module evaluates the message
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason

### Requirement: Validated conservative model output
The system MUST validate structured model/provider output before using it for inbound auto-answer decisions.

#### Scenario: Invalid structured output
- GIVEN the model/provider returns malformed JSON or values outside the allowed schema
- WHEN the decisioning module parses the output
- THEN the result MUST use decision `needs_human`
- AND include an escalation reason

#### Scenario: Low-confidence auto-answer
- GIVEN the model/provider returns `auto_answer` with confidence below the safe threshold
- WHEN the decisioning module validates the output
- THEN the result MUST be converted to `needs_human`
- AND include an escalation reason

### Requirement: Inbound orchestration side effects
The system MUST orchestrate each newly persisted inbound WhatsApp message through agent decisioning, durable intent persistence, either an automatic response or human escalation, and conversation/message status updates.

#### Scenario: Auto-answer is executed and recorded
- GIVEN a new text inbound WhatsApp message is persisted
- AND approved knowledge and the inbound agent decision support an automatic answer
- WHEN inbound orchestration processes the message
- THEN the system MUST persist the detected intent
- AND it MUST attempt to send the automatic answer through the WhatsApp transport
- AND it MUST persist an outbound WhatsApp message record with the send result
- AND it MUST mark the inbound message and conversation with the resulting response state

#### Scenario: Human escalation is executed and recorded
- GIVEN a new inbound WhatsApp message cannot be answered safely by automation
- WHEN inbound orchestration processes the message
- THEN the system MUST persist the detected intent
- AND it MUST create an open human escalation record
- AND it MUST attempt a customer follow-up WhatsApp message
- AND it MUST attempt a configured human WhatsApp alert when an alert phone is available
- AND it MUST mark the conversation as escalated

#### Scenario: Unsupported message escalates safely
- GIVEN a new inbound WhatsApp message has an unsupported non-text type
- WHEN inbound orchestration processes the message
- THEN the system MUST NOT crash solely because the message is unsupported
- AND it MUST create a human escalation path for the unsupported content

### Requirement: Orchestration idempotency
The system MUST NOT duplicate immediate outbound sends or orchestration side effects for a provider message id that was already persisted and processed.

#### Scenario: Duplicate delivery skips side effects
- GIVEN a WhatsApp provider message id already exists in the message ledger
- WHEN inbound orchestration receives the same inbound event again
- THEN it MUST acknowledge the duplicate
- AND it MUST NOT invoke the agent
- AND it MUST NOT send an outbound WhatsApp message

### Requirement: WhatsApp Cloud API transport
The system MUST centralize server-side WhatsApp Cloud API text sends in a transport wrapper that builds Meta API requests without deciding intent or persistence behavior.

#### Scenario: Text request is sent to Meta
- GIVEN server-side WhatsApp credentials are configured
- WHEN the transport sends a text message
- THEN it MUST POST to the configured Meta Graph phone-number messages endpoint
- AND it MUST include the bearer token, recipient, text body, and WhatsApp messaging product payload

#### Scenario: Missing credentials skip safely
- GIVEN server-side WhatsApp credentials are missing
- WHEN the transport is asked to send a text message
- THEN it MUST return a structured skipped/failed result
- AND it MUST NOT throw only because credentials are missing

### Requirement: Controlled TravelHub data tools
The system MUST expose server-side, allowlisted TravelHub data tools for WhatsApp agent use without giving the LLM Supabase credentials, raw SQL access, or direct table access.

#### Scenario: Allowed tool executes with typed input
- GIVEN the WhatsApp agent requests a supported TravelHub data tool with valid typed arguments
- WHEN the tool router executes the request server-side
- THEN it MUST execute only code-authored table-specific queries
- AND it MUST return a structured tool result with a status and safe data payload.

#### Scenario: Unsupported tool is rejected
- GIVEN the WhatsApp agent requests a tool name outside the allowlist
- WHEN the tool router validates the request
- THEN it MUST reject the request with a structured blocked result
- AND it MUST NOT query TravelHub domain tables for that request.

### Requirement: WhatsApp phone client resolution
The system MUST resolve dynamic TravelHub lookups from the inbound WhatsApp phone to a TravelHub client before returning client- or trip-specific data. It MUST compare the inbound phone using a digits-only normalized form compatible with webhook `event.fromPhone`. It MUST prefer an exact match on normalized `clients.whatsapp`, MAY use `whatsapp_contacts.linked_client_id` as a manual compatibility override when no CRM WhatsApp match exists, and SHOULD retain legacy `clients.phone` fallback during migration. If multiple clients match at the same lookup tier, the system MUST return an ambiguous result and MUST NOT expose trip-specific data.

#### Scenario: CRM WhatsApp resolves client
- GIVEN a client has `clients.whatsapp` matching the inbound phone after digits-only normalization
- WHEN client resolution runs
- THEN the result MUST identify that client with exact confidence
- AND it MUST NOT require a linked WhatsApp contact row.

#### Scenario: Manual link remains fallback
- GIVEN no client matches `clients.whatsapp`
- AND a WhatsApp contact row exists for the inbound phone with a linked TravelHub client
- WHEN client resolution runs
- THEN the result MUST identify the linked client with exact confidence.

#### Scenario: CRM duplicate is ambiguous
- GIVEN multiple clients match the inbound phone by normalized `clients.whatsapp`
- WHEN client resolution runs
- THEN the result MUST be ambiguous
- AND no trip-specific lookup MUST run from that result.

#### Scenario: No client match escalates safely
- GIVEN no linked WhatsApp contact, no exact CRM WhatsApp match, and no legacy client-phone match exists for the inbound phone
- WHEN client resolution runs
- THEN the result MUST indicate no match
- AND the caller MUST be able to escalate without exposing private TravelHub data.

### Requirement: Trip-scoped tool ownership guard
Every trip-scoped TravelHub data tool MUST verify that the requested trip belongs to the client resolved from the inbound WhatsApp phone before returning trip details. It MUST also verify that the trip is published before exposing trip summary, itinerary, document, or other trip detail data. When an owned trip is not published, the tool MUST return only a generic planning-safe message indicating that the trip is still being planned by an agent and that more information will be available once it is published.

#### Scenario: Owned published trip summary is returned
- GIVEN a resolved client asks about a published trip assigned to that client
- WHEN the trip summary tool runs
- THEN it MUST return only safe trip summary fields.

#### Scenario: Owned unpublished trip only returns planning message
- GIVEN a resolved client asks about a trip assigned to that client
- AND the trip status is not `published`
- WHEN any trip-scoped detail tool runs
- THEN it MUST return only a generic planning-safe message
- AND it MUST NOT return trip title, dates, itinerary items, confirmation codes, document counts, document links, storage paths, or private trip details.

#### Scenario: Non-owned trip is blocked
- GIVEN a resolved client attempts to query a trip id not assigned to that client
- WHEN any trip-scoped tool runs
- THEN the tool MUST return a blocked ownership result
- AND it MUST NOT return trip details.

### Requirement: Dynamic trip ambiguity handling
The system MUST detect when a client has zero, one, or multiple active/recent trips so the agent can answer, ask for clarification, or escalate safely. Active/recent trip choices MUST NOT expose details for trips whose status is not `published`; those choices MAY include only an internal trip id and a generic planning label needed for safe routing.

#### Scenario: Multiple active trips require clarification
- GIVEN a resolved client has multiple active or recent trips
- WHEN active trip lookup runs
- THEN the result MUST mark the lookup as ambiguous
- AND include only concise trip choices suitable for asking the customer to clarify.

#### Scenario: Unpublished active trip choice is minimized
- GIVEN a resolved client has an active or recent trip whose status is not `published`
- WHEN active trip lookup runs
- THEN the choice MUST NOT include trip title, slug, start date, or end date
- AND it MUST preserve enough internal identity for the server to route the next trip-scoped tool call.

### Requirement: Sensitive dynamic data minimization
Dynamic tools MUST minimize sensitive data returned to the agent, and payment status MUST not be auto-answerable until TravelHub has an explicit payment data model and policy.

#### Scenario: Payment status requires human policy
- GIVEN a resolved client asks about payments
- WHEN the payment status tool runs before a payment system-of-record exists
- THEN it MUST return a needs-human result
- AND it MUST NOT invent balances, amounts, or payment promises.

#### Scenario: Document status summarizes without links
- GIVEN a resolved client asks whether documents are available or missing
- WHEN document status lookup runs for an owned trip
- THEN it MUST return counts and general availability state
- AND it MUST NOT return signed URLs, storage paths, or private client document contents.

### Requirement: Dynamic tool audit trail
The system SHOULD record sanitized evidence of TravelHub data tool calls for debugging and downstream CRM processing without making audit availability a prerequisite for customer-safe responses.

#### Scenario: Tool call audit succeeds
- GIVEN `crm_sync_events` is available
- WHEN a controlled data tool completes
- THEN a pending audit event SHOULD be staged with tool name, result status, and non-secret identifiers.

#### Scenario: Tool call audit fails non-fatally
- GIVEN the tool data lookup succeeds but audit insertion fails
- WHEN the tool returns its result
- THEN the result SHOULD remain available
- AND include audit failure diagnostics that do not expose secrets.

### Requirement: Meta status callback normalization
The system MUST normalize WhatsApp Cloud API `statuses` webhook payloads separately from inbound message payloads while preserving the raw provider status data.

#### Scenario: Delivered status callback normalized
- GIVEN a Meta WhatsApp webhook payload containing `value.statuses` with status `delivered`
- WHEN the payload is normalized
- THEN the normalized status event MUST include provider message id, status, recipient phone, business phone number id, occurred timestamp, raw status, and raw change value
- AND no inbound message event MUST be emitted solely from that status callback

### Requirement: Outbound delivery status persistence
The system MUST persist WhatsApp outbound delivery status callbacks idempotently and update the associated outbound message when the provider message id is known.

#### Scenario: Delivered status updates outbound message
- GIVEN an outbound WhatsApp message row exists with the Meta provider message id
- WHEN a `delivered` status callback is processed
- THEN a status callback audit row MUST be persisted
- AND the outbound message status MUST become `delivered`
- AND the original outbound send payload MUST remain preserved with delivery status details added

#### Scenario: Duplicate status callback is idempotent
- GIVEN a status callback audit row already exists for the same provider message id, status, and provider timestamp
- WHEN Meta retries the same callback payload
- THEN the webhook MUST return success
- AND no duplicate callback audit row SHOULD be created
- AND no inbound message SHOULD be created

#### Scenario: Failed status stores delivery errors
- GIVEN Meta sends a `failed` status callback with provider errors
- WHEN the callback is processed
- THEN the audit row payload MUST include those errors
- AND the associated outbound message MUST be marked `failed` when found

### Requirement: Status-only webhook acknowledgement
The webhook MUST acknowledge valid status-only WhatsApp webhook payloads without invoking inbound agent decisioning.

#### Scenario: Status-only payload returns success
- GIVEN Meta sends a webhook payload with `statuses` and no `messages`
- WHEN `POST /api/whatsapp/webhook` handles it
- THEN the response MUST be HTTP 200
- AND the response body MUST report processed status callbacks
- AND no contact, conversation, inbound message, intent, or escalation MUST be created solely from that callback


### Requirement: Dynamic TravelHub tools in inbound agent
The system MUST integrate controlled TravelHub data tool results into WhatsApp inbound agent decisioning without exposing Supabase credentials, raw SQL, or unrestricted table access to the LLM.

#### Scenario: Single active trip can be answered from dynamic tools
- GIVEN an inbound WhatsApp text asks about the customer's trip status
- AND the sender resolves to exactly one TravelHub client
- AND the client has exactly one active or recent trip
- AND the trip summary tool returns success
- WHEN inbound decisioning runs
- THEN the provider MUST receive only safe structured tool results
- AND the final decision MAY auto-answer when it cites the successful dynamic tool call.

#### Scenario: Multiple trips require clarification
- GIVEN an inbound WhatsApp text asks about the customer's trip status
- AND the sender resolves to a client with multiple active or recent trips
- WHEN dynamic tools run
- THEN the active trips result MUST be passed as ambiguous choices
- AND the final customer response MUST ask for clarification or escalate
- AND it MUST NOT invent which trip the customer meant.

#### Scenario: Unknown sender escalates without private data
- GIVEN an inbound WhatsApp text asks about a TravelHub trip
- AND the sender phone cannot be resolved to a TravelHub client
- WHEN dynamic tools run
- THEN the client lookup result MUST be not_found
- AND no trip-specific tool MUST run
- AND the final response MUST avoid private trip details.

#### Scenario: Tool failure escalates without technical leakage
- GIVEN a dynamic TravelHub tool returns error
- WHEN inbound decisioning runs
- THEN the final decision MUST use a safe human path
- AND the customer response MUST NOT expose SQL, Supabase, stack traces, or secrets.

#### Scenario: Payment status remains human-handled
- GIVEN an inbound WhatsApp text asks about payment status
- WHEN the payment dynamic tool runs
- THEN it MUST return needs_human under current policy
- AND the final response MUST NOT invent balances, amounts, deadlines, or payment promises.

### Requirement: Client WhatsApp CRM storage
The system MUST store an optional WhatsApp phone field on `clients`, backfill it from existing `phone` values when blank, default it from `phone` on future insert/update when blank, and provide an index suitable for normalized WhatsApp lookup.

#### Scenario: Blank WhatsApp is copied from phone
- GIVEN a client row is inserted or updated with `phone` present and `whatsapp` null or blank
- WHEN the database write executes
- THEN `clients.whatsapp` MUST store the phone value.

#### Scenario: Explicit WhatsApp is preserved
- GIVEN a client row has an explicit non-blank `whatsapp`
- WHEN `phone` changes
- THEN the database MUST NOT overwrite the explicit WhatsApp value.

### Requirement: Deterministic WhatsApp contact client linking
The system MUST maintain `whatsapp_contacts.linked_client_id` automatically when a contact phone has exactly one normalized match in `clients.whatsapp_normalized`. The system MUST NOT auto-link when no client matches or when multiple clients match. Existing manual links MUST NOT be overwritten by automatic matching.

#### Scenario: Unique client match links contact
- GIVEN one TravelHub client has `clients.whatsapp_normalized` matching a WhatsApp contact phone after digits-only normalization
- WHEN the contact is inserted, updated, or backfilled
- THEN `whatsapp_contacts.linked_client_id` MUST equal that client id.

#### Scenario: No client match remains unlinked
- GIVEN no TravelHub client matches a WhatsApp contact phone
- WHEN automatic linking runs
- THEN the contact MUST remain without a linked client.

#### Scenario: Ambiguous client match remains unlinked
- GIVEN multiple TravelHub clients match the same normalized WhatsApp phone
- WHEN automatic linking runs
- THEN the contact MUST remain without an automatic linked client.

#### Scenario: Manual link is preserved
- GIVEN a WhatsApp contact has a manual linked client
- WHEN automatic linking runs for its phone
- THEN the manual `linked_client_id` MUST remain unchanged.

#### Scenario: Client WhatsApp change recalculates links
- GIVEN a TravelHub client's WhatsApp normalized value changes
- WHEN matching WhatsApp contacts exist
- THEN eligible unlinked or auto-linked contacts MUST be recalculated using the same unique-match rules.

### Requirement: Signed Meta webhook POST admission

The system MUST require every `POST /api/whatsapp/webhook` payload to pass Meta request signature verification before any webhook message or status callback is processed. Verification MUST use the `X-Hub-Signature-256` header in `sha256=<hex>` form, the configured server-side Meta App Secret, and the exact raw JSON request body. Requests that are missing, malformed, or fail signature validation MUST be rejected without persistence, agent decisioning, orchestration, status updates, or outbound WhatsApp sends.

#### Scenario: Valid signed inbound message continues normally

- GIVEN `WHATSAPP_APP_SECRET` is configured
- AND Meta sends an inbound message POST with a valid `X-Hub-Signature-256` for the raw body
- WHEN the webhook POST request is handled
- THEN the request MUST be eligible for existing inbound message normalization, persistence, and orchestration

#### Scenario: Valid signed status callback continues normally

- GIVEN `WHATSAPP_APP_SECRET` is configured
- AND Meta sends a status-only POST with a valid `X-Hub-Signature-256` for the raw body
- WHEN the webhook POST request is handled
- THEN the request MUST be eligible for existing status callback normalization and acknowledgement
- AND no inbound message processing MUST occur solely from that status callback

#### Scenario: Missing signature is rejected before side effects

- GIVEN `WHATSAPP_APP_SECRET` is configured
- AND a webhook POST omits `X-Hub-Signature-256`
- WHEN the webhook POST request is handled
- THEN the response MUST be HTTP 401 or HTTP 403
- AND no persistence, decisioning, status update, or outbound send MUST occur

#### Scenario: Malformed or mismatched signature is rejected before side effects

- GIVEN `WHATSAPP_APP_SECRET` is configured
- AND a webhook POST includes a malformed signature or one that does not match the raw body
- WHEN the webhook POST request is handled
- THEN the response MUST be HTTP 401 or HTTP 403
- AND no persistence, decisioning, status update, or outbound send MUST occur

#### Scenario: Valid signature with invalid JSON fails safely

- GIVEN `WHATSAPP_APP_SECRET` is configured
- AND a webhook POST has a valid signature for its raw body but the body is not valid JSON
- WHEN the webhook POST request is handled
- THEN the response MUST be HTTP 400
- AND no persistence, decisioning, status update, or outbound send MUST occur

### Requirement: WhatsApp App Secret production configuration

The system MUST treat the Meta App Secret as required server-side configuration for webhook POST traffic and MUST fail closed when it is unavailable. Operator-facing production setup documentation MUST identify `WHATSAPP_APP_SECRET` as required for accepting Meta webhook POST deliveries.

#### Scenario: App secret missing blocks POST ingestion

- GIVEN `WHATSAPP_APP_SECRET` is missing or blank
- WHEN any webhook POST request is handled
- THEN the response MUST indicate webhook ingestion is unavailable
- AND no payload processing or side effect MUST occur
- AND the response body MUST NOT expose secret values

#### Scenario: Production documentation names required secret

- GIVEN an operator follows TravelHub WhatsApp production setup documentation
- WHEN they review required environment variables for webhook POST traffic
- THEN `WHATSAPP_APP_SECRET` MUST be listed as required server-side configuration

### Requirement: Shared observability emission
Webhook admission, idempotency, persistence, agent decisioning, tool execution, transport, status-callback, and escalation flows MUST emit shared observability events. Emission failures SHOULD NOT block safe customer processing.

#### Scenario: Inbound lifecycle emitted
- GIVEN a new signed inbound text is accepted
- WHEN automation persists and orchestrates it
- THEN webhook, persistence, decisioning, and outcome events MUST share one correlation id.

#### Scenario: Duplicate observable
- GIVEN a provider message id was already processed
- WHEN the duplicate webhook is acknowledged
- THEN a duplicate outcome MUST be recorded
- AND skipped side effects MUST NOT emit agent/tool/send events.

### Requirement: AI and tool diagnostics privacy
AI and TravelHub tool diagnostics MUST include only status, allowlisted tool name, safe non-secret identifiers, latency/error category when available, and correlation metadata. They MUST NOT expose prompts, completions, raw tool payloads, private trip details, credentials, SQL, or stack traces.

#### Scenario: Provider or tool error sanitized
- GIVEN an AI or tool failure includes sensitive text
- WHEN observability records it
- THEN only a safe error category MUST be retained
- AND secrets, prompts, payloads, and traces MUST be absent.
