# Spec Delta — WhatsApp outbound status callbacks

## MODIFIED Capability: whatsapp-inbound-automation

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
