# Exploration: issue-185-delete-clients

## Current State

TravelHub has a dedicated authenticated clients index at `/dashboard/clients` implemented as a Server Component page (`src/app/dashboard/clients/page.tsx`) plus the interactive loaded-page filter/export leaf `ClientsExplorer` (`src/app/dashboard/clients/ClientsExplorer.tsx`). Each client row is currently a full-card link to `/dashboard/clients/[id]`; there is no delete affordance on the index.

Client mutations follow the project convention: route-local Server Actions in `src/app/dashboard/clients/actions.ts` call `src/lib/data.ts`, then revalidate affected dashboard paths. The data layer is dual-mode: Supabase when configured and mutable arrays in `src/lib/mock-data.ts` otherwise.

The Supabase schema already defines deletion behavior:

- `trip_clients.client_id references clients(id) on delete cascade` removes client-trip assignment rows.
- `client_tags.client_id references clients(id) on delete cascade` removes client tag assignments.
- `client_documents.client_id references clients(id) on delete cascade` removes client document rows.
- `trips.client_id references clients(id) on delete set null` after the many-to-many migration, so deleting one client does not delete trips.

The mock data layer has corresponding arrays for `mockClients`, `mockTripClients`, and `mockClientTags`, but no `deleteClient` function yet.

## Requested Change

Issue #185: From the clients console, allow the agent to delete clients after prior confirmation.

## Affected Areas

- `src/lib/data.ts` — add a dual-mode `deleteClient(id)` mutation.
- `src/app/dashboard/clients/actions.ts` — add a Server Action that re-reads the client, validates confirmation, deletes, and revalidates.
- `src/app/dashboard/clients/ClientsExplorer.tsx` — change each card from a full-card link into a card with a detail link plus a destructive delete form/button.
- New small client leaf for the confirmation prompt, if needed.
- `src/lib/__tests__/data.test.ts` — cover mock-mode deletion and relationship cleanup.
- `openspec/specs/client-crm/spec.md` — archive the new client deletion requirement after verification.

## Relevant Next.js Docs Read

- `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`
- `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/09-revalidating.md`
- `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`

Important findings: Server Actions are direct POST entry points, so the delete action must validate confirmation server-side and cannot rely only on browser UI. `revalidatePath` is the appropriate refresh primitive for the clients list after the mutation.

## Approach

Use a hard delete of the `clients` row, matching the existing schema's explicit FK semantics. That removes client relationship rows while preserving trips. Protect against accidental deletion with two layers:

1. Client-side `window.prompt` that asks the agent to type the exact client name before form submission.
2. Server-side confirmation validation by re-reading the client and requiring the submitted confirmation to equal the current client name.

## Risks

- A full-card `<Link>` cannot contain a nested form; the card markup must be refactored to avoid invalid interactive nesting.
- Browser confirmation alone is insufficient because Server Actions are reachable by direct POST; server-side validation is mandatory.
- Supabase storage objects for client documents are not deleted by the DB cascade; this issue follows existing domain/schema behavior and deletes database relationships. Full storage cleanup can be a follow-up if required.
