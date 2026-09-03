const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');

/**
 * Service para gestión de inspecciones de calidad en taller.
 * Implementa puntos de control: incoming, proceso, final, aleatoria.
 */

/**
 * Crea una nueva inspección de calidad.
 */
const crearInspeccion = async ({ paso_id, orden_produccion_id, estacion_id, tipo_inspeccion, resultado, defectos, cantidad_inspeccionada, cantidad_defectuosa, inspector_email, inspector_nombre, observaciones, imagenes }) => {
    return await transaction(async ({ query: txQuery }) => {
        const result = await txQuery(
            `INSERT INTO inspecciones_calidad 
             (paso_id, orden_produccion_id, estacion_id, tipo_inspeccion, resultado, defectos, cantidad_inspeccionada, cantidad_defectuosa, inspector_email, inspector_nombre, observaciones, imagenes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             RETURNING *`,
            [paso_id, orden_produccion_id, estacion_id, tipo_inspeccion, resultado, 
             JSON.stringify(defectos || []), cantidad_inspeccionada || 0, cantidad_defectuosa || 0,
             inspector_email, inspector_nombre, observaciones, JSON.stringify(imagenes || [])]
        );

        await txQuery(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('inspeccion', $1, 'crear', $2, $3, $4)`,
            [result.rows[0].id, JSON.stringify(result.rows[0]), inspector_email, inspector_nombre]
        );

        return result.rows[0];
    });
};

/**
 * Obtiene inspecciones por orden de producción.
 */
const getInspeccionesPorOrden = async (ordenId) => {
    const result = await query(
        `SELECT ic.*, em.nombre_estacion, ic.inspector_nombre
         FROM inspecciones_calidad ic
         LEFT JOIN estaciones_maestras em ON ic.estacion_id = em.id
         WHERE ic.orden_produccion_id = $1
         ORDER BY ic.created_at DESC`,
        [ordenId]
    );
    return result.rows;
};

/**
 * Obtiene inspecciones por paso.
 */
const getInspeccionesPorPaso = async (pasoId) => {
    const result = await query(
        `SELECT * FROM inspecciones_calidad WHERE paso_id = $1 ORDER BY created_at DESC`,
        [pasoId]
    );
    return result.rows;
};

/**
 * Obtiene inspecciones por fecha y estación.
 */
const getInspeccionesPorFecha = async (fecha, estacionId) => {
    let sql = `
        SELECT ic.*, em.nombre_estacion, ic.inspector_nombre
        FROM inspecciones_calidad ic
        LEFT JOIN estaciones_maestras em ON ic.estacion_id = em.id
        WHERE ic.created_at::date = $1
    `;
    const params = [fecha];
    
    if (estacionId) {
        sql += ` AND ic.estacion_id = $2`;
        params.push(estacionId);
    }
    
    sql += ` ORDER BY ic.created_at DESC`;
    const result = await query(sql, params);
    return result.rows;
};

/**
 * Obtiene estadísticas de calidad por período.
 */
const getEstadisticasCalidad = async (fechaInicio, fechaFin) => {
    const result = await query(`
        SELECT 
            COUNT(*) as total_inspecciones,
            SUM(CASE WHEN resultado = 'aprobado' THEN 1 ELSE 0 END) as aprobados,
            SUM(CASE WHEN resultado = 'rechazado' THEN 1 ELSE 0 END) as rechazados,
            SUM(CASE WHEN resultado = 'condicional' THEN 1 ELSE 0 END) as condicionales,
            SUM(cantidad_inspeccionada) as total_unidades_inspeccionadas,
            SUM(cantidad_defectuosa) as total_unidades_defectuosas,
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
 * Obtiene catálogo de tipos de defecto.
 */
const getTiposDefecto = async () => {
    const result = await query(
        `SELECT * FROM tipos_defecto WHERE activo = true ORDER BY categoria, nombre`
    );
    return result.rows;
};

/**
 * Actualiza una inspección.
 */
const actualizarInspeccion = async (id, datos, usuarioEmail, usuarioNombre) => {
    return await transaction(async ({ query: txQuery }) => {
        const anterior = await txQuery('SELECT * FROM inspecciones_calidad WHERE id = $1', [id]);
        if (anterior.rows.length === 0) return null;

        const { resultado, defectos, cantidad_inspeccionada, cantidad_defectuosa, observaciones, imagenes } = datos;
        const result = await txQuery(
            `UPDATE inspecciones_calidad SET
                resultado = COALESCE($1, resultado),
                defectos = COALESCE($2, defectos),
                cantidad_inspeccionada = COALESCE($3, cantidad_inspeccionada),
                cantidad_defectuosa = COALESCE($4, cantidad_defectuosa),
                observaciones = COALESCE($5, observaciones),
                imagenes = COALESCE($6, imagenes),
                updated_at = NOW()
             WHERE id = $7 RETURNING *`,
            [resultado, defectos ? JSON.stringify(defectos) : null, cantidad_inspeccionada, 
             cantidad_defectuosa, observaciones, imagenes ? JSON.stringify(imagenes) : null, id]
        );

        await txQuery(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_anteriores, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('inspeccion', $1, 'actualizar', $2, $3, $4, $5)`,
            [id, JSON.stringify(anterior.rows[0]), JSON.stringify(result.rows[0]), usuarioEmail, usuarioNombre]
        );

        return result.rows[0];
    });
};

module.exports = {
    crearInspeccion,
    getInspeccionesPorOrden,
    getInspeccionesPorPaso,
    getInspeccionesPorFecha,
    getEstadisticasCalidad,
    getDefectosFrecuentes,
    getTiposDefecto,
    actualizarInspeccion
};
