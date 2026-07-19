-- Galería de fotos por viaje, subidas por el agente y visibles en la vista
-- pública /t/{slug} (issue #30).
--
-- A diferencia de "documents" (bucket privado, material interno del agente,
-- nunca expuesto al cliente final), las fotos SÍ son contenido pensado para
-- la vista pública: se usa un bucket de Storage separado y PÚBLICO
-- ("trip-photos") para poder renderizarlas con una URL directa, sin pagar
-- el costo de una URL firmada por foto en cada carga de la página pública.

create table if not exists trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_trip_photos_trip_id on trip_photos(trip_id);

-- ============================================================
-- Row Level Security (mismo patrón owner_all / public_read_published que
-- trips/trip_days/items/documents en 0001_init.sql)
-- ============================================================

alter table trip_photos enable row level security;
alter table trip_photos force row level security;

create policy "trip_photos_owner_all" on trip_photos
  for all
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- lectura pública (sin login) solo si el trip padre está publicado, para
-- que la galería aparezca en /t/{slug}.
create policy "trip_photos_public_read_published" on trip_photos
  for select
  using (
    exists (
      select 1 from trips
      where trips.id = trip_photos.trip_id
      and trips.status = 'published'
    )
  );

revoke all on trip_photos from anon;
revoke all on trip_photos from authenticated;

grant select on trip_photos to anon;
grant select, insert, update, delete on trip_photos to authenticated;

-- ============================================================
-- Storage: bucket público (a diferencia de "trip-documents", privado)
-- ============================================================

insert into storage.buckets (id, name, public)
values ('trip-photos', 'trip-photos', true)
on conflict (id) do nothing;

-- Solo el dueño autenticado puede subir/borrar fotos.
create policy "trip_photos_bucket_owner_write" on storage.objects
  for all
  using (bucket_id = 'trip-photos' and auth.uid() is not null)
  with check (bucket_id = 'trip-photos' and auth.uid() is not null);

-- Lectura pública explícita de los objetos del bucket (además de que el
-- bucket ya está marcado "public", esto cubre también accesos vía API con
-- rol anon, no solo la URL pública de CDN).
create policy "trip_photos_bucket_public_read" on storage.objects
  for select
  using (bucket_id = 'trip-photos');
