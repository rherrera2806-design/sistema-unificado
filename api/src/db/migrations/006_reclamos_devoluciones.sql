-- ═══════════════════════════════════════════════════════
-- VitroFlow - Módulo Reclamos y Devoluciones
-- ═══════════════════════════════════════════════════════

-- Tabla auxiliar: Matriz de Responsables y Motivos
CREATE TABLE IF NOT EXISTS matriz_responsables_motivos (
    id SERIAL PRIMARY KEY,
    responsable VARCHAR(100) NOT NULL,
    motivo VARCHAR(200) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_resp_motivo_unique
    ON matriz_responsables_motivos(responsable, motivo) WHERE activo = TRUE;

-- Tabla principal: Reclamos y Devoluciones
CREATE TABLE IF NOT EXISTS reclamos_devoluciones (
    id SERIAL PRIMARY KEY,
    numero_reclamo SERIAL,

    -- Datos de ingreso
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    responsable_ingreso VARCHAR(200) DEFAULT '',

    -- Datos del cliente/orden
    cliente VARCHAR(200) DEFAULT '',
    numero_orden VARCHAR(50) DEFAULT '',

    -- Items del reclamo (JSONB array)
    -- Cada item: { item, codigo, descripcion, ancho, alto, espesor, m2, kg, valor_unitario }
    items JSONB DEFAULT '[]',

    -- Descripción general (resumen de items)
    descripcion TEXT DEFAULT '',

    -- Detalle del reclamo
    detalle_reclamo TEXT DEFAULT '',
    fotos JSONB DEFAULT '[]',

    -- Estado
    estado VARCHAR(30) DEFAULT 'PENDIENTE',

    -- Campos de calidad/resolución
    responsable_falla VARCHAR(100) DEFAULT '',
    motivo VARCHAR(200) DEFAULT '',
    observacion_analisis TEXT DEFAULT '',
    resolucion VARCHAR(50) DEFAULT '',

    -- Metadatos
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON reclamos_devoluciones(estado);
CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON reclamos_devoluciones(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos_devoluciones(cliente);
CREATE INDEX IF NOT EXISTS idx_reclamos_numero ON reclamos_devoluciones(numero_reclamo);

-- Datos iniciales: Responsables y Motivos
INSERT INTO matriz_responsables_motivos (responsable, motivo) VALUES
    ('CORTE', 'MAL CORTADO'),
    ('CORTE', 'DIMENSION INCORRECTA'),
    ('CORTE', 'ESQUINA ROTA'),
    ('PULIDO', 'MAL PULIDO'),
    ('PULIDO', 'ESCALLA'),
    ('PULIDO', 'RAYA'),
    ('PULIDO', 'BORDE IRREGULAR'),
    ('TEMPLE', 'ROTO EN TEMPLE'),
    ('TEMPLE', 'DEFORME'),
    ('TEMPLE', 'TENSION INCORRECTA'),
    ('LAMINADO', 'BURBUJA'),
    ('LAMINADO', 'DELAMINACION'),
    ('LAMINADO', 'MAL ALINEADO'),
    ('TRANSPORTE', 'GOLPE EN TRANSPORTE'),
    ('TRANSPORTE', 'RAYA EN TRANSPORTE'),
    ('TRANSPORTE', 'ROTO EN TRANSPORTE'),
    ('INSTALACION', 'MAL INSTALADO'),
    ('INSTALACION', 'DAÑO EN OBRA'),
    ('CLIENTE', 'ERROR DE MEDIDA CLIENTE'),
    ('CLIENTE', 'NO CONFORME CLIENTE'),
    ('PRODUCCION', 'DEFECTO DE FABRICACION'),
    ('PRODUCCION', 'MATERIAL DEFECTUOSO')
ON CONFLICT DO NOTHING;
