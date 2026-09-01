# Delta for WCC Command Center

## ADDED Requirements

### Requirement: WCC observability metrics
WCC MUST show read-only operational metrics from shared observability: webhooks, duplicates, AI decisions, tools, sends/statuses, escalations, and failures.

#### Scenario: Metrics render
- GIVEN sanitized observability events exist
- WHEN the agent opens `/dashboard/wcc`
- THEN WCC MUST show operational counts and failure summaries
- AND existing KPIs MUST remain.

#### Scenario: Observability unavailable
- GIVEN observability data is unavailable
- WHEN the agent opens WCC
- THEN WCC MUST render zero/unavailable states without crashing
- AND raw errors or secrets MUST NOT appear.

### Requirement: WCC privacy-safe diagnostics
WCC diagnostics MUST display only sanitized event fields and MUST NOT expose raw message bodies, full phones, private links, tokens, prompts/completions, raw tool payloads, SQL, or stack traces.

#### Scenario: Sensitive telemetry hidden
- GIVEN an event originated from sensitive webhook, AI, tool, send, or escalation data
- WHEN WCC renders diagnostics
- THEN only sanitized metadata and outcomes MUST be visible.

### Requirement: WCC operational scope boundary
WCC observability MUST remain internal read-only debugging. It MUST NOT add manual WhatsApp responses, customer analytics, retention/export controls, or mutations beyond existing knowledge management.

#### Scenario: Read-only diagnostics
- GIVEN the agent views WCC diagnostics
- WHEN they inspect metrics or failures
- THEN no manual send or telemetry-edit control MUST be available.
