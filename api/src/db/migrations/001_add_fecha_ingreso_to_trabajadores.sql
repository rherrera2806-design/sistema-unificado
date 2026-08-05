-- ═══════════════════════════════════════════════════════
-- Migration: Agregar fecha_ingreso a trabajadores
-- ═══════════════════════════════════════════════════════

ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS fecha_ingreso DATE;

-- Backfill: usar created_at como fecha_ingreso para los trabajadores existentes
UPDATE trabajadores
SET fecha_ingreso = DATE(created_at)
WHERE fecha_ingreso IS NULL;

-- Default para nuevos: el día que se crea
ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET DEFAULT CURRENT_DATE;

-- Ya no debería ser null nunca
ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET NOT NULL;
