# Tasks: Small UX Fixes Micro-spec Registration

This change is registration-only. Do not implement code from this task list until a separate implementation request exists.

## Registration Tasks

- [x] Read `project.md` and `architecture.md` for TravelHub context.
- [x] Review existing OpenSpec style and related baseline specs.
- [x] Create proposal for `microspec-small-ux-fixes-2026-09-20`.
- [x] Create delta spec for `client-document-upload`.
- [x] Create delta spec for `client-auth`.
- [x] Create delta spec for `public-trip-sharing`.
- [x] Create delta spec for `dashboard-workspace`.

## Future Implementation Tasks

- [ ] Add a trip navigation link on `/client/trips/{id}/documents`.
- [ ] Update `/t/{slug}` lock icon routing to send authenticated clients to `/client`.
- [ ] Replace always-visible per-day add-activity forms with collapsed `+ Add activity to this day` controls and a single expanded inline form.
- [ ] Limit `/dashboard` status history preview to the latest three entries.
- [ ] Add focused tests or component assertions for each behavior where existing test infrastructure supports it.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated implementation changed lines | ~80-180 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Decision needed before apply | No |

## Verification for This Registration

- [x] Confirmed no application source files were intentionally changed.
- [x] Confirmed this change remains active under `openspec/changes/` and is not archived or merged into baseline specs.
