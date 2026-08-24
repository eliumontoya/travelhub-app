# Apply Progress: Client Profile Cover Image (issue #133)

**Status**: reconciled against merged PR #145 (`eef6f4c`)  
**Mode**: Strict TDD reconciliation (RED = N/A, GREEN = merged-code evidence, REFACTOR = N/A)  
**Verification**: `npx tsc --noEmit` ✓ | `npm run build` ✓ | `npm run test` 91/91 ✓

## Task Completion

### 1. Schema & storage

- [x] Add `coverImageUrl?: string` to `Client` in `src/types/index.ts`.
  - Evidence: `src/types/index.ts:33-34` — `coverImageUrl?: string` with JSDoc comment.
- [x] Create migration `supabase/migrations/0031_client_cover_image.sql`.
  - Evidence: `supabase/migrations/0031_client_cover_image.sql:6` — `alter table clients add column if not exists cover_image_url text;`
  - Evidence: `supabase/migrations/0031_client_cover_image.sql:11-13` — public bucket `client-covers`.
  - Evidence: `supabase/migrations/0031_client_cover_image.sql:15-22` — RLS policies `client_covers_owner_all` and `client_covers_public_read`.

### 2. Data layer

- [x] `CreateClientInput`: add `coverImageUrl?`.
  - Evidence: `src/lib/data.ts:78-86` — `coverImageUrl?: string` in `CreateClientInput`.
- [x] `rowToClient`: map `cover_image_url`.
  - Evidence: `src/lib/data.ts:208` — `coverImageUrl: (row.cover_image_url as string) ?? undefined`.
- [x] `updateClient`: propagate `coverImageUrl -> cover_image_url`.
  - Evidence: `src/lib/data.ts:180` — mock path updates `client.coverImageUrl`.
  - Evidence: `src/lib/data.ts:192` — Supabase patch sets `cover_image_url` to `coverImageUrl || null`.
- [x] Add `COVERS_BUCKET`, `uploadClientCoverImage`, `removeClientCoverImage`.
  - Evidence: `src/lib/data.ts:2554` — `const COVERS_BUCKET = "client-covers";`.
  - Evidence: `src/lib/data.ts:2556-2572` — `uploadClientCoverImage` uploads to `clients/{clientId}/{timestamp}-{name}`, gets public URL, calls `updateClient`.
  - Evidence: `src/lib/data.ts:2574-2576` — `removeClientCoverImage` clears `coverImageUrl` via `updateClient`.
- [x] `getClientPublishedTripsBySlug`: include `coverImageUrl` in returned client.
  - Evidence: `src/lib/data.ts:1172` — `ClientTripHistory` type picks `coverImageUrl`.
  - Evidence: `src/lib/data.ts:1193` — mock return includes `coverImageUrl: client.coverImageUrl`.
  - Evidence: `src/lib/data.ts:1198` — Supabase select includes `cover_image_url`.
  - Evidence: `src/lib/data.ts:1216` — `coverImageUrl: (clientRow.cover_image_url as string) ?? undefined`.

### 3. Server Actions

- [x] `src/app/dashboard/clients/[id]/actions.ts`: `uploadClientCoverAction`, `removeClientCoverAction`.
  - Evidence: `src/app/dashboard/clients/[id]/actions.ts:45-50` — `uploadClientCoverAction` bound to `clientId`, validates `File`, calls `uploadClientCoverImage`, `revalidatePath`.
  - Evidence: `src/app/dashboard/clients/[id]/actions.ts:52-55` — `removeClientCoverAction` bound to `clientId`, calls `removeClientCoverImage`, `revalidatePath`.

### 4. UI — dashboard client detail

- [x] `src/components/ClientCoverImage.tsx`.
  - Evidence: `src/components/ClientCoverImage.tsx:5-15` — component props include `coverImageUrl`, `coversEnabled`, `onUpload`, `onRemove`.
  - Evidence: `src/components/ClientCoverImage.tsx:64` — file input `accept="image/*"`.
  - Evidence: `src/components/ClientCoverImage.tsx:71` — "Subir portada" / "Cambiar portada" button.
  - Evidence: `src/components/ClientCoverImage.tsx:49-56` — "Quitar" button when image present.
  - Evidence: `src/components/ClientCoverImage.tsx:75` — disabled hint "Configura Supabase para subir la portada." when `!coversEnabled`.
- [x] Wire into `src/app/dashboard/clients/[id]/page.tsx` + render banner.
  - Evidence: `src/app/dashboard/clients/[id]/page.tsx:13` — imports `ClientCoverImage`.
  - Evidence: `src/app/dashboard/clients/[id]/page.tsx:217-222` — renders `ClientCoverImage` bound to actions.
  - Evidence: `src/app/dashboard/clients/[id]/page.tsx:57-62` — renders top banner `<img>` when `client.coverImageUrl` exists.

### 5. UI — public profile

- [x] `src/app/c/[slug]/page.tsx`: render cover background when present.
  - Evidence: `src/app/c/[slug]/page.tsx:19-30` — banner applies `backgroundImage` with gradient overlay when `client.coverImageUrl` is set, otherwise keeps `bg-gray-800`.

### 6. Verify

- [x] `npm run lint`, `npx tsc --noEmit`, `npm run build`.
  - Evidence: `npx tsc --noEmit` exited 0.
  - Evidence: `npm run build` exited 0 (Next.js 16.2.10, 13 static/dynamic routes generated).
- [x] `npm run test` (no regressions).
  - Evidence: `npm run test` — 12 files, 91 tests passed.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1 Client type `coverImageUrl` | N/A (reconciliation) | `src/types/index.ts:34` | N/A |
| 1.2 Migration + bucket + RLS | N/A (reconciliation) | `supabase/migrations/0031_client_cover_image.sql:6-22` | N/A |
| 2.1 `CreateClientInput.coverImageUrl?` | N/A (reconciliation) | `src/lib/data.ts:85` | N/A |
| 2.2 `rowToClient` mapping | N/A (reconciliation) | `src/lib/data.ts:208` | N/A |
| 2.3 `updateClient` propagation | N/A (reconciliation) | `src/lib/data.ts:180,192` | N/A |
| 2.4 `COVERS_BUCKET`, upload/remove | N/A (reconciliation) | `src/lib/data.ts:2554-2576` | N/A |
| 2.5 `getClientPublishedTripsBySlug` includes `coverImageUrl` | N/A (reconciliation) | `src/lib/data.ts:1172,1193,1198,1216` | N/A |
| 3.1 Server actions upload/remove | N/A (reconciliation) | `src/app/dashboard/clients/[id]/actions.ts:45-55` | N/A |
| 4.1 `ClientCoverImage.tsx` | N/A (reconciliation) | `src/components/ClientCoverImage.tsx:5-78` | N/A |
| 4.2 Dashboard page wiring + banner | N/A (reconciliation) | `src/app/dashboard/clients/[id]/page.tsx:57-62,217-222` | N/A |
| 5.1 Public profile banner | N/A (reconciliation) | `src/app/c/[slug]/page.tsx:19-30` | N/A |
| 6.1 Typecheck/build | N/A (reconciliation) | `npx tsc --noEmit` 0, `npm run build` 0 | N/A |
| 6.2 Test suite | N/A (reconciliation) | `npm run test` 91/91 passed | N/A |

## Coverage Gaps

- No dedicated unit tests for `uploadClientCoverImage`, `removeClientCoverImage`, `rowToClient` cover mapping, or `getClientPublishedTripsBySlug` cover inclusion. The existing suite passes without regressions, but the data-layer behavior for this change is not directly tested. This is noted for verify-phase remediation.

## Deviations from Design

None — implementation matches design.

## Issues Found

None blocking. Two environment warnings surfaced during build:
1. Next.js middleware deprecation notice (pre-existing, unrelated to issue #133).
2. Node.js 20 deprecation warning from `@supabase/supabase-js` (pre-existing, unrelated to issue #133).
