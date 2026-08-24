# Tasks: Client Profile Cover Image (issue #133)

## 1. Schema & storage

- [ ] Add `coverImageUrl?: string` to `Client` in `src/types/index.ts`.
- [ ] Create migration `supabase/migrations/0031_client_cover_image.sql`:
  `cover_image_url` column, public `client-covers` bucket, storage RLS.

## 2. Data layer

- [ ] `CreateClientInput`: add `coverImageUrl?`.
- [ ] `rowToClient`: map `cover_image_url`.
- [ ] `updateClient`: propagate `coverImageUrl -> cover_image_url`.
- [ ] Add `COVERS_BUCKET`, `uploadClientCoverImage`, `removeClientCoverImage`.
- [ ] `getClientPublishedTripsBySlug`: include `coverImageUrl` in returned client.

## 3. Server Actions

- [ ] `src/app/dashboard/clients/[id]/actions.ts`: `uploadClientCoverAction`,
  `removeClientCoverAction` (bind clientId, revalidate path).

## 4. UI — dashboard client detail

- [ ] `src/components/ClientCoverImage.tsx` (upload/remove/preview + disabled hint).
- [ ] Wire into `src/app/dashboard/clients/[id]/page.tsx` + render banner.

## 5. UI — public profile

- [ ] `src/app/c/[slug]/page.tsx`: render cover background when present.

## 6. Verify

- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- [ ] `npm run test` (no regressions).
