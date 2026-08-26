# Proposal: Delete trips from the dashboard

## Summary

Add permanent trip deletion from the dashboard trip editor with exact-title confirmation and safe redirect to `/dashboard`.

## Scope

- Data-layer `deleteTrip(id)` in mock and Supabase modes.
- Server Action that validates trip existence and title confirmation.
- Trip editor danger-zone confirmation UI.
- Focused mock-mode cascade test.
- Update and archive the trip itinerary spec.

## Non-goals

Bulk delete, soft-delete/restore, public traveler controls, or schema changes.

## Rollback plan

Remove the UI, Server Action, `deleteTrip`, test, and spec amendment. No database rollback is required.
