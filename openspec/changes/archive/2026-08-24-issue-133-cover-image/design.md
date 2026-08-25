# Design: Client Profile Cover Image (issue #133)

## Data model

Extend `Client` (`src/types/index.ts`):

```ts
export interface Client {
  // ...
  coverImageUrl?: string;
}
```

Supabase migration `0031_client_cover_image.sql`:

- `alter table clients add column cover_image_url text;`
- Create public bucket `client-covers` (mirrors `0012_trip_photos.sql` pattern).
- Storage policy `client_covers_owner_all` (authenticated write) and
  `client_covers_public_read` (public select).

## Data layer (`src/lib/data.ts`)

- `CreateClientInput`: add `coverImageUrl?: string`.
- `rowToClient`: map `cover_image_url -> coverImageUrl`.
- `updateClient`: propagate `coverImageUrl -> cover_image_url` in the patch.
- New constant `COVERS_BUCKET = "client-covers"`.
- New functions:
  - `uploadClientCoverImage(clientId, file): Promise<string>` — uploads to
    `clients/{clientId}/{timestamp}-{name}`, gets the public URL, calls
    `updateClient(clientId, { coverImageUrl })`, returns the URL. Throws if
    Supabase not configured.
  - `removeClientCoverImage(clientId): Promise<void>` — clears `coverImageUrl`
    via `updateClient`. (Storage object is left as an orphan; acceptable, noted
    as a known limitation.)
- `getClientPublishedTripsBySlug` returns `client: Pick<Client, "name" | "slug" | "coverImageUrl">`.

## UI — dashboard client detail (`src/app/dashboard/clients/[id]`)

New client component `src/components/ClientCoverImage.tsx` (mirrors
`ClientDocuments`/`TripPhotoGallery`):

- Props: `clientId`, `coverImageUrl`, `coversEnabled`, `onUpload`, `onRemove`.
- File input (`accept="image/*"`) + "Subir portada" button + preview + "Quitar"
  button. Disabled state + "Configura Supabase para subir la portada." hint.
- Wired via `uploadClientCoverAction` / `removeClientCoverAction` in
  `./actions.ts` and `revalidatePath`.
- Page renders a banner at the top using the cover URL when present.

## UI — public profile (`src/app/c/[slug]`)

Banner (`h-40 bg-gray-800`) becomes a background image when
`client.coverImageUrl` exists, with the existing dark gradient overlay for
text legibility.

## Mock mode

`uploadClientCoverImage` throws when Supabase is not configured (consistent with
other upload actions). `rowToClient` already returns `undefined` for missing
columns, so mock clients simply have no cover.
