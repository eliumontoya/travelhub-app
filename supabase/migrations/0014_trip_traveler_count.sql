-- Agrega columna traveler_count (número de viajeros) a trips. NOT NULL con
-- default 1 para que los viajes existentes queden consistentes sin backfill
-- manual. Sin cambios de RLS: las políticas owner-all y
-- public-read-published de 0001_init.sql/0003_rls_harden.sql cubren la
-- nueva columna automáticamente.
alter table trips add column traveler_count integer not null default 1;
