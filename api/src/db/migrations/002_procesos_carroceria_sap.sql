-- ═══════════════════════════════════════════════════════
-- Migration 002: Tabla liviana para enrutamiento de Carroceros
-- ═══════════════════════════════════════════════════════
-- Permite mapear codigo_sap -> lista ordenada de estaciones
-- Bypasea la lógica de familia + banderas 0/1 para códigos
-- específicos de la familia "Carroceros".

CREATE TABLE IF NOT EXISTS procesos_carroceria_sap (
    id SERIAL PRIMARY KEY,
    codigo_sap VARCHAR(50) UNIQUE NOT NULL,
    estaciones_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_procesos_carroceria_sap_codigo
    ON procesos_carroceria_sap(codigo_sap);

COMMENT ON TABLE procesos_carroceria_sap IS
    'Mapeo liviano codigo_sap -> [estacion_ids] para familia Carroceros';
COMMENT ON COLUMN procesos_carroceria_sap.estaciones_json IS
    'Array JSON con los IDs de estaciones en orden de secuencia, ej: [1,2,3,4,6,7]';
