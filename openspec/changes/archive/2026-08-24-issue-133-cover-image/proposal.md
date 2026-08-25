# Proposal: Client Profile Cover Image (issue #133)

## Problem

The client profile page (`/c/[slug]`, public) and the agent's client detail
page (`/dashboard/clients/[id]`) render a plain gray banner. Issue #133 asks for
the ability to **select or upload an image** so the user profile's cover image
can be changed.

## Proposed approach

Add an optional `coverImageUrl` to the `Client` model and a public Supabase
Storage bucket `client-covers` for the image. The agent uploads a cover image
from the client detail page (file picker = "select", upload = "subir"); the
public profile banner renders the image as a background when present.

## Why this approach

- Reuses the existing dual-mode data layer (`src/lib/data.ts`) and Server Action
  + storage-upload patterns already proven by `uploadClientDocument` /
  `uploadTripPhoto`.
- A public bucket is required because the cover is shown on the unauthenticated
  `/c/[slug]` page (same constraint that made `trip-photos` public).
- Single-cover (not a gallery) matches the literal "imagen de cover" scope and
  keeps the schema change minimal (one nullable column).

## Affected surfaces

- `clients` table: new nullable `cover_image_url` column.
- New public storage bucket `client-covers` + RLS.
- `src/lib/data.ts`: `Client.coverImageUrl`, `updateClient`, new upload/remove.
- `src/app/dashboard/clients/[id]`: cover upload UI + banner.
- `src/app/c/[slug]`: banner renders cover image.

## Assumptions

- "User profile" = client profile (the end-user facing identity in this product).
- "Select or upload" = pick a file via the OS file dialog and upload it; a
  pre-existing image library to choose from is out of scope for this issue.
- One cover image per client (re-upload replaces; remove clears).

## Rollback plan

- Drop column `cover_image_url` and bucket `client-covers` via a down migration.
- Feature is additive and degrades to the existing gray banner when unset.
