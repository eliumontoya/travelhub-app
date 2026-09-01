# Proposal: WCC WhatsApp and AI Observability

## Intent

Make WhatsApp and AI operations debuggable through reusable, privacy-safe telemetry rather than one-off logs. Operators should correlate a webhook through persistence, decisioning, tool calls, outbound send/status callbacks, and WCC indicators without exposing sensitive data.

## Proposal question round

Assumptions for product review: WCC v1 prioritizes operator debugging; retention/export policy is deferred; sanitized previews are allowed only when tests prove redaction.
## Scope

### In Scope
- Shared observability contract for correlation IDs, metrics, and sanitized diagnostics.
- Instrument WhatsApp webhook, idempotency, orchestration, LLM, tool, transport, and status-callback paths.
- WCC metrics/health surfaces derived from the shared contract.
- Tests proving telemetry excludes secrets, raw PII, message bodies, private links, and unsafe LLM/tool payloads.

### Out of Scope
- Monitoring vendor integration, paging/alerting, or retention policy.
- Manual WhatsApp responses or WCC mutations beyond existing knowledge management.
- Marketing, attribution, or customer behavior analytics.

## Capabilities

### New Capabilities
- `whatsapp-ai-observability`: reusable privacy-safe observability contract for WhatsApp and AI-agent event IDs, metrics, logs, diagnostics, and sanitization.

### Modified Capabilities
- `whatsapp-inbound-automation`: webhook, orchestration, LLM, transport, status-callback, and tool flows emit shared observability events without sensitive data.
- `wcc-command-center`: WCC shows operational metrics/health from shared observability with safe empty/unavailable states.

## Approach

Add a small server-side observability module with typed events, correlation context, metric names, and mandatory sanitizer. Hide persistence/console details behind adapters so future WhatsApp-agent features reuse the API by default.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/whatsapp/*` | Modified | Webhook, status, idempotency, transport, orchestration events. |
| `src/lib/ai/*`, `src/lib/ai/tools/*` | Modified | Sanitized LLM/provider/tool diagnostics. |
| `src/lib/wcc-*`, `src/app/dashboard/wcc/**` | Modified | Observability-backed WCC metrics/health. |
| `src/lib/**/__tests__`, `src/lib/whatsapp/__tests__` | Modified/New | Privacy and metrics contract tests. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| PII/secrets leak | High | Mandatory sanitizer, denylist tests, no raw bodies/tokens/phones. |
| Future bypass | Med | Shared typed API required by success criteria. |
| Metrics become analytics | Med | Keep v1 operational and internal. |

## Rollback Plan

Revert observability adapters and WCC metric additions while preserving existing webhook persistence, agent decisions, and read-only WCC pages.

## Dependencies

- Existing WhatsApp webhook, AI/tool flows, and WCC pages.
- Later product decisions on retention, alerting, and WCC event visibility.

## Success Criteria

- [ ] All WhatsApp/AI paths share typed observability with stable correlation IDs.
- [ ] WCC exposes operational metrics without crashing on missing data.
- [ ] Tests prove telemetry contains no secrets, raw PII, raw message bodies, or private links.
