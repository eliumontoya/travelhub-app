# Tasks: Public Trip Render Must Avoid Private Relation Reads

## Implementation

- [x] Diagnose live `/t/safari-africa-mt6agt9u` failure from Vercel logs.
- [x] Confirm the trip has `cover_image_url` and the Supabase image URL returns HTTP 200.
- [x] Add public-safe trip assembly for `/t/[slug]`.
- [x] Keep dashboard trip assembly unchanged.
- [x] Ensure public route does not query private assigned-client relations such as `trip_clients`.
- [x] Add regression test for private table avoidance.
- [x] Run typecheck, tests, and production build.
- [x] Merge PR #158 to `main`.
- [x] Archive OpenSpec audit trail.


## Follow-Up

- Decide whether public packing checklist should be restored through a narrow `packing_items` public read policy for published trips or revised in the public-trip-sharing spec.
