# Proposal: WhatsApp Webhook Hardening

## Intent

Close the production security gap where `POST /api/whatsapp/webhook` accepts unsigned inbound WhatsApp payloads. Success means only Meta-signed payloads are processed, invalid input fails safely, and operators know the required production secret.

## Scope

### In Scope
- Validate Meta `X-Hub-Signature-256` over the raw POST body with server-side `WHATSAPP_APP_SECRET`.
- Reject missing, malformed, or mismatched signatures before persistence, decisioning, or outbound sends.
- Preserve existing GET challenge verification and valid POST ingestion/status callback behavior.
- Add proportional route/helper tests and production variable documentation.

### Out of Scope
- Changing WhatsApp message normalization, orchestration, or data models.
- Rotating Meta credentials or provisioning Vercel/Meta configuration.
- Adding replay protection, IP allowlisting, rate limiting, or observability dashboards.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `whatsapp-inbound-automation`: Add signed POST verification requirements for the existing Meta webhook.

## Approach

Use issue #261, the 2026-08-29 audit, issue #200 deferral, and official Meta guidance as assumptions. Add a server-only verifier that reads the raw body once, computes HMAC-SHA256 with `WHATSAPP_APP_SECRET`, compares using timing-safe equality, then parses JSON only after verification succeeds. Missing app secret fails closed for POST.

## Proposal question round

Non-interactive assumptions: invalid signatures return 401/403 without details; unsigned POSTs are never accepted in production; tests may inject the secret; replay/rate-limit controls are deferred.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/whatsapp/webhook/route.ts` | Modified | Verify signature before JSON parsing/delegation. |
| `src/lib/whatsapp/*` | Modified/New | Add reusable signature verification helper if useful. |
| `src/app/api/whatsapp/webhook/__tests__/route.test.ts` | Modified | Cover valid, missing, malformed, invalid, bad JSON paths. |
| `doc/whatsapp-real-test-setup.md` / env docs | Modified | Document `WHATSAPP_APP_SECRET` as required for POST. |
| `openspec/specs/whatsapp-inbound-automation/spec.md` | Modified via delta | Add behavioral contract for signed POST ingestion. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Raw body consumed before JSON parsing | Med | Use `request.text()` then `JSON.parse`. |
| False rejection from encoding/signature format mismatch | Med | Test exact `sha256=<hex>` format and malformed variants. |
| Secret missing after deploy blocks webhook traffic | Med | Document variable and return safe configuration error. |

## Rollback Plan

Revert verifier, route changes, tests, docs, and spec delta. Restore prior POST JSON parsing/delegation; no database migration rollback is needed.

## Dependencies

- Meta App Secret configured as `WHATSAPP_APP_SECRET` in production.

## Success Criteria

- [ ] Valid Meta-signed POSTs continue to process normally.
- [ ] Missing/invalid signatures do not call webhook processing.
- [ ] Invalid JSON with valid signature still returns safe 400.
- [ ] Tests and docs cover required production configuration.
