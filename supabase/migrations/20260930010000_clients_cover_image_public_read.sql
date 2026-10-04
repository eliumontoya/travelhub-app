-- Portada de cliente legible por anon en el historial público (issue #47).
--
-- Regresión introducida al migrar el historial público a datos reales:
-- getClientPublishedTripsBySlug (src/lib/data/trip-queries.ts) selecciona
-- clients.cover_image_url con el cliente `anon` del servidor, pero
-- 0019_client_public_slug.sql solo concedió lecturas de columna
-- (id, slug, name). Con la columna fuera del GRANT, PostgREST devuelve un
-- error de permisos y /c/{slug} responde 500.
--
-- La portada SÍ es pública por diseño: 0031_client_cover_image.sql ya declara
-- el bucket `client-covers` como público y la vista /c/[slug] la pinta como
-- imagen de cabecera sin sesión. Por eso se amplía el GRANT de columna (no de
-- tabla): anon sigue sin poder leer email/phone/notes/whatsapp ni demás campos
-- privados de clients. La política RLS clients_public_read_published_trips
-- (0019) sigue acotando las filas a clientes con al menos un viaje publicado.

grant select (cover_image_url) on clients to anon;
