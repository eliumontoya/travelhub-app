## ADDED Requirements

### Requirement: WhatsApp orchestration CRM events
The system MUST stage CRM sync events for WhatsApp auto-answers and escalations so an external process can synchronize conversation outcomes without coupling webhook processing to the CRM.

#### Scenario: Auto-answer stages CRM event
- GIVEN inbound orchestration auto-answers a WhatsApp message
- WHEN the outbound answer is recorded
- THEN a pending CRM sync event MUST be created for the auto-answer outcome
- AND the event SHOULD include an idempotency key derived from the inbound message id

#### Scenario: Escalation stages CRM event
- GIVEN inbound orchestration creates a human escalation
- WHEN the escalation is recorded
- THEN a pending CRM sync event MUST be created for the escalation outcome
- AND the event SHOULD include an idempotency key derived from the inbound message id
