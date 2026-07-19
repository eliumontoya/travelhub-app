-- Agrega costo opcional por item y presupuesto opcional por viaje, para
-- poder comparar gasto planeado (suma de items.cost) contra trips.budget.
-- Ambas columnas nullable, sin default y sin cambios de RLS: las políticas
-- existentes owner-all y public-read-published cubren las columnas nuevas
-- automáticamente.
alter table items add column cost numeric;
alter table trips add column budget numeric;
