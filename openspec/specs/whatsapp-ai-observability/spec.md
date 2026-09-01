# WhatsApp AI Observability Specification

**Baseline**: new-capability

## Purpose
Reusable privacy-safe operational telemetry for WhatsApp and AI-agent flows.

## Requirements

### Requirement: Correlation identity
Every observed WhatsApp/AI operation MUST carry a stable correlation id and unique event id. Child events SHALL keep the correlation id across webhook, persistence, decisioning, tool, send, status, and escalation steps.

#### Scenario: Correlated lifecycle
- GIVEN a signed inbound webhook is accepted
- WHEN lifecycle events are emitted
- THEN every event MUST share one correlation id
- AND each event MUST have a unique event id.

### Requirement: Sanitized structured events
Events MUST include type, outcome, timestamp, correlation id, event id, safe identifiers, and sanitized diagnostics. Events MUST NOT contain secrets, raw message bodies, full phones, private links, tokens, SQL, stack traces, or raw LLM/tool payloads.

#### Scenario: Unsafe payload redacted
- GIVEN source data contains sensitive values
- WHEN an event is recorded
- THEN sensitive values MUST be absent or redacted
- AND safe debugging status MUST remain.

### Requirement: Operational metrics
The contract MUST define internal metrics for webhook volume, duplicates, AI decisions, tool outcomes, sends, callbacks, escalations, and recent failures. Metrics MUST NOT become marketing or customer analytics.

#### Scenario: Metrics derive safely
- GIVEN sanitized events exist
- WHEN metrics are requested
- THEN counts and failure summaries MUST be available without raw payloads.
