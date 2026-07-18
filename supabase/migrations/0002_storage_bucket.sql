-- Bucket privado para documentos adjuntos a items (boletos, vouchers, etc).
-- Se crea vía SQL para que quede versionado; también se puede crear a mano
-- desde el dashboard de Supabase (Storage > New bucket > "trip-documents",
-- marcado como privado) si esta migración no corre por permisos.

insert into storage.buckets (id, name, public)
values ('trip-documents', 'trip-documents', false)
on conflict (id) do nothing;

-- Solo el dueño autenticado (mono-usuario) puede leer/escribir/borrar objetos
-- del bucket. No hay política de lectura pública: los documentos son
-- material interno del agente, no se exponen en la vista pública /t/{slug}.
create policy "trip_documents_owner_all" on storage.objects
  for all
  using (bucket_id = 'trip-documents' and auth.uid() is not null)
  with check (bucket_id = 'trip-documents' and auth.uid() is not null);
