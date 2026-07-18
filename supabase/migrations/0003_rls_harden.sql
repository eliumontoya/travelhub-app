-- Hardening de RLS (Sprint 5).
--
-- Auditoría de 0001_init.sql: las políticas "_owner_all" (FOR ALL, requieren
-- auth.uid() is not null) y las políticas "_public_read_published" (FOR
-- SELECT, requieren status = 'published') son permisivas y se combinan con
-- OR por tabla/comando en Postgres RLS. Esto ya restringe correctamente:
--   - escritura (insert/update/delete) SOLO a usuarios autenticados, en
--     todas las tablas (clients, trips, trip_days, items, documents).
--   - lectura pública (rol anon, sin sesión) SOLO a trips con
--     status = 'published' y a sus days/items/documents relacionados;
--     "clients" no tiene ninguna política pública, por lo que el nombre del
--     cliente nunca se expone en /t/{slug} (la página pública tampoco lo
--     renderiza, defensa en profundidad).
-- No se encontraron huecos en la lógica de las políticas en sí. El hueco
-- real de defensa en profundidad es que RLS por sí sola no protege una
-- tabla nueva que se cree en el futuro sin habilitar RLS explícitamente, o
-- si Supabase otorga privilegios amplios por default a "anon"/"authenticated"
-- a nivel de GRANT. Este archivo deja esos privilegios explícitos y mínimos.

revoke all on clients, trips, trip_days, items, documents from anon;
revoke all on clients, trips, trip_days, items, documents from authenticated;

-- anon: solo lectura, y solo llega a filas de "published" gracias a RLS.
grant select on trips, trip_days, items, documents to anon;

-- authenticated: acceso completo, filtrado igual por RLS a auth.uid() is not null.
grant select, insert, update, delete on clients, trips, trip_days, items, documents to authenticated;

-- Asegura que ni siquiera el dueño de la tabla (rol usado por conexiones
-- directas fuera de PostgREST) se salte RLS por accidente.
alter table clients force row level security;
alter table trips force row level security;
alter table trip_days force row level security;
alter table items force row level security;
alter table documents force row level security;
