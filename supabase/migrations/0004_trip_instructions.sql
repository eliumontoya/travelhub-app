-- Agrega columna instructions (texto libre visible para el viajero) a trips.
-- Nullable, sin cambios de RLS: las políticas existentes owner-all y
-- public-read-published de 0001_init.sql/0003_rls_harden.sql cubren la nueva
-- columna automáticamente.
alter table trips add column instructions text;
