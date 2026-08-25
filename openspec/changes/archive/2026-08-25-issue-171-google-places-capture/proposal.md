# Proposal: Google Places Supplier Capture (#171)

## Intent
Reduce manual supplier capture by letting agents search Google Places and copy trusted name/address/coordinates into TravelHub's supplier catalog.

## Scope
In: optional Places search in supplier create/edit, nullable `googlePlaceId`, manual fallback when key/script is missing, setup docs.  
Out: existing-supplier batch enrichment, periodic sync, non-Google providers, public traveler dependency.

## Capability
Modified: `supplier-catalog` gains assisted place capture while retaining manual CRUD.

## Approach
Add nullable `suppliers.google_place_id`; map it through `Supplier` and `src/lib/data.ts`. Add a supplier-specific client autocomplete component using `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and requested fields `place_id,name,formatted_address,geometry`. Selection fills form state; fields stay editable.

## Risks / Rollback
Places failures must not block manual entry; the component disables only search and shows status text. Revert this PR to roll back; DB change is additive/nullable and can remain harmlessly.

## Success
- Place selection fills name, address, lat, lng, googlePlaceId.
- Manual edits after selection are saved.
- No-key/script-failure paths keep manual supplier creation working.
