-- Costo opcional por item, para poder armar la cotización imprimible del
-- viaje (issue #51): subtotal por día = suma de items.cost del día, total
-- del viaje = suma de todos los días.
--
-- "add column if not exists" es aditivo a propósito: existe otra rama
-- (issue #25, sin mergear) que puede agregar esta misma columna de forma
-- independiente. Si esa rama corre primero, esta migración no debe fallar
-- ni duplicar la columna; si esta corre primero, no debe bloquear a la otra.
-- Nullable, sin default explícito (NULL = costo no capturado, se trata como
-- 0 en la UI), sin cambios de RLS: la política owner-all existente de
-- items cubre la columna nueva automáticamente.

alter table items add column if not exists cost numeric;
