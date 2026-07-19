-- Plantillas de viaje reusables (issue #31).
--
-- Un viaje puede marcarse como plantilla (is_template = true): guarda la
-- estructura de días/items de un viaje existente para reusarla al crear
-- viajes nuevos. Las plantillas no tienen cliente asociado (client_id queda
-- null, sin filas en trip_clients) y se excluyen de los listados normales de
-- viajes (dashboard, historial de cliente).
--
-- trips.client_id ya es nullable desde 0006_trip_clients.sql, así que no se
-- requiere ningún cambio de esa columna aquí.

alter table trips add column if not exists is_template boolean not null default false;

-- Defensa en profundidad a nivel de esquema: una plantilla nunca debe tener
-- client_id, aun si algún código futuro se salta la capa de datos.
alter table trips drop constraint if exists trips_template_no_client_check;
alter table trips
  add constraint trips_template_no_client_check
  check (not is_template or client_id is null);

create index if not exists idx_trips_is_template on trips(is_template);
