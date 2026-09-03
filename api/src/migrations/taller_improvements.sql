-- =====================================================
-- MIGRACIÓN: Mejoras al Módulo Taller
-- Fecha: 2026-09-03
-- Descripción: Agrega inspecciones de calidad, 
--              control de operario, y métricas
-- =====================================================

-- 1. Agregar campos de operario y tiempo a cola_produccion_pasos
ALTER TABLE cola_produccion_pasos 
ADD COLUMN IF NOT EXISTS operario_email VARCHAR(200),
ADD COLUMN IF NOT EXISTS operario_nombre VARCHAR(200),
ADD COLUMN IF NOT EXISTS pausado_en TIMESTAMP,
ADD COLUMN IF NOT EXISTS tiempo_pausado_segundos INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_by VARCHAR(200),
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP;

-- 2. Crear tabla de inspecciones de calidad
CREATE TABLE IF NOT EXISTS inspecciones_calidad (
    id SERIAL PRIMARY KEY,
    paso_id INTEGER REFERENCES cola_produccion_pasos(id) ON DELETE CASCADE,
    orden_produccion_id INTEGER REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
    estacion_id INTEGER REFERENCES estaciones_maestras(id),
    tipo_inspeccion VARCHAR(50) NOT NULL CHECK (tipo_inspeccion IN ('incoming', 'proceso', 'final', 'aleatoria')),
    resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('aprobado', 'rechazado', 'condicional')),
    defectos JSONB DEFAULT '[]',
    -- Formato: [{"tipo": "rayon", "cantidad": 2, "severidad": "menor", "ubicacion": "esquina sup izq"}]
    cantidad_inspeccionada INTEGER DEFAULT 0,
    cantidad_defectuosa INTEGER DEFAULT 0,
    inspector_email VARCHAR(200) NOT NULL,
    inspector_nombre VARCHAR(200),
    observaciones TEXT,
    imagenes JSONB DEFAULT '[]',
    -- URLs de fotos de evidencia
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Crear tabla de historial de cambios (audit trail)
CREATE TABLE IF NOT EXISTS taller_historial (
    id SERIAL PRIMARY KEY,
    entidad_tipo VARCHAR(50) NOT NULL, -- 'paso', 'orden', 'merma', 'inspeccion'
    entidad_id INTEGER NOT NULL,
    accion VARCHAR(50) NOT NULL, -- 'iniciar', 'finalizar', 'pausar', 'reanudar', 'merma', 'inspeccion'
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_email VARCHAR(200),
    usuario_nombre VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Crear tabla de tipos de defectos (catálogo)
CREATE TABLE IF NOT EXISTS tipos_defecto (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    categoria VARCHAR(50), -- 'cosmetico', 'estructural', 'dimensional', 'funcional'
    severidad_default VARCHAR(20) DEFAULT 'menor' CHECK (severidad_default IN ('menor', 'mayor', 'critico')),
    requiere_foto BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Crear tabla de turnos de taller
CREATE TABLE IF NOT EXISTS taller_turnos (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('mañana', 'tarde', 'noche')),
    operario_email VARCHAR(200) NOT NULL,
    operario_nombre VARCHAR(200),
    estacion_id INTEGER REFERENCES estaciones_maestras(id),
    hora_inicio TIMESTAMP,
    hora_fin TIMESTAMP,
    ordenes_completadas INTEGER DEFAULT 0,
    m2_producidos DECIMAL(10,2) DEFAULT 0,
    mermas_generadas INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 6. Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_inspecciones_paso ON inspecciones_calidad(paso_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_orden ON inspecciones_calidad(orden_produccion_id);
CREATE INDEX IF NOT EXISTS idx_inspecciones_fecha ON inspecciones_calidad(created_at);
CREATE INDEX IF NOT EXISTS idx_inspecciones_resultado ON inspecciones_calidad(resultado);
CREATE INDEX IF NOT EXISTS idx_historial_entidad ON taller_historial(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_historial_fecha ON taller_historial(created_at);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON taller_turnos(fecha, turno);
CREATE INDEX IF NOT EXISTS idx_pasos_operario ON cola_produccion_pasos(operario_email);
CREATE INDEX IF NOT EXISTS idx_pasos_locked ON cola_produccion_pasos(locked_by, locked_at);

-- 7. Insertar tipos de defectos comunes en vidriería
INSERT INTO tipos_defecto (codigo, nombre, categoria, severidad_default, requiere_foto) VALUES
    ('RAY', 'Rayón', 'cosmetico', 'menor', false),
    ('BUR', 'Burbuja', 'cosmetico', 'menor', true),
    ('RAJ', 'Rajadura', 'estructural', 'critico', true),
    ('QUE', 'Quiebre', 'estructural', 'critico', true),
    ('DIM', 'Fuera de dimensión', 'dimensional', 'mayor', false),
    ('DES', 'Desalineación', 'dimensional', 'mayor', false),
    ('PIN', 'Defecto de pintado', 'cosmetico', 'menor', true),
    ('PER', 'Perforación incorrecta', 'dimensional', 'mayor', false),
    ('TEM', 'Defecto de templado', 'estructural', 'critico', true),
    ('LAM', 'Defecto de laminado', 'estructural', 'critico', true),
    ('SUC', 'Suciedad/Contaminación', 'cosmetico', 'menor', false),
    ('BOR', 'Borde irregular', 'cosmetico', 'menor', true)
ON CONFLICT (codigo) DO NOTHING;

-- 8. Crear vista para métricas OEE
CREATE OR REPLACE VIEW vista_oee_taller AS WITH 
    tiempo_planificado AS (
        SELECT 
            estacion_id,
            DATE(hora_inicio) as fecha,
            SUM(EXTRACT(EPOCH FROM (COALESCE(hora_fin, NOW()) - hora_inicio))) as segundos_planificados
        FROM cola_produccion_pasos
        WHERE hora_inicio IS NOT NULL
        GROUP BY estacion_id, DATE(hora_inicio)
    ),
    tiempo_operacion AS (
        SELECT 
            estacion_id,
            DATE(hora_inicio) as fecha,
            SUM(EXTRACT(EPOCH FROM (COALESCE(hora_fin, NOW()) - hora_inicio)) - COALESCE(tiempo_pausado_segundos, 0)) as segundos_operacion
        FROM cola_produccion_pasos
        WHERE hora_inicio IS NOT NULL AND estado = 'TERMINADO'
        GROUP BY estacion_id, DATE(hora_inicio)
    ),
    produccion AS (
        SELECT 
            cp.estacion_id,
            DATE(cp.hora_fin) as fecha,
            COUNT(*) as total_producido,
            SUM(CASE WHEN cp.estado = 'TERMINADO' THEN 1 ELSE 0 END) as terminados
        FROM cola_produccion_pasos cp
        WHERE cp.hora_fin IS NOT NULL
        GROUP BY cp.estacion_id, DATE(cp.hora_fin)
    ),
    calidad AS (
        SELECT 
            ic.estacion_id,
            DATE(ic.created_at) as fecha,
            COUNT(*) as total_inspecciones,
            SUM(CASE WHEN ic.resultado = 'aprobado' THEN 1 ELSE 0 END) as aprobados
        FROM inspecciones_calidad ic
        GROUP BY ic.estacion_id, DATE(ic.created_at)
    )
SELECT 
    em.id as estacion_id,
    em.nombre_estacion,
    COALESCE(tp.fecha, to.fecha) as fecha,
    -- Disponibilidad
    CASE 
        WHEN COALESCE(tp.segundos_planificados, 0) > 0 
        THEN ROUND((COALESCE(to.segundos_operacion, 0) / tp.segundos_planificados * 100)::numeric, 2)
        ELSE 0 
    END as disponibilidad,
    -- Rendimiento
    CASE 
        WHEN COALESCE(to.segundos_operacion, 0) > 0 
        THEN ROUND((COALESCE(p.total_producido, 0) * 60 / (to.segundos_operacion / 60))::numeric, 2)
        ELSE 0 
    END as rendimiento,
    -- Calidad
    CASE 
        WHEN COALESCE(c.total_inspecciones, 0) > 0 
        THEN ROUND((c.aprobados::numeric / c.total_inspecciones * 100), 2)
        ELSE 100 
    END as calidad,
    -- OEE
    CASE 
        WHEN COALESCE(tp.segundos_planificados, 0) > 0 AND COALESCE(c.total_inspecciones, 0) > 0
        THEN ROUND(
            (COALESCE(to.segundos_operacion, 0) / tp.segundos_planificados * 100) *
            (COALESCE(p.total_producido, 0) * 60 / (to.segundos_operacion / 60)) *
            (c.aprobados::numeric / c.total_inspecciones * 100) / 10000
        ::numeric, 2)
        ELSE 0 
    END as oee
FROM estaciones_maestras em
LEFT JOIN tiempo_planificado tp ON em.id = tp.estacion_id
LEFT JOIN tiempo_operacion to2 ON em.id = to2.estacion_id AND tp.fecha = to2.fecha
LEFT JOIN produccion p ON em.id = p.estacion_id AND tp.fecha = p.fecha
LEFT JOIN calidad c ON em.id = c.estacion_id AND tp.fecha = c.fecha
WHERE em.activa = true;

-- 9. Crear vista para lead time
CREATE OR REPLACE VIEW vista_lead_time AS
SELECT 
    o.id as orden_id,
    o.pedido_sap_id,
    o.codigo_producto,
    o.cliente,
    o.cantidad,
    o.estado_programacion,
    MIN(cp.hora_inicio) as primera_actividad,
    MAX(cp.hora_fin) as ultima_actividad,
    EXTRACT(EPOCH FROM (MAX(cp.hora_fin) - MIN(cp.hora_inicio))) / 3600 as lead_time_horas,
    COUNT(cp.id) as total_pasos,
    SUM(CASE WHEN cp.estado = 'TERMINADO' THEN 1 ELSE 0 END) as pasos_terminados
FROM produccion_ordenes o
JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
WHERE cp.hora_inicio IS NOT NULL
GROUP BY o.id, o.pedido_sap_id, o.codigo_producto, o.cliente, o.cantidad, o.estado_programacion;

-- 10. Crear vista para tasa de merma
CREATE OR REPLACE VIEW vista_tasa_merma AS
SELECT 
    DATE(m.created_at) as fecha,
    e.nombre_estacion,
    m.causa,
    COUNT(*) as total_mermas,
    SUM(m.cantidad) as unidades_mermadas,
    SUM(m.m2_mermados) as m2_mermados,
    SUM(m.costo_materia_prima) as costo_total_mermas
FROM mermas m
LEFT JOIN estaciones_maestras e ON m.estacion_id = e.id
GROUP BY DATE(m.created_at), e.nombre_estacion, m.causa;
