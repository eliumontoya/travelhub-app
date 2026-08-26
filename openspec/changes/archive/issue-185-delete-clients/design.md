# Design: issue-185-delete-clients

## Architecture

Keep the existing App Router layering unchanged:

`ClientsExplorer` client leaf → route-local Server Action → `src/lib/data.ts` → Supabase or mock data.

The UI owns the confirmation prompt because it needs browser interactivity. The Server Action owns the actual safety check because Next.js Server Actions are directly POST-addressable and the docs require treating `FormData` as untrusted.

## Data-layer behavior

Add `deleteClient(id: string): Promise<void>` next to the other client functions in `src/lib/data.ts`.

### Mock mode

- Find the client index in `mockClients`; if missing, return without throwing (idempotent delete semantics).
- Remove the client from `mockClients`.
- Remove entries from `mockClientTags` for that client.
- Remove entries from `mockTripClients` for that client.
- For any mock trip whose compatibility mirror `clientId` equals the deleted id, set `clientId` to an empty string to mirror the nullable Supabase FK after `ON DELETE SET NULL`.

### Supabase mode

- `delete().eq("id", id)` from `clients`.
- Trust existing FK semantics for relationship cleanup:
  - `client_tags` cascade.
  - `trip_clients` cascade.
  - `client_documents` cascade.
  - `trips.client_id` set null.

## Server Action

Add `deleteClientAction(clientId: string, formData: FormData)` in `src/app/dashboard/clients/actions.ts`.

Algorithm:

1. Load `client = await getClientById(clientId)`.
2. If no client, return without mutation.
3. Read and trim `confirmationName`.
4. If it does not equal `client.name`, return without mutation.
5. Call `deleteClient(clientId)`.
6. Revalidate `/dashboard/clients`, `/dashboard`, and `/dashboard/clients/${clientId}`.
7. Return void; the form action relies on path revalidation for UI refresh.

## UI

Create a tiny `DeleteClientButton` client component colocated with the clients route. It renders a form with a hidden `confirmationName`. On submit, it calls `window.prompt` with Spanish destructive copy asking the agent to type the exact client name. If the value does not match, prevent submission; if it matches, write the value into the hidden input and allow the form to submit to the bound Server Action.

Refactor each client card from a top-level `<Link>` to a `<div>` containing a detail `<Link>` and the delete form. This avoids invalid nested interactive elements and keeps the card accessible.

## Verification Strategy

- Unit/data test in mock mode: deleting a created client removes it from `getClientById`.
- Unit/data test in mock mode: deleting an assigned client keeps the trip in `getTripWithDetails`/client trip queries while removing the deleted client's assignment.
- Typecheck, Vitest suite, and production build.
