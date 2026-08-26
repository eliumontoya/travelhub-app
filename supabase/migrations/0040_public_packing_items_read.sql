-- Expose the traveler packing checklist on published public itineraries only.
-- Anonymous travelers may read labels/check state for a published trip, while
-- all writes remain authenticated-only through the existing owner policy.

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
