-- Fuente de referido/adquisición por cliente (issue #54), para saber cómo
-- llegó cada cliente y poder ver el desglose en el dashboard.
--
-- Columna nullable sin default: aditiva, no requiere backfill de clientes
-- existentes (quedan como "sin especificar").

alter table clients add column if not exists referral_source text;
