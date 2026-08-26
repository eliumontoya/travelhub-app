# Apply Progress: Supplier Google Badge (issue #188)

## Mode

Strict TDD (per `openspec/config.yaml`).

## Completed Tasks

- [x] 1.1 Added RED test for rendering an accessible Google Maps badge when `googlePlaceId` exists.
- [x] 1.2 Added RED tests for rendering nothing when `googlePlaceId` is missing or blank.
- [x] 2.1 Added `SupplierGooglePlaceBadge` as a small presentational component.
- [x] 2.2 Rendered the badge beside supplier names in `/dashboard/suppliers`.
- [x] 3.1 Focused unit test passed: `npx vitest run src/components/__tests__/SupplierGooglePlaceBadge.test.tsx`.

## Notes

The badge uses the existing persisted `Supplier.googlePlaceId` field from prior Google Places capture/enrichment work. It performs no Google API calls and renders nothing for manual suppliers.
