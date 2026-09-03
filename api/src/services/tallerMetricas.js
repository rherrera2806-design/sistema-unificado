const { query } = require('../config/database');

/**
 * Service para métricas y KPIs del módulo Taller.
 * Calcula OEE, Lead Time, Tasa de Merma, y métricas operativas.
 */

/**
 * Obtiene métricas generales del taller para una fecha.
 */
const getMetricasGenerales = async (fecha) => {
    const result = await query(`
        SELECT 
            -- Órdenes
            (SELECT COUNT(DISTINCT o.id) FROM produccion_ordenes o 
             JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
             WHERE cp.fecha_programada = $1) as ordenes_programadas,
            
            (SELECT COUNT(DISTINCT o.id) FROM produccion_ordenes o
             JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
             WHERE cp.estado = 'EN_PROCESO') as ordenes_en_proceso,
            
            (SELECT COUNT(DISTINCT o.id) FROM produccion_ordenes o
             JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
             WHERE cp.estado = 'TERMINADO' AND cp.hora_fin::date = $1) as ordenes_completadas_hoy,
            
            -- Pasos
            (SELECT COUNT(*) FROM cola_produccion_pasos WHERE estado = 'PENDIENTE') as pasos_pendientes,
            (SELECT COUNT(*) FROM cola_produccion_pasos WHERE estado = 'EN_PROCESO') as pasos_en_proceso,
            (SELECT COUNT(*) FROM cola_produccion_pasos WHERE estado = 'TERMINADO' AND hora_fin::date = $1) as pasos_terminados_hoy,
            
            -- Producción
            (SELECT COALESCE(SUM(o.metros_cuadrados), 0) FROM produccion_ordenes o
             JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
             WHERE cp.estado = 'TERMINADO' AND cp.hora_fin::date = $1) as m2_producidos_hoy,
            
            (SELECT COALESCE(SUM(o.kilos), 0) FROM produccion_ordenes o
             JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
             WHERE cp.estado = 'TERMINADO' AND cp.hora_fin::date = $1) as kilos_producidos_hoy,
            
            -- Mermas
            (SELECT COUNT(*) FROM mermas WHERE created_at::date = $1) as mermas_hoy,
            (SELECT COALESCE(SUM(cantidad), 0) FROM mermas WHERE created_at::date = $1) as unidades_mermadas_hoy,
            (SELECT COALESCE(SUM(m2_mermados), 0) FROM mermas WHERE created_at::date = $1) as m2_mermados_hoy,
            (SELECT COALESCE(SUM(costo_materia_prima), 0) FROM mermas WHERE created_at::date = $1) as costo_mermas_hoy
    `, [fecha]);
    return result.rows[0];
};

/**
 * Calcula OEE (Overall Equipment Effectiveness) por estación.
 */
const getOEEPorEstacion = async (fechaInicio, fechaFin) => {
    const result = await query(`
        WITH tiempo_planificado AS (
            SELECT 
                cp.estacion_id,
                DATE(cp.hora_inicio) as fecha,
                SUM(EXTRACT(EPOCH FROM (COALESCE(cp.hora_fin, NOW()) - cp.hora_inicio))) as segundos_planificados
            FROM cola_produccion_pasos cp
            WHERE cp.hora_inicio IS NOT NULL
              AND cp.hora_inicio::date BETWEEN $1 AND $2
            GROUP BY cp.estacion_id, DATE(cp.hora_inicio)
        ),
        tiempo_operacion AS (
            SELECT 
                cp.estacion_id,
                DATE(cp.hora_inicio) as fecha,
                SUM(EXTRACT(EPOCH FROM (COALESCE(cp.hora_fin, NOW()) - cp.hora_inicio)) - COALESCE(cp.tiempo_pausado_segundos, 0)) as segundos_operacion
            FROM cola_produccion_pasos cp
            WHERE cp.hora_inicio IS NOT NULL 
              AND cp.estado = 'TERMINADO'
              AND cp.hora_inicio::date BETWEEN $1 AND $2
            GROUP BY cp.estacion_id, DATE(cp.hora_inicio)
        ),
        produccion AS (
            SELECT 
                cp.estacion_id,
                DATE(cp.hora_fin) as fecha,
                COUNT(*) as total_pasos,
                SUM(COALESCE(o.metros_cuadrados, 0)) as total_m2
            FROM cola_produccion_pasos cp
            JOIN produccion_ordenes o ON cp.orden_produccion_id = o.id
            WHERE cp.hora_fin IS NOT NULL
              AND cp.hora_fin::date BETWEEN $1 AND $2
            GROUP BY cp.estacion_id, DATE(cp.hora_fin)
        ),
        calidad AS (
            SELECT 
                ic.estacion_id,
                DATE(ic.created_at) as fecha,
                COUNT(*) as total_inspecciones,
                SUM(CASE WHEN ic.resultado = 'aprobado' THEN 1 ELSE 0 END) as aprobados
            FROM inspecciones_calidad ic
            WHERE ic.created_at::date BETWEEN $1 AND $2
            GROUP BY ic.estacion_id, DATE(ic.created_at)
        )
        SELECT 
            em.id as estacion_id,
            em.nombre_estacion,
            COALESCE(ROUND(AVG(
                CASE WHEN tp.segundos_planificados > 0 
                THEN (to2.segundos_operacion / tp.segundos_planificados * 100)
                ELSE NULL END
            )::numeric, 2), 0) as disponibilidad_promedio,
            COALESCE(ROUND(AVG(
                CASE WHEN to2.segundos_operacion > 0 
                THEN (p.total_pasos * 3600 / to2.segundos_operacion)
                ELSE NULL END
            )::numeric, 2), 0) as rendimiento_promedio,
            COALESCE(ROUND(AVG(
                CASE WHEN c.total_inspecciones > 0 
                THEN (c.aprobados::numeric / c.total_inspecciones * 100)
                ELSE 100 END
            )::numeric, 2), 100) as calidad_promedio,
            COALESCE(ROUND(AVG(
                CASE WHEN tp.segundos_planificados > 0 AND c.total_inspecciones > 0
                THEN (to2.segundos_operacion / tp.segundos_planificados * 100) *
                     (p.total_pasos * 3600 / to2.segundos_operacion) *
                     (c.aprobados::numeric / c.total_inspecciones * 100) / 10000
                ELSE NULL END
            )::numeric, 2), 0) as oee_promedio
        FROM estaciones_maestras em
        LEFT JOIN tiempo_planificado tp ON em.id = tp.estacion_id
        LEFT JOIN tiempo_operacion to2 ON em.id = to2.estacion_id AND tp.fecha = to2.fecha
        LEFT JOIN produccion p ON em.id = p.estacion_id AND tp.fecha = p.fecha
        LEFT JOIN calidad c ON em.id = c.estacion_id AND tp.fecha = c.fecha
        WHERE em.activa = true
        GROUP BY em.id, em.nombre_estacion
        ORDER BY em.orden_secuencia_defecto
    `, [fechaInicio, fechaFin]);
    return result.rows;
};

/**
 * Obtiene lead time promedio por producto/familia.
 */
const getLeadTimePromedio = async (fechaInicio, fechaFin) => {
    const result = await query(`
        SELECT 
            o.codigo_producto,
            o.descripcion,
            fp.nombre_familia,
            COUNT(DISTINCT o.id) as total_ordenes,
            ROUND(AVG(EXTRACT(EPOCH FROM (MAX(cp.hora_fin) - MIN(cp.hora_inicio))) / 3600)::numeric, 2) as lead_time_promedio_horas,
            ROUND(MIN(EXTRACT(EPOCH FROM (MAX(cp.hora_fin) - MIN(cp.hora_inicio))) / 3600)::numeric, 2) as lead_time_minimo_horas,
            ROUND(MAX(EXTRACT(EPOCH FROM (MAX(cp.hora_fin) - MIN(cp.hora_inicio))) / 3600)::numeric, 2) as lead_time_maximo_horas
        FROM produccion_ordenes o
        JOIN cola_produccion_pasos cp ON o.id = cp.orden_produccion_id
        LEFT JOIN familias_producto fp ON o.familia_id = fp.id
        WHERE cp.hora_inicio IS NOT NULL 
          AND cp.hora_fin IS NOT NULL
          AND cp.hora_fin::date BETWEEN $1 AND $2
        GROUP BY o.codigo_producto, o.descripcion, fp.nombre_familia
        HAVING COUNT(DISTINCT o.id) >= 3
        ORDER BY lead_time_promedio_horas DESC
        LIMIT 20
    `, [fechaInicio, fechaFin]);
    return result.rows;
};

/**
 * Obtiene tasa de merma por estación y causa.
 */
const getTasaMerma = async (fechaInicio, fechaFin) => {
    const result = await query(`
        SELECT 
            em.nombre_estacion,
            m.causa,
            COUNT(*) as total_mermas,
            SUM(m.cantidad) as unidades_mermadas,
            SUM(m.m2_mermados) as m2_mermados,
            SUM(m.costo_materia_prima) as costo_total,
            ROUND(
                SUM(m.cantidad)::numeric / 
                NULLIF((SELECT SUM(cantidad) FROM produccion_ordenes WHERE estado_programacion != 'CERRADA'), 0) * 100, 
            2) as tasa_merma_porcentaje
        FROM mermas m
        LEFT JOIN estaciones_maestras em ON m.estacion_id = em.id
        WHERE m.created_at::date BETWEEN $1 AND $2
        GROUP BY em.nombre_estacion, m.causa
        ORDER BY total_mermas DESC
    `, [fechaInicio, fechaFin]);
    return result.rows;
};

/**
 * Obtiene rendimiento por operario.
 */
const getRendimientoOperario = async (fechaInicio, fechaFin) => {
    const result = await query(`
        SELECT 
            cp.operario_email,
            cp.operario_nombre,
            COUNT(*) as pasos_completados,
            SUM(EXTRACT(EPOCH FROM (cp.hora_fin - cp.hora_inicio)) / 3600) as horas_trabajadas,
            SUM(COALESCE(o.metros_cuadrados, 0)) as m2_producidos,
            SUM(COALESCE(o.cantidad, 0)) as unidades_producidas,
            ROUND(
                SUM(COALESCE(o.metros_cuadrados, 0)) / 
                NULLIF(SUM(EXTRACT(EPOCH FROM (cp.hora_fin - cp.hora_inicio)) / 3600), 0), 
            2) as m2_por_hora
        FROM cola_produccion_pasos cp
        JOIN produccion_ordenes o ON cp.orden_produccion_id = o.id
        WHERE cp.estado = 'TERMINADO'
          AND cp.hora_fin::date BETWEEN $1 AND $2
          AND cp.operario_email IS NOT NULL
        GROUP BY cp.operario_email, cp.operario_nombre
        ORDER BY m2_producidos DESC
    `, [fechaInicio, fechaFin]);
    return result.rows;
};

/**
 * Obtiene métricas de calidad (inspecciones).
 */
const getMetricasCalidad = async (fechaInicio, fechaFin) => {
    const result = await query(`
        SELECT 
            COUNT(*) as total_inspecciones,
            SUM(CASE WHEN resultado = 'aprobado' THEN 1 ELSE 0 END) as aprobados,
            SUM(CASE WHEN resultado = 'rechazado' THEN 1 ELSE 0 END) as rechazados,
            SUM(CASE WHEN resultado = 'condicional' THEN 1 ELSE 0 END) as condicionales,
            SUM(cantidad_inspeccionada) as unidades_inspeccionadas,
            SUM(cantidad_defectuosa) as unidades_defectuosas,
            ROUND(
                SUM(CASE WHEN resultado = 'aprobado' THEN 1 ELSE 0 END)::numeric / 
                NULLIF(COUNT(*), 0) * 100, 2
            ) as tasa_aprobacion,
            ROUND(
                SUM(cantidad_defectuosa)::numeric / 
                NULLIF(SUM(cantidad_inspeccionada), 0) * 100, 2
            ) as tasa_defectos
        FROM inspecciones_calidad
        WHERE created_at::date BETWEEN $1 AND $2
    `, [fechaInicio, fechaFin]);
    return result.rows[0];
};

/**
 * Obtiene defectos más frecuentes.
 */
const getDefectosFrecuentes = async (fechaInicio, fechaFin, limite = 10) => {
    const result = await query(`
        SELECT 
            defecto->>'tipo' as tipo_defecto,
            COUNT(*) as frecuencia,
            SUM((defecto->>'cantidad')::int) as total_unidades
        FROM inspecciones_calidad,
             jsonb_array_elements(defectos) as defecto
        WHERE created_at::date BETWEEN $1 AND $2
        GROUP BY defecto->>'tipo'
        ORDER BY frecuencia DESC
        LIMIT $3
    `, [fechaInicio, fechaFin, limite]);
    return result.rows;
};

/**
 * Obtiene historial de cambios de una entidad.
 */
const getHistorial = async (entidadTipo, entidadId) => {
    const result = await query(`
        SELECT * FROM taller_historial 
        WHERE entidad_tipo = $1 AND entidad_id = $2 
        ORDER BY created_at DESC
    `, [entidadTipo, entidadId]);
    return result.rows;
};

module.exports = {
    getMetricasGenerales,
    getOEEPorEstacion,
    getLeadTimePromedio,
    getTasaMerma,
    getRendimientoOperario,
    getMetricasCalidad,
    getDefectosFrecuentes,
    getHistorial
};
