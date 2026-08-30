# Delta for whatsapp-inbound-automation

## ADDED Requirements

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
