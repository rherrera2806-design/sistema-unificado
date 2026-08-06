-- ═══════════════════════════════════════════════════════
-- Migration 003: Ampliar catalogo procesos_carroceria_sap
--              con medidas estandar (ancho, alto) y descripcion
-- ═══════════════════════════════════════════════════════
-- Esquema final (5 campos clave):
--   1. codigo_sap        -- PK unico
--   2. descripcion       -- texto
--   3. ancho            -- decimal (mm)
--   4. alto             -- decimal (mm)
--   5. estaciones_json  -- array JSON con orden de procesos

ALTER TABLE procesos_carroceria_sap
    ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL;

ALTER TABLE procesos_carroceria_sap
    ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL;

COMMENT ON COLUMN procesos_carroceria_sap.ancho IS
    'Ancho estandar en milimetros. Usado como fallback si el Excel de pedidos no lo especifica.';
COMMENT ON COLUMN procesos_carroceria_sap.alto IS
    'Alto estandar en milimetros. Usado como fallback si el Excel de pedidos no lo especifica.';
