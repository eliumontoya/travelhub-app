-- Agrega columna birth_date (fecha de nacimiento, opcional) a clients
-- (issue #52), usada para calcular alertas de cumpleaños próximos en el
-- dashboard. Nullable, sin cambios de RLS: las políticas owner-all
-- existentes de 0001_init.sql/0003_rls_harden.sql cubren la nueva columna
-- automáticamente.
alter table clients add column birth_date date;
