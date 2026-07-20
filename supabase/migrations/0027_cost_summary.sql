-- Costo opcional por item + toggle para mostrar el resumen de costos al
-- cliente en la vista pública del viaje (issue #35). Ambas columnas son
-- aditivas y con default seguro: cost NULL (sin costo cargado) y
-- show_costs_to_client false (oculto por defecto, opt-in explícito del
-- agente Triton).

alter table items
  add column if not exists cost numeric;

alter table trips
  add column if not exists show_costs_to_client boolean not null default false;
