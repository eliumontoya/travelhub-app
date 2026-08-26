# Proposal: Supplier Google Badge (issue #188)

## Intent

Make Google-enriched suppliers easy to identify in the supplier catalog by showing an attractive accessible visual badge when a supplier has a persisted Google Maps/Places id.

## Scope

### In Scope

- Add a visible badge/icon in `/dashboard/suppliers` rows for suppliers with `googlePlaceId`.
- Keep rows without `googlePlaceId` visually unchanged aside from normal layout spacing.
- Add focused UI tests for badge presence and graceful absence.
- Archive the OpenSpec change in the same feature branch after verification.

### Out of Scope

- New Google API calls.
- Schema changes or migrations.
- Revalidating or enriching supplier data.
- Changing supplier filters/search semantics.

## Capabilities

### Modified Capabilities

- `supplier-catalog`: Adds Google Maps identity visibility in the supplier list.

## Rollback Plan

Revert the badge component, the supplier row usage, and this OpenSpec change. No persisted data is changed.
