-- Marca del agente en el cover de /t/[slug] (issue #138): nombre de agencia
-- y logo, persistidos en el singleton site_settings.
alter table site_settings
  add column if not exists agency_name text not null default '',
  add column if not exists logo_url text not null default '';

-- Bucket público para el logo de la agencia, servido directo por URL (igual
-- criterio que "trip-photos"): el logo debe verse en la vista pública /t/{slug}
-- sin auth, así que el bucket es público.
insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

-- Solo el dueño autenticado (mono-usuario) escribe/borra objetos del bucket.
create policy if not exists "site_assets_owner_all" on storage.objects
  for all
  using (bucket_id = 'site-assets' and auth.uid() is not null)
  with check (bucket_id = 'site-assets' and auth.uid() is not null);

-- Lectura pública: el logo se renderiza en la vista pública del itinerario.
create policy if not exists "site_assets_public_read" on storage.objects
  for select
  using (bucket_id = 'site-assets');
