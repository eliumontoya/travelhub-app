# Delta for WhatsApp Inbound Automation

## ADDED Requirements

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
