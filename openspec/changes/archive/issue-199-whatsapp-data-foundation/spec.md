# Spec delta: WhatsApp inbound data foundation (issue #199)

## ADDED capability: `whatsapp-inbound-automation`

### Requirement: WhatsApp contact records
The system MUST be able to store WhatsApp contact records by canonical phone number without requiring an existing TravelHub client.

#### Scenario: New sender has no linked client
- GIVEN a WhatsApp sender messages TravelHub for the first time
- WHEN the sender is persisted
- THEN a `whatsapp_contacts` record MUST represent the phone identity
- AND the record MAY have no `linked_client_id`

### Requirement: Conversation state
The system MUST be able to represent a WhatsApp conversation with an explicit lifecycle status and timestamps for inbound/outbound activity.

#### Scenario: Conversation awaits human handling
- GIVEN an inbound message cannot be answered automatically
- WHEN the conversation is staged for agent attention
- THEN the conversation status MUST be representable as `awaiting_agent` or `escalated`

### Requirement: Idempotent message ledger
The system MUST be able to store WhatsApp messages with a unique WhatsApp provider message id.

#### Scenario: Duplicate webhook delivery
- GIVEN Meta delivers the same WhatsApp message more than once
- WHEN the message is stored by WhatsApp message id
- THEN the data model MUST prevent duplicate message rows for that provider id

### Requirement: Intent staging
The system MUST be able to store detected intents linked to a contact, conversation, and source message with confidence, extracted entities, and review/sync status.

#### Scenario: Quote request detected
- GIVEN an inbound message asks for a trip quote
- WHEN the future decisioning service extracts the intent
- THEN the data model MUST represent the intent type, confidence, entities, summary, and detected status

### Requirement: Escalation queue
The system MUST be able to store human escalations linked to WhatsApp context with reason, priority, status, and resolution timestamp.

#### Scenario: Escalation resolved
- GIVEN a conversation was escalated to the agent
- WHEN the agent resolves the escalation in a later feature
- THEN the data model MUST represent `resolved` status and a `resolved_at` timestamp

### Requirement: Approved knowledge entries
The system MUST be able to store knowledge entries whose approval status determines whether future automation may use them.

#### Scenario: Draft knowledge is not approved
- GIVEN a knowledge entry is still a draft
- WHEN the future LLM agent selects answer sources
- THEN the data model MUST distinguish it from `approved` entries

### Requirement: Private-by-default WhatsApp data
WhatsApp inbound automation tables MUST NOT expose rows to the `anon` role and MUST require authenticated admin or service-role access.

#### Scenario: Anonymous visitor has no table grant
- GIVEN an unauthenticated request uses the anon database role
- WHEN it attempts to access WhatsApp inbound tables
- THEN the role MUST have no direct table privileges

## ADDED capability: `crm-sync-staging`

### Requirement: CRM sync event lifecycle
The system MUST be able to stage CRM sync events as `pending`, `processing`, `processed`, or `failed` with retry metadata.

#### Scenario: Failed CRM sync can be retried
- GIVEN a CRM sync event failed
- WHEN it is persisted for later processing
- THEN the data model MUST represent failure status, attempt count, last error, and next availability timestamp

### Requirement: CRM event idempotency
The system SHOULD support an optional event key so producers can avoid staging duplicate external CRM events.

#### Scenario: Producer replays the same event
- GIVEN a producer emits the same logical CRM event twice with the same event key
- WHEN the event is inserted
- THEN the data model SHOULD enforce uniqueness for that event key

### Requirement: CRM staging private access
CRM staging events MUST NOT be exposed to `anon` and MUST be readable/writable only by authenticated admin access or server-side service-role processes.

#### Scenario: External processor uses server credentials
- GIVEN a server-side CRM processor polls pending events
- WHEN it reads the queue
- THEN it MUST use a privileged server-side credential rather than anon access
