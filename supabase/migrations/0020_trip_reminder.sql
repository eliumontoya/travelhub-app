-- Recordatorio automático por email antes del viaje (issue #49, opcional).
-- Columna aditiva: marca cuándo se envió el recordatorio para no reenviarlo
-- en cada corrida del cron. NULL = pendiente de envío.
alter table trips add column if not exists reminder_sent_at timestamptz;
