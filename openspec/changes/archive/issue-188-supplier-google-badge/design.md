# Design: Supplier Google Badge (issue #188)

## Technical Approach

Create a small presentational `SupplierGooglePlaceBadge` component that renders an icon-style badge only when a non-empty `googlePlaceId` is present. Use the existing `Supplier.googlePlaceId` field as the source of truth and place the badge next to the supplier name in the existing catalog row.

## Decisions

- Use `googlePlaceId` as the only signal because issues #171/#172 already persist it when a supplier is captured or enriched from Google Places.
- Render nothing for missing/blank ids so non-Google suppliers degrade gracefully.
- Use text plus an icon in a pill badge, with `aria-label`/`title`, instead of icon-only UI for accessibility.
- Keep this as a presentational component and avoid any new Client Component boundary or data fetch.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/components/SupplierGooglePlaceBadge.tsx` | New | Reusable accessible badge. |
| `src/app/dashboard/suppliers/catalog-client.tsx` | Modified | Shows badge beside supplier names with `googlePlaceId`. |
| `src/components/__tests__/SupplierGooglePlaceBadge.test.tsx` | New | Covers present/absent rendering. |
| `openspec/specs/supplier-catalog/spec.md` | Modified on archive | Adds observable badge requirement. |

## Test Strategy

- Add focused render-to-static-markup tests for the badge.
- Run full typecheck, unit tests, and production build.
