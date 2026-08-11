-- Migración: Tabla de parámetros de costos para el módulo de Costeo
-- Ejecutar una vez para crear la tabla con valores por defecto en 0

CREATE TABLE IF NOT EXISTS costos_config (
    id SERIAL PRIMARY KEY,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor DECIMAL(12,2) DEFAULT 0,
    descripcion TEXT,
    unidad VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar parámetros con valores en 0 (configurables después)
INSERT INTO costos_config (clave, valor, descripcion, unidad) VALUES
    ('costo_hh', 0, 'Costo hora-hombre por m²', '$/m²'),
    ('costo_energia_m2', 0, 'Costo energía por m²', '$/m²'),
    ('costo_pulido_ml', 0, 'Costo pulido por metro lineal', '$/ml'),
    ('costo_perforacion', 0, 'Costo por perforación', '$/ud'),
    ('costo_destaje_kg', 0, 'Costo destaje normal por kg', '$/kg'),
    ('costo_destaje_complejo_kg', 0, 'Costo destaje complejo por kg', '$/kg'),
    ('costo_pintura_ml', 0, 'Costo pintura por ml', '$/ml'),
    ('costo_insumos_pintura', 0, 'Costos insumos de pintura por m²', '$/m²'),
    ('merma_proceso_pct', 0, 'Porcentaje merma de proceso', '%'),
    ('merma_aprovechamiento_pct', 0, 'Porcentaje merma de aprovechamiento', '%')
ON CONFLICT (clave) DO NOTHING;
