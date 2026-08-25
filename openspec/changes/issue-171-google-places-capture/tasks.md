# Tasks: Google Places Supplier Capture (#171)

## Review Workload Forecast
Estimated changed lines: <400 after concise SDD artifacts. Chained PRs: No. Delivery: single PR.

## Tasks
- [x] 1.1 Add RED mock data tests for supplier `googlePlaceId`, address, lat, lng create/update.
- [x] 1.2 Add `Supplier.googlePlaceId` and mock/Supabase data mappings.
- [x] 1.3 Add nullable `suppliers.google_place_id` migration plus index.
- [x] 2.1 Add supplier-specific optional Places autocomplete component.
- [x] 2.2 Fill editable supplier name/address/lat/lng and hidden `googlePlaceId` from selection.
- [x] 2.3 Parse lat/lng/googlePlaceId in supplier Server Actions.
- [x] 3.1 Document key setup and HTTP referrer restriction guidance.
- [x] 3.2 Verify with focused tests, full tests, typecheck, lint, and build.
