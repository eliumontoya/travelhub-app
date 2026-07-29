-- Add supplier tags as simple text labels for catalog filtering.
-- Backfills the existing seed suppliers so mock and Supabase expose useful examples.

alter table suppliers
  add column if not exists tags text[] not null default '{}';

update suppliers
set tags = array['hotel', 'lujo', 'cancun']
where name = 'Grand Fiesta Americana' and (tags is null or cardinality(tags) = 0);

update suppliers
set tags = array['restaurante', 'mexicana', 'cdmx']
where name = 'María Sazón' and (tags is null or cardinality(tags) = 0);

update suppliers
set tags = array['transporte', 'ejecutivo', 'aeropuerto']
where name = 'AeroTransporte Ejecutivo' and (tags is null or cardinality(tags) = 0);

update suppliers
set tags = array['tours', 'rivieramaya', 'aventura']
where name = 'Aventuras Mayas Tour Op' and (tags is null or cardinality(tags) = 0);

update suppliers
set tags = array['promocionales', 'sur']
where name = 'Distribuidora Turística del Sur' and (tags is null or cardinality(tags) = 0);
