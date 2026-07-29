-- Add JSONB column for type-specific structured metadata (Issue #112)
-- Items legacy (incluyendo todos los existentes) tienen NULL = comportamiento
-- anterior (renderizan versión genérica sin campos específicos de tipo).
ALTER TABLE items ADD COLUMN item_metadata JSONB DEFAULT NULL;
