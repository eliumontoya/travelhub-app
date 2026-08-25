-- Google Places identifier captured during assisted supplier entry.
-- Nullable/additive so existing suppliers and manual capture remain unchanged.

alter table suppliers
  add column if not exists google_place_id text;

create index if not exists suppliers_google_place_id_idx
  on suppliers (google_place_id)
  where google_place_id is not null;
