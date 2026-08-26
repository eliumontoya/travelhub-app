# Proposal: issue-185-delete-clients

## Intent

Add the ability to delete a client from the authenticated clients console (`/dashboard/clients`) only after an explicit confirmation step.

## What Changes

- Add `deleteClient(id)` to `src/lib/data.ts`:
  - Mock mode: remove the client from `mockClients`, remove related `mockClientTags` and `mockTripClients`, and clear `trip.clientId` mirrors that point at the deleted client.
  - Supabase mode: delete from `clients`; existing FKs handle related rows and preserve trips via `ON DELETE SET NULL` for `trips.client_id`.
- Add `deleteClientAction(clientId, formData)` to `src/app/dashboard/clients/actions.ts`:
  - Re-read the client server-side.
  - Require a `confirmationName` field matching the current client name exactly after trimming.
  - Call `deleteClient`, then revalidate `/dashboard/clients`, `/dashboard`, and the deleted client's detail path.
- Refactor `ClientsExplorer` card markup so each row includes:
  - A normal detail link.
  - A delete control that asks the agent to type the client name before submitting.
- Add focused tests for mock-mode deletion and relation cleanup.
- Archive the new observable behavior into `openspec/specs/client-crm/spec.md` after verification.

## What Stays The Same

- No schema migration: existing FK behavior already defines how related records behave.
- No public client profile behavior changes, except that deleting a client naturally removes that public profile.
- CSV export, loaded-page filtering, pagination, tags display, and client detail edit workflows stay unchanged.
- Trips are not deleted by client deletion.

## Scope Boundaries

In scope:

- Delete from the clients index/console.
- Prior confirmation before deletion.
- Dual-mode Supabase/mock data behavior.
- Focused automated tests for the data-layer safety behavior.

Out of scope:

- Bulk deletion.
- Undo/restore.
- Storage object garbage collection for client documents.
- New role/permission model beyond the existing authenticated dashboard boundary and RLS.

## Rollback Plan

This is a code-only change. To roll back, revert the touched files and remove the archived spec requirement. No migration or persisted-state repair is required.
