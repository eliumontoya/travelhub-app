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
The system MUST resolve dynamic TravelHub lookups from the inbound WhatsApp phone to a TravelHub client before returning client- or trip-specific data.

#### Scenario: Linked WhatsApp contact resolves client
- GIVEN a WhatsApp contact row exists for the inbound phone and has a linked TravelHub client
- WHEN client resolution runs
- THEN the result MUST identify the client with exact confidence.

#### Scenario: No client match escalates safely
- GIVEN no linked WhatsApp contact or exact client-phone match exists for the inbound phone
- WHEN client resolution runs
- THEN the result MUST indicate no match
- AND the caller MUST be able to escalate without exposing private TravelHub data.

### Requirement: Trip-scoped tool ownership guard
Every trip-scoped TravelHub data tool MUST verify that the requested trip belongs to the client resolved from the inbound WhatsApp phone before returning trip details.

#### Scenario: Owned trip summary is returned
- GIVEN a resolved client asks about a trip assigned to that client
- WHEN the trip summary tool runs
- THEN it MUST return only safe trip summary fields.

#### Scenario: Non-owned trip is blocked
- GIVEN a resolved client attempts to query a trip id not assigned to that client
- WHEN any trip-scoped tool runs
- THEN the tool MUST return a blocked ownership result
- AND it MUST NOT return trip details.

### Requirement: Dynamic trip ambiguity handling
The system MUST detect when a client has zero, one, or multiple active/recent trips so the agent can answer, ask for clarification, or escalate safely.

#### Scenario: Multiple active trips require clarification
- GIVEN a resolved client has multiple active or recent trips
- WHEN active trip lookup runs
- THEN the result MUST mark the lookup as ambiguous
- AND include only concise trip choices suitable for asking the customer to clarify.

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
