-- Precio de venta y % de comisión por viaje (issue #53), solo para uso del
-- agente en el editor del dashboard. Nullable, sin cambios de RLS: las
-- políticas existentes owner-all y public-read-published de
-- 0001_init.sql/0003_rls_harden.sql cubren las columnas nuevas
-- automáticamente a nivel de fila; la vista pública /t/[slug] nunca las
-- selecciona ni las renderiza (ver src/lib/data.ts, getTripWithDetails).
alter table trips add column sale_price numeric;
alter table trips add column commission_rate numeric;
