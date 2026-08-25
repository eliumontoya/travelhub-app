# Proposal: Supplier Place Enrichment (issue #172)

## Intent

Help the agent complete existing suppliers that lack address, coordinates, or `googlePlaceId` by searching Google Places candidates and applying only a human-confirmed match.

## Scope

### In Scope
- Add an enrichment action for each supplier in `/dashboard/suppliers`.
- Search Places candidates from supplier name, type, and existing address/city context.
- Show current values vs selected candidate before saving.
- Apply address, coordinates, and `googlePlaceId` only after explicit confirmation.
- Degrade gracefully when Google Places is not configured or returns no reliable results.

### Out of Scope
- Automatic overwrite without review.
- Batch/background enrichment.
- Periodic revalidation of Google data.
- External file imports.

## Capabilities

### New Capabilities
None

### Modified Capabilities
- `supplier-catalog`: Adds Google Places-assisted enrichment for existing suppliers.

## Approach

Reuse the existing Google Maps JS loader and supplier update action. Add a client enrichment dialog that runs Places Text Search, displays candidates, compares selected found data against current supplier fields, and submits the existing edit form shape after confirmation.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/SupplierPlaceAutocomplete.tsx` | Modified | Expose shared Places script loading/types for search reuse. |
| `src/components/SupplierPlaceEnrichmentDialog.tsx` | New | Candidate search, review, and confirm UI. |
| `src/app/dashboard/suppliers/catalog-client.tsx` | Modified | Adds per-supplier enrichment action/dialog. |
| `src/app/dashboard/suppliers/actions.ts` | Modified | Reuses update action for confirmed enrichment. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Wrong Google match overwrites curated data | Med | Require selected candidate + explicit confirmation and show comparison. |
| API unavailable/key missing | Med | Non-blocking disabled/error/empty states; manual edit remains available. |

## Rollback Plan

Revert the UI/component changes and SDD artifacts. Existing supplier data remains valid because the feature only updates existing nullable fields through the current update path.

## Dependencies

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` with Maps JavaScript API and Places API (New) enabled.

## Success Criteria

- [ ] Existing supplier can be enriched from a confirmed Google candidate.
- [ ] Multiple candidates can be reviewed/chosen or cancelled.
- [ ] No supplier is changed before explicit confirmation.
- [ ] Missing/no-result Google state keeps manual editing available.
