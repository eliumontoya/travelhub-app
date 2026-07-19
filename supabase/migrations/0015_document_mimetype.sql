-- Guarda el mimetype del archivo subido para poder distinguir imágenes/PDFs
-- en la UI (issue #33) sin depender de la extensión del nombre de archivo.
--
-- Additive: nullable, sin backfill. Los documentos existentes quedan con
-- mime_type = null y la UI cae al enlace de descarga plano para esos casos.

alter table documents add column if not exists mime_type text;
