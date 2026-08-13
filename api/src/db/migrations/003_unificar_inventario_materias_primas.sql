-- Migration: Unificar inventario con materias primas
-- Fase 1: Agregar FK y mapear datos existentes

-- 1. Agregar columna materia_prima_id a movimientos
ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS materia_prima_id INTEGER REFERENCES materias_primas(id);

-- 2. Mapear datos existentes: tipo_cristal + espesor -> materia_prima_id
UPDATE movimientos m 
SET materia_prima_id = mp.id 
FROM materias_primas mp 
WHERE LOWER(TRIM(m.tipo_cristal)) = LOWER(TRIM(mp.nombre))
  AND m.espesor = mp.espesor_mm::integer
  AND m.materia_prima_id IS NULL;

-- 3. Agregar indice para mejorar performance de joins
CREATE INDEX IF NOT EXISTS idx_movimientos_materia_prima ON movimientos(materia_prima_id);

-- 4. Agregar columnas de stock_critico y consumo a materias_primas si no existen
ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0;
ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0;
