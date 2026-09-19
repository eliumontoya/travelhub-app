-- Backfill: crea un servicio trip_documents por cada asignacion existente
-- (trip_clients) que aun no tenga uno (issue #312).
--
-- El auto-create (ensureServiceForAssignment) corre solo para asignaciones
-- nuevas; los viajes creados antes de la feature no tienen fila en services.
-- Esta migracion es idempotente: ON CONFLICT DO NOTHING por el constraint
-- unico (trip_id, client_id, service_type).

insert into services (trip_id, client_id, service_type, status)
select tc.trip_id, tc.client_id, 'trip_documents', 'active'
from trip_clients tc
on conflict (trip_id, client_id, service_type) do nothing;