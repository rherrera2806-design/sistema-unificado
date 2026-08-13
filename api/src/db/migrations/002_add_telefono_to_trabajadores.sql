-- Migration: Agregar telefono y puesto a trabajadores
-- Ejecutar este script en la base de datos para agregar las columnas

DO $$
BEGIN
    -- Agregar columna telefono si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trabajadores' AND column_name = 'telefono') THEN
        ALTER TABLE trabajadores ADD COLUMN telefono VARCHAR(20);
    END IF;
    
    -- Agregar columna puesto si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trabajadores' AND column_name = 'puesto') THEN
        ALTER TABLE trabajadores ADD COLUMN puesto VARCHAR(100);
    END IF;
END $$;
