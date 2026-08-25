# Verify Report: Public Trip Render Must Avoid Private Relation Reads

## Change

`fix-public-trip-render`

## Linked Work

- Issue: #157
- PR: #158
- Merge commit: `96e6e76577903c886cdf9f8edae9ea350a4af3d6`

## Live Diagnosis Evidence

The Safari Africa public traveler URL returned the production error page. Vercel logs showed:

```text
Supabase 42501: permission denied for table trip_clients
```

Additional REST checks showed:

- `trips.cover_image_url` was populated for `safari-africa-mt6agt9u`.
- The Supabase Storage image URL returned `200 image/jpeg`.
- `trip_clients` denied anon access.
- `packing_items` denied anon access; restoring public checklist visibility needs a separate RLS/design follow-up.

## Verification Commands

Run in isolated worktree `.worktrees/fix-public-trip-render` before PR #158:

```text
npx tsc --noEmit
npm run test
npm run build
```

## Results

- TypeScript: PASS
- Unit tests: PASS (`15` files, `97` tests)
- Production build: PASS
- Vercel preview for PR #158: PASS

## Regression Coverage

`src/lib/__tests__/public-trip-details.test.ts` verifies public trip assembly:

- returns the trip `coverImageUrl`
- queries only public-safe tables in the mocked path
- does not query `trip_clients`
- does not query `packing_items` in the current merged implementation, preventing the next anon/RLS crash but leaving public checklist visibility as a follow-up warning

## Verdict

PASS WITH WARNING. The public traveler route now has a dedicated public-safe assembly path and no longer depends on private dashboard relation table reads for `/t/[slug]` rendering.

## Warning

Existing OpenSpec requirements still describe public packing checklist visibility. The merged fix avoids private/RLS-denied reads to restore the public itinerary and cover hero. A follow-up should address the checklist requirement explicitly.
