# Tasks: Client Profile Cover Image (issue #133)

## 1. Schema & storage

- [x] Add `coverImageUrl?: string` to `Client` in `src/types/index.ts`.
- [x] Create migration `supabase/migrations/0031_client_cover_image.sql`:
  `cover_image_url` column, public `client-covers` bucket, storage RLS.

## 2. Data layer

- [x] `CreateClientInput`: add `coverImageUrl?`.
- [x] `rowToClient`: map `cover_image_url`.
- [x] `updateClient`: propagate `coverImageUrl -> cover_image_url`.
- [x] Add `COVERS_BUCKET`, `uploadClientCoverImage`, `removeClientCoverImage`.
- [x] `getClientPublishedTripsBySlug`: include `coverImageUrl` in returned client.

## 3. Server Actions

- [x] `src/app/dashboard/clients/[id]/actions.ts`: `uploadClientCoverAction`,
  `removeClientCoverAction` (bind clientId, revalidate path).

## 4. UI — dashboard client detail

- [x] `src/components/ClientCoverImage.tsx` (upload/remove/preview + disabled hint).
- [x] Wire into `src/app/dashboard/clients/[id]/page.tsx` + render banner.

## 5. UI — public profile

- [x] `src/app/c/[slug]/page.tsx`: render cover background when present.

## 6. Verify

- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [x] `npm run test` (no regressions).
