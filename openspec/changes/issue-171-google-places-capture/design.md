# Design: Google Places Supplier Capture (#171)

## Decisions
1. Create `SupplierPlaceAutocomplete` instead of changing `LocationInput`; suppliers need `place_id` and `name`.
2. Keep supplier form fields as the source of truth; Google selection only writes into editable name/address/lat/lng state plus hidden `googlePlaceId`.
3. Treat Places as optional: no key or load failure disables search only, not manual capture.
4. Add nullable, non-unique `google_place_id` with an index; no uniqueness assumption yet.

## Flow
Dialog opens → optional Places script loads → selected place emits `{googlePlaceId,name,address,lat,lng}` → dialog updates fields → agent may edit → Server Action parses FormData → `data.ts` persists mock/Supabase.

## Testing
Strict TDD: RED data tests for create/update metadata, then full `npm run test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
