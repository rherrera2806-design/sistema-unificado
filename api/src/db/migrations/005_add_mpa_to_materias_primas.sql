-- Migration: Agregar campo MPA (Merma Promedio de Aprovechamiento) a materias_primas
ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS mpa NUMERIC(5,2) DEFAULT 0;
-- Corregir precision si fue creado con 1 decimal
ALTER TABLE materias_primas ALTER COLUMN mpa TYPE NUMERIC(5,2);
