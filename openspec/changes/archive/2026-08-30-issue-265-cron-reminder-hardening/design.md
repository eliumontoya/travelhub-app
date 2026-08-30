# Design: Cron Reminder Hardening

## Technical Approach

Harden the existing Next.js App Router `GET /api/cron/trip-reminders` boundary in-place. Add a small route-local authorization/config guard that runs before `isEmailConfigured()`, `getTripsPendingReminder()`, `sendTripReminder()`, or `markTripReminderSent()`. `CRON_SECRET?.trim()` is the effective secret: blank equals missing. Production with no effective secret fails closed; any environment with an effective secret requires an exact `Authorization: Bearer <secret>` header; non-production without a secret keeps today’s open fallback.

## Architecture Decisions

| Decision | Choice | Alternatives considered | Rationale |
|---|---|---|---|
| Guard placement | Evaluate cron access at the top of `GET` in `src/app/api/cron/trip-reminders/route.ts`. | Middleware or shared auth module. | Single route is affected; top-of-handler keeps side-effect ordering obvious and matches current local route pattern. |
| Secret normalization | Use trimmed `CRON_SECRET`; whitespace-only is missing. | Treat any env string as configured. | Prevents accidental production bypass from blank env vars while preserving explicit non-blank secrets. |
| Failure shape | Production missing/blank secret returns safe `503`; configured but missing/malformed/wrong bearer returns generic `401` JSON. | Always `401`, or detailed token errors. | Separates operator misconfiguration from caller auth failure without leaking secret details. |
| Non-production fallback | Only dev/test/local may run open when no effective secret exists. | Require secret everywhere. | Preserves project convention that optional integrations degrade gracefully locally. |
| Testing seam | Test the route handler directly with `NextRequest`, Vitest env stubs, and mocked `@/lib/email`/`@/lib/data`. | E2E cron tests. | Unit-level route tests can prove no side effects by asserting mocks are untouched. |

## Data Flow

```
GET /api/cron/trip-reminders
  -> evaluateCronAccess(request, NODE_ENV, CRON_SECRET)
     -> denied: return 503/401, stop
     -> allowed: existing email config check
       -> existing pending trip lookup
       -> send reminder
       -> mark sent only when sent
```

Denied and misconfigured paths terminate before email checks, trip queries, email sends, or reminder mutations.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/api/cron/trip-reminders/route.ts` | Modify | Replace open-on-missing-secret auth helper with fail-closed production guard and generic auth denial. |
| `src/app/api/cron/trip-reminders/__tests__/route.test.ts` | Create | Route-handler RED tests for env/auth matrix and no-side-effect guarantees. |
| `architecture.md` | Modify | Mark `CRON_SECRET` required in production, recommended in shared deployments. |
| `doc/features/automations.md` | Modify | Update reminder requirements/operator setup. |
| `doc/features/integrations.md` | Modify | Document Resend reminder auth requirement. |

## Interfaces / Contracts

Effective route contract:

- `NODE_ENV=production` and missing/blank `CRON_SECRET` -> `503` JSON, no side effects.
- Non-blank `CRON_SECRET` in any environment -> require exact `Authorization: Bearer <CRON_SECRET>`.
- Missing, malformed, or wrong bearer when configured -> `401` JSON `{ "error": "Unauthorized" }`, no side effects.
- Non-production missing/blank `CRON_SECRET` -> proceed to existing email/reminder behavior.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit | Production missing and blank secret deny before all side effects. | RED tests with `vi.stubEnv`, direct `GET(NextRequest)`, mocked email/data functions. |
| Unit | Configured secret accepts exact bearer and rejects missing/malformed/wrong bearer generically. | Assert status/body and that rejected requests never touch mocks. |
| Unit | Dev/test missing or blank secret preserves open fallback. | Assert request reaches existing `isEmailConfigured()`/data flow with mocks. |
| Docs | Required production guidance appears. | Review changed docs; no runtime test needed. |

## Threat Matrix

| Boundary | Minimum adversarial cases | Applicability | Design response | Planned RED tests |
|---|---|---|---|---|
| Next Route Handler auth/config | Missing/blank prod secret; missing/malformed/wrong bearer; valid bearer; dev/test no secret | Applicable | Safe behavior: deny before side effects for prod misconfig or invalid caller. Failure behavior: `503` for prod misconfig, generic `401` for auth failure. | One test per listed case; rejected cases assert no email/data calls. |
| Documentation-like paths | `requirements.txt`, `CMakeLists.txt`, executable Markdown/MDX, `README.sh` | N/A: no executable-file classification. | No execution boundary. | None. |
| Git repository selection | `git -C`, relative paths, absolute paths | N/A: no Git automation. | No repository selector. | None. |
| Commit state | staged, `commit -a`, empty index | N/A: no commit automation. | No index/worktree semantics. | None. |
| Push state | tracking branch, first push, explicit refspec | N/A: no push automation. | No destination/ref resolution. | None. |
| PR commands | explicit `--head`, environment prefix, composed commands | N/A: no PR automation. | No command composition. | None. |

## Migration / Rollout

No migration required. Production operators must configure a non-blank `CRON_SECRET` and ensure the cron caller sends the matching bearer before deploy, otherwise reminders intentionally stop with `503`.

## Open Questions

None.
