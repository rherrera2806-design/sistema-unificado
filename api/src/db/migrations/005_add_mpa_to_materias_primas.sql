-- Migration: Agregar campo MPA (Merma Promedio de Aprovechamiento) a materias_primas
ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS mpa NUMERIC(5,1) DEFAULT 0;