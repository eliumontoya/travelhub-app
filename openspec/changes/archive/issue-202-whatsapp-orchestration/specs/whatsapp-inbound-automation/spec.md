## ADDED Requirements

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
