# Spec Delta: WhatsApp webhook ingestion (issue #200)

## Capability: whatsapp-inbound-automation

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
