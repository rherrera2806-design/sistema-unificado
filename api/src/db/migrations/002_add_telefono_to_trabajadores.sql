-- Migration: Agregar telefono y puesto a trabajadores
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS telefono VARCHAR(20);
ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS puesto VARCHAR(100);
