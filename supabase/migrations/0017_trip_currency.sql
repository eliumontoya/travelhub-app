-- Moneda por viaje (issue #44). Solo almacena el código de moneda elegido
-- para formatear montos de costo con el símbolo correcto; sin conversión de
-- tipo de cambio, eso queda fuera de alcance.
alter table trips
  add column currency text not null default 'MXN'
  check (currency in ('MXN', 'USD', 'EUR'));
