-- Checklist de equipaje (packing list) por viaje (issue #24).
--
-- Lista de items de equipaje por viaje, cada uno con check on/off. Tabla
-- separada (no columna JSON en trips) porque necesita orden (sort_order) y
-- toggling individual sin reescribir un blob completo en cada cambio.
-- Sin templates por tipo de viaje en este cambio (opcional en el issue).

create table if not exists packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Búsqueda hacia adelante (trip -> items) ordenada por sort_order.
create index if not exists idx_packing_items_trip_id on packing_items(trip_id);

-- ============================================================
-- Row Level Security (mismo patrón que trip_tags_owner_all / tags_owner_all)
-- ============================================================
-- Sin exposición pública/anónima: la vista pública /t/[slug] no expone el
-- packing list, es una herramienta interna del Tritón que arma el viaje.

alter table packing_items enable row level security;
alter table packing_items force row level security;

create policy "packing_items_owner_all" on packing_items
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on packing_items from anon;
revoke all on packing_items from authenticated;
grant select, insert, update, delete on packing_items to authenticated;

-- Nota: sin backfill. Feature nueva, sin datos previos de packing lists.
