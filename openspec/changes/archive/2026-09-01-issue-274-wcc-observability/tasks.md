# Tasks: WCC WhatsApp and AI Observability

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 450-750 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR; cohesive cross-cutting observability contract |
| Delivery strategy | exception-ok: user requested full epic through archive + PR in one run |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Medium

## 1. Observability Contract

- [x] 1.1 Add a server-safe WhatsApp/AI observability module with typed correlation context, event recording, sanitizer, bounded metrics, and test reset helpers.
- [x] 1.2 Add unit tests proving event IDs/correlation IDs, metrics, recent failures, and redaction of secrets/PII/raw payloads.

## 2. WhatsApp Webhook and Inbound Flow

- [x] 2.1 Instrument webhook signature, JSON parse, processing success/failure, and persistence config outcomes without raw body logging.
- [x] 2.2 Propagate correlation context through inbound/status processing.
- [x] 2.3 Emit duplicate, persistence, AI decision, tool, send, status callback, and escalation events.
- [x] 2.4 Add/extend tests for correlated lifecycle, duplicate behavior, send failures, and safe error sanitization.

## 3. AI and Tool Diagnostics

- [x] 3.1 Record provider decision lifecycle and provider parse/failure categories without prompts, completions, or raw output.
- [x] 3.2 Record TravelHub tool outcomes with allowlisted names/status/latency only.

## 4. WCC Surface and Documentation

- [x] 4.1 Expose read-only observability metrics/recent failures in WCC dashboard summary with unavailable/zero fallback.
- [x] 4.2 Render concise WCC observability cards/diagnostics.
- [x] 4.3 Update architecture documentation with the reusable observability requirement for future WhatsApp-agent features.

## 5. Verification and Archive

- [x] 5.1 Run focused observability tests.
- [x] 5.2 Run full unit tests, typecheck, lint, and build.
- [x] 5.3 Archive OpenSpec change and sync source specs.
