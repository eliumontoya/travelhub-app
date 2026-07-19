-- Agrega columna internal_notes (notas privadas, solo para agentes) a trips.
-- Nullable, aditiva, sin cambios de RLS: las políticas owner-all y
-- public-read-published de 0001_init.sql/0003_rls_harden.sql cubren la
-- columna automáticamente a nivel de fila. La app nunca debe incluir esta
-- columna en el SELECT ni en el objeto Trip que llega a /t/[slug]; se lee
-- únicamente vía getTripInternalNotes() en src/lib/data.ts, usada solo por
-- el editor de dashboard.
alter table trips add column internal_notes text;
