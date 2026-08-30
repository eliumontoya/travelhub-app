# Design: WhatsApp Webhook Hardening

## Technical Approach

Harden only the App Router webhook boundary: `POST /api/whatsapp/webhook` will read the exact raw body with `request.text()`, verify Meta's `X-Hub-Signature-256` before JSON parsing, then delegate the parsed payload to existing `processWhatsAppWebhookPayload`. GET challenge verification and inbound/status normalization, persistence, orchestration, and outbound send layers remain unchanged.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Signature boundary | Enforce verification in `route.ts` before `JSON.parse` and before `processWhatsAppWebhookPayload`. | Verify inside inbound service; parse with `request.json()` first. | The route is the public trust boundary and Meta signs the exact raw body, so parsing first can change bytes and risks side effects before admission. |
| Helper placement | Add a server-only helper in `src/lib/whatsapp/signature.ts` using Node `crypto.createHmac` and `timingSafeEqual`. | Inline all crypto in route; add dependency. | Keeps route readable, enables focused unit tests, and avoids new dependencies. |
| Failure semantics | Return 503 for missing/blank `WHATSAPP_APP_SECRET`; return 401 for missing/malformed/mismatched signature; return 400 for validly signed invalid JSON. | Return 403 for all auth failures; accept unsigned requests in local dev. | 503 distinguishes operator misconfiguration, while fail-closed behavior preserves the production security contract. |
| Existing processing | Leave inbound/status processing contracts untouched. | Refactor normalization/orchestration. | Scope is admission hardening; existing idempotency and status-only behavior already live below the boundary. |

## Data Flow

```txt
Meta POST
  -> route reads rawBody via request.text()
  -> verify rawBody + X-Hub-Signature-256 + WHATSAPP_APP_SECRET
     -> reject before side effects on failure
  -> JSON.parse(rawBody)
  -> processWhatsAppWebhookPayload(payload)
     -> normalize inbound/status events
     -> persist/orchestrate/send only after verified admission
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/whatsapp/signature.ts` | Create | Parse `sha256=<hex>`, compute HMAC-SHA256 over raw body, compare with `timingSafeEqual`, and expose a small verification result. |
| `src/app/api/whatsapp/webhook/route.ts` | Modify | Replace `request.json()` with raw-body verification followed by `JSON.parse`; preserve existing processing error handling. |
| `src/app/api/whatsapp/webhook/__tests__/route.test.ts` | Modify | Sign test bodies and add rejection/misconfiguration/invalid JSON route tests. |
| `doc/whatsapp-real-test-setup.md` | Modify | List `WHATSAPP_APP_SECRET` as required server-side production configuration for POST deliveries. |
| `doc/whatsapp-simulated-inbound-tests.md` | Modify | Explain signed webhook requirement and local simulation implications. |

## Interfaces / Contracts

```ts
type WhatsAppSignatureVerificationResult =
  | { ok: true }
  | { ok: false; reason: "missing_secret" | "missing_signature" | "malformed_signature" | "invalid_signature" };

verifyWhatsAppWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  appSecret?: string;
}): WhatsAppSignatureVerificationResult;
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | HMAC helper accepts exact `sha256=<hex>` for raw body and rejects missing, malformed, altered-body, altered-signature, and length-mismatch inputs. | Focused Vitest tests or route-level helper coverage using deterministic secret/body fixtures. |
| Route | Valid signed inbound and status payloads delegate unchanged; missing secret returns 503; missing/malformed/mismatched signatures return 401; valid signature with invalid JSON returns 400. | Update existing `NextRequest` tests to sign the exact `JSON.stringify` string passed as body and assert `processWhatsAppWebhookPayload` is not called on failures. |
| Adversarial webhook | Replay/rate limiting remain out of scope; attacks covered are unsigned direct POSTs, body tampering after signing, wrong prefix, non-hex digest, and signature for semantically same but byte-different JSON. | RED tests must assert no persistence, decisioning, status update, or outbound send by verifying the processing mock is not invoked. |
| E2E | Not required for this boundary. | Existing unit route tests exercise the public API contract without external Meta/Supabase dependencies. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: webhook route does not classify or execute files. | No file execution boundary. | None. |
| Git repository selection | `git -C`, relative paths, absolute paths | N/A: no Git operations. | No repository/cwd authority change. | None. |
| Commit state | staged, `commit -a`, empty index | N/A: no commit automation. | No index/worktree semantics. | None. |
| Push state | tracking branch, first push, explicit refspec | N/A: no push automation. | No destination/ref resolution. | None. |
| PR commands | explicit `--head`, environment prefix, composed commands | N/A: no PR command composition. | No command execution. | None. |

## Migration / Rollout

No data migration required. Roll out by deploying code after configuring `WHATSAPP_APP_SECRET` in Vercel Production; without it, POST ingestion fails closed with 503.

## Open Questions

- [ ] Confirm the production Meta App Secret has been added to Vercel before deployment cutover.
