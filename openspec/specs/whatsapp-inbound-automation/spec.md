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
