# Design: issue-183-traveler-checklist

## Data flow

`src/app/t/[slug]/page.tsx` already uses:

```ts
const [trip, contact] = await Promise.all([getTripWithDetails(slug), getSiteSettings()]);
```

The public Supabase branch of `getTripWithDetails(slug)` resolves the trip row with an explicit public column list and then calls `assemblePublicTripWithDetails(tripRow)`. This design keeps that entrypoint and adds checklist loading inside the public assembler after global trip documents are loaded:

```ts
const { data: packingRows, error: packingError } = await supabase
  .from("packing_items")
  .select("id, trip_id, label, checked, sort_order")
  .eq("trip_id", trip.id)
  .order("sort_order", { ascending: true });
```

Rows are mapped with the existing `rowToPackingItem()` helper and assigned to `TripWithDetails.packingItems`.

## RLS design

The original `0010_packing_items.sql` migration intentionally made checklist rows authenticated-only. For traveler visibility, add a narrow public read policy:

```sql
create policy "packing_items_public_read_published_trips" on packing_items
  for select
  using (
    exists (
      select 1
      from trips
      where trips.id = packing_items.trip_id
        and trips.status = 'published'
    )
  );

grant select on packing_items to anon;
```

This exposes only rows belonging to trips already visible through the published public itinerary policy. It does not grant insert, update, or delete to anonymous users.

## UI placement

No UI move is required. The current `/t/[slug]` markup renders the read-only checklist in the side column immediately after the `Documentos del viaje` section. Once `packingItems` is populated, the existing condition renders it in the requested location.

## Tests

Update `src/lib/__tests__/public-trip-details.test.ts` to:

- Include one mocked `packing_items` row.
- Assert `getTripWithDetails("safari-africa")` returns the mapped packing item.
- Assert public assembly queries `packing_items` but still does not query private dashboard-only relation tables.
