# Design: WCC WhatsApp and AI Observability

## Technical Approach

Add a reusable server-only observability module for WhatsApp/AI flows, then thread its correlation context through the existing webhook route, inbound service, AI decisioning, dynamic TravelHub tools, sends, status callbacks, and WCC dashboard reads. The module owns event typing, sanitization, console logging, and a bounded in-memory snapshot; no database persistence is added for #274 because retention/export policy is explicitly deferred and current needs are tests plus operator diagnostics.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Observability boundary | Create `src/lib/observability/whatsapp-ai.ts` with typed `createCorrelationContext`, `recordWhatsAppAiEvent`, sanitizer, counters, and `getWhatsAppAiObservabilitySnapshot`. | Ad-hoc logs in each flow; storing telemetry in existing `crm_sync_events`. | One API makes future WhatsApp-agent features reuse the same contract and avoids mixing telemetry retention with CRM sync semantics. |
| Sink model | Default sink writes sanitized structured console events and updates bounded process memory; tests may inject/reset sink. | Supabase table migration; external vendor. | Meets WCC/debug/test needs now, degrades safely without Supabase, and avoids premature retention/schema decisions. |
| Privacy model | Sanitizer allowlists event fields and redacts recursive diagnostics before logging/snapshotting. | Callers pre-sanitize manually; logging raw errors then filtering in UI. | Central enforcement prevents future bypass and supports denylist tests for tokens, bodies, phones, links, SQL, traces, prompts, completions, and tool payloads. |
| Correlation | Inbound correlation derives from accepted provider message id; status callbacks use outbound provider id; route-level failures get generated request correlation. | Random id for every event; DB ids only after persistence. | Stable provider ids exist before persistence and preserve lifecycle linkage; event ids remain unique via `crypto.randomUUID()`. |

## Data Flow

```
POST /api/whatsapp/webhook
  ├─ verify/parse → record webhook admission/rejection
  └─ process payload(context)
       ├─ normalize → persist inbound/status → duplicate outcome
       ├─ dynamic tools → AI decision/provider diagnostics
       ├─ send/customer+human alert → status callbacks
       └─ escalation/CRM sync outcomes
             ↓
   sanitized console event + in-memory metrics snapshot
             ↓
   getWccDashboardSummary() → /dashboard/wcc read-only cards/diagnostics
```

Observability failures are caught and never block webhook acknowledgement, persistence, LLM/tool decisions, sends, or WCC rendering.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/lib/observability/whatsapp-ai.ts` | Create | Typed event contract, correlation helpers, sanitizer, safe logger, bounded metrics/diagnostic snapshot, test reset/injection helpers. |
| `src/app/api/whatsapp/webhook/route.ts` | Modify | Create route correlation and record signed admission, parse, success, and safe failure outcomes without raw body. |
| `src/lib/whatsapp/inbound-service.ts` | Modify | Pass context through inbound/status processing and emit persistence, duplicate, decision, tool, send, escalation, and summary events. |
| `src/lib/whatsapp/client.ts` | Modify | Return/emit sanitized send outcome metadata only: status, skipped, provider id, safe error category. |
| `src/lib/ai/whatsapp-inbound-agent.ts` | Modify | Emit preflight/provider/schema decision outcomes; remove raw output previews from observability events. |
| `src/lib/ai/whatsapp-llm-provider.ts` | Modify | Categorize provider latency/status/timeout without exposing prompts, completions, keys, or response bodies. |
| `src/lib/ai/tools/travelhub-client-tools.ts` | Modify | Emit allowlisted tool name/status/latency/safe ids; keep raw tool data out of telemetry. |
| `src/lib/wcc-dashboard.ts`, `src/app/dashboard/wcc/page.tsx` | Modify | Add read-only observability metrics/recent failures with zero/unavailable fallback. |
| `src/**/__tests__/*observability*.test.ts` | Create/Modify | Contract, integration, WCC fallback, and privacy-denylist coverage. |

## Interfaces / Contracts

```ts
type WhatsAppAiEventType = "webhook" | "persistence" | "duplicate" | "ai_decision" | "tool" | "send" | "status_callback" | "escalation";
type WhatsAppAiEvent = { eventId: string; correlationId: string; type: WhatsAppAiEventType; outcome: "success" | "failure" | "skipped"; occurredAt: string; identifiers?: SafeIds; diagnostics?: SafeDiagnostics };
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Sanitizer and metrics contract | Feed unsafe nested payloads; assert redaction and bounded snapshots. |
| Integration | Webhook lifecycle, duplicates, AI/tool/send/status emissions | Existing Vitest mocks plus injected/reset observability sink. |
| UI | WCC observability cards | Extend WCC dashboard tests for populated and unavailable snapshot states. |
| E2E | Not required for #274 | Existing WCC route coverage remains sufficient unless UI behavior changes materially. |

## Threat Matrix

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No executable-file classification. |
| Git repository selection | N/A | No VCS automation. |
| Commit state | N/A | No VCS automation. |
| Push state | N/A | No VCS automation. |
| PR commands | N/A | No PR automation. |

## Migration / Rollout

No migration required. Roll out by importing the module and instrumenting call sites; rollback is a code revert that leaves existing WhatsApp persistence, WCC pages, and customer processing unchanged.

## Open Questions

- [ ] Future retention/export/vendor destination remains deferred; current design intentionally keeps only bounded process-local diagnostics.
