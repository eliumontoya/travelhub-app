-- Portada de perfil de cliente (issue #133).
-- Columna opcional en clients; bucket público para servir la imagen en la
-- vista pública /c/{slug} sin autenticación (mismo caso de uso que
-- trip-photos en 0012_trip_photos.sql).

alter table clients add column if not exists cover_image_url text;

-- Bucket público: la portada se muestra en /c/[slug], que no requiere login,
-- por lo que el objeto debe ser legible por anon. La escritura queda
-- restringida al dueño autenticado (mono-usuario).
insert into storage.buckets (id, name, public)
values ('client-covers', 'client-covers', true)
on conflict (id) do nothing;

create policy "client_covers_owner_all" on storage.objects
  for all
  using (bucket_id = 'client-covers' and auth.uid() is not null)
  with check (bucket_id = 'client-covers' and auth.uid() is not null);

create policy "client_covers_public_read" on storage.objects
  for select
  using (bucket_id = 'client-covers');
