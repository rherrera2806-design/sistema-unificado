-- ═══════════════════════════════════════════════════════
-- Migration 004: Unificar enrutamiento Carroceros en recetas_bom
--              (Modelo Híbrido Unificado)
-- ═══════════════════════════════════════════════════════
-- Agrega procesos_especificos_json (JSONB) y familia_id (FK) a
-- recetas_bom. Esto consolida la logica de enrutamiento custom
-- (antes en tabla separada procesos_carroceria_sap) dentro de
-- la tabla maestra de recetas.

-- 1. Nueva columna: procesos_especificos_json
ALTER TABLE recetas_bom
    ADD COLUMN IF NOT EXISTS procesos_especificos_json JSONB DEFAULT NULL;

-- 2. Nueva columna: familia_id (FK a familias_producto)
ALTER TABLE recetas_bom
    ADD COLUMN IF NOT EXISTS familia_id INTEGER DEFAULT NULL;

-- 3. Crear FK si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'recetas_bom_familia_id_fkey'
          AND table_name = 'recetas_bom'
    ) THEN
        ALTER TABLE recetas_bom
            ADD CONSTRAINT recetas_bom_familia_id_fkey
            FOREIGN KEY (familia_id) REFERENCES familias_producto(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Migrar datos desde procesos_carroceria_sap a recetas_bom
--    (los codigos_sap que ya tenian ruta custom)
DO $$
DECLARE
    receta_record RECORD;
    codigo_record RECORD;
    target_id INTEGER;
    procesos_json JSONB;
    descripcion_receta TEXT;
BEGIN
    -- Para cada codigo en procesos_carroceria_sap, encontrar la receta
    -- con materia_prima_id y copiar la ruta especifica.
    -- Si hay varias recetas para el mismo codigo, se copia a todas.
    FOR codigo_record IN
        SELECT codigo_sap, estaciones_json, descripcion
        FROM procesos_carroceria_sap
        WHERE estaciones_json IS NOT NULL
    LOOP
        procesos_json := codigo_record.estaciones_json::jsonb;
        descripcion_receta := codigo_record.descripcion;

        -- Actualizar todas las recetas que coincidan con este codigo_sap_padre
        UPDATE recetas_bom
        SET procesos_especificos_json = procesos_json
        WHERE codigo_sap_padre = codigo_record.codigo_sap
          AND (procesos_especificos_json IS NULL OR procesos_especificos_json = '[]'::jsonb);

        -- Si el codigo NO existe en recetas_bom pero SI en procesos_carroceria_sap,
        -- crear un registro placeholder con materia_prima_id null no permitido
        -- (la tabla requiere materia_prima_id NOT NULL). En ese caso, no se migra.
    END LOOP;
END $$;

-- 5. Indice sobre codigo_sap_padre para acelerar la busqueda del importador
CREATE INDEX IF NOT EXISTS idx_recetas_bom_codigo_sap_padre
    ON recetas_bom(codigo_sap_padre);

-- 6. Indice sobre familia_id (para fallback por familia)
CREATE INDEX IF NOT EXISTS idx_recetas_bom_familia_id
    ON recetas_bom(familia_id);

-- Comentarios
COMMENT ON COLUMN recetas_bom.procesos_especificos_json IS
    'Ruta fija de estaciones para productos estandarizados (ej Carroceros). NULL = usar familia_id como fallback.';
COMMENT ON COLUMN recetas_bom.familia_id IS
    'Familia del producto. Usado como fallback cuando procesos_especificos_json es NULL.';
