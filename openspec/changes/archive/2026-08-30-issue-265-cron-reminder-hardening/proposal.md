# Proposal: Cron Reminder Hardening

## Intent

Close the production security gap where `/api/cron/trip-reminders` can execute without authorization when `CRON_SECRET` is absent. Success means production fails safely before email/data side effects, while local/dev/test remains easy to run.

## Scope

### In Scope
- Fail closed in production when `CRON_SECRET` is absent or blank with a safe `503` configuration error.
- Require `Authorization: Bearer <CRON_SECRET>` whenever a non-blank secret exists.
- Preserve open execution without `CRON_SECRET` only outside production.
- Add tests covering production, dev/test, valid token, invalid token, blank secret, and no-side-effect paths.
- Update docs so `CRON_SECRET` is required in production and recommended for deployed/shared environments.

### Out of Scope
- Changing reminder timing, email template, Resend behavior, or trip selection rules.
- Adding admin UI, alerting, audit logs, or new cron providers.
- Changing Vercel cron schedule.

## Capabilities

### New Capabilities
- `cron-trip-reminders`: Authorization, safe configuration handling, and side-effect boundaries for scheduled trip reminder execution.

### Modified Capabilities
- None.

## Approach

Centralize cron authorization/config evaluation near `src/app/api/cron/trip-reminders/route.ts`. Treat blank secrets as missing. In production, validate secret configuration before checking email setup or loading trips. Return generic `401` for missing/invalid bearer when a secret exists; return safe diagnostic `503` only for missing production secret.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/api/cron/trip-reminders/route.ts` | Modified | Fail-closed auth/config behavior. |
| `src/app/api/cron/trip-reminders/**/__tests__` or existing test area | New/Modified | Route behavior coverage. |
| `architecture.md`, `doc/features/automations.md`, `doc/features/integrations.md` | Modified | Production `CRON_SECRET` guidance. |
| `openspec/changes/issue-265-cron-reminder-hardening/specs/cron-trip-reminders/spec.md` | New | Delta spec for cron reminder security behavior. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Production reminders stop until `CRON_SECRET` is configured | Med | Document required env var and safe `503` reason. |
| Tests accidentally send email or mutate data | Low | Mock email/data dependencies and assert no side effects. |

## Rollback Plan

Revert the route/test/doc changes. If production reminders must be restored urgently, configure `CRON_SECRET` and Vercel Authorization first rather than reopening the endpoint.

## Dependencies

- Production deployment must set a non-blank `CRON_SECRET` and cron caller must send the matching bearer token.

## Success Criteria

- [ ] Production missing/blank `CRON_SECRET` returns `503` before email/data side effects.
- [ ] Valid bearer succeeds when configured; invalid/missing bearer returns generic `401`.
- [ ] Local/dev/test without `CRON_SECRET` can still run safely.
- [ ] Docs clearly state production/shared-environment secret guidance.
