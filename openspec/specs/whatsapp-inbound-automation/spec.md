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
