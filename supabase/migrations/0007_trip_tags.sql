-- Etiquetas/tags por viaje, 0..N (issue #5).
--
-- Catálogo global (compartido entre todos los viajes) de tags + tabla puente
-- trip_tags many-to-many. A diferencia de trip_clients (issue #4), un viaje
-- puede tener 0 tags: no hay ninguna regla de mínimo 1 aquí.

create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Unicidad case-insensitive: "VIP" y "vip" no pueden coexistir como dos filas
-- distintas del catálogo. Índice de expresión (no citext, no extensión nueva).
create unique index if not exists tags_name_lower_key on tags (lower(name));

create table if not exists trip_tags (
  trip_id uuid not null references trips(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (trip_id, tag_id)
);

-- La PK compuesta (trip_id, tag_id) ya cubre la búsqueda hacia adelante
-- (trip -> tags) por ser trip_id la columna líder. Se agrega índice
-- explícito para la búsqueda inversa (tag -> viajes), para habilitar
-- filtrar/agrupar por tag más adelante (no hay UI para esto en este cambio).
create index if not exists idx_trip_tags_tag_id on trip_tags(tag_id);

-- ============================================================
-- Row Level Security (mismo patrón que trip_clients_owner_all)
-- ============================================================
-- Sin exposición pública/anónima de tags, consistente con clients y
-- trip_clients: la vista pública /t/[slug] no expone tags.

alter table tags enable row level security;
alter table tags force row level security;

create policy "tags_owner_all" on tags
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on tags from anon;
revoke all on tags from authenticated;
grant select, insert, update, delete on tags to authenticated;

alter table trip_tags enable row level security;
alter table trip_tags force row level security;

create policy "trip_tags_owner_all" on trip_tags
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

revoke all on trip_tags from anon;
revoke all on trip_tags from authenticated;
grant select, insert, update, delete on trip_tags to authenticated;

-- Nota: sin backfill. Feature nueva, sin datos previos de tags, sin columna
-- existente que defusar (a diferencia de 0005 con trips.client_id).
