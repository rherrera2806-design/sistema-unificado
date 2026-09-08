const { query } = require('../config/database');

/**
 * Service para operaciones de planificación que estaban inline en los routes.
 * Extrae queries SQL directas de produccionPlanificacion.js
 */

/**
 * Obtiene detalle de órdenes por grupo y día.
 */
const getDetalleGrupoDia = async (grupo, fecha) => {
    const result = await query(`
        SELECT o.id, o.pedido_sap_id, o.item_numero, o.codigo_producto, o.descripcion, o.ancho, o.alto,
               o.metros_cuadrados, o.kilos, o.cantidad, o.grupo, o.codigo_padre, o.es_compuesto,
               o.estado_programacion,
               (SELECT string_agg(em.nombre_estacion || ' (' || to_char(cp.fecha_programada,'DD/MM') || ')', ' → ' ORDER BY cp.orden_secuencia)
                FROM cola_produccion_pasos cp JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND cp.fecha_programada IS NOT NULL) as ruta
        FROM produccion_ordenes o
        WHERE o.grupo ILIKE $1
          AND EXISTS (
              SELECT 1 FROM cola_produccion_pasos cp2
              WHERE cp2.orden_produccion_id = o.id AND cp2.fecha_programada = $2
          )
        ORDER BY o.pedido_sap_id, o.item_numero
    `, [grupo, fecha]);
    return result.rows;
};

/**
 * Crea un nuevo grupo de capacidad.
 */
const crearCapacidadGrupo = async ({ grupo, capacidad_kg_dia, color, activo }) => {
    const result = await query(
        'INSERT INTO produccion_capacidad_grupo (grupo, capacidad_kg_dia, color, activo) VALUES ($1, $2, $3, $4) RETURNING *',
        [grupo.trim(), Number(capacidad_kg_dia) || 0, color || '#3b82f6', activo !== false]
    );
    return result.rows[0];
};

/**
 * Elimina un grupo de capacidad.
 */
const eliminarCapacidadGrupo = async (id) => {
    await query('DELETE FROM produccion_capacidad_grupo WHERE id = $1', [id]);
};

/**
 * Obtiene notas de un usuario.
 */
const getNotas = async (userEmail) => {
    const result = await query('SELECT * FROM prod_notas WHERE usuario_email = $1 ORDER BY fecha_creacion DESC', [userEmail]);
    return result.rows;
};

/**
 * Crea una nota para un usuario.
 */
const crearNota = async (userEmail, nota) => {
    const result = await query(
        "INSERT INTO prod_notas (usuario_email, nota, estado) VALUES ($1, $2, 'pendiente') RETURNING *",
        [userEmail, nota.trim()]
    );
    return result.rows[0];
};

/**
 * Actualiza el estado de una nota.
 */
const actualizarNota = async (id, userEmail, estado) => {
    const result = estado === 'realizado'
        ? await query('UPDATE prod_notas SET estado = $1, fecha_completado = CURRENT_TIMESTAMP WHERE id = $2 AND usuario_email = $3 RETURNING *', [estado, id, userEmail])
        : await query('UPDATE prod_notas SET estado = $1, fecha_completado = NULL WHERE id = $2 AND usuario_email = $3 RETURNING *', [estado, id, userEmail]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

/**
 * Elimina una nota de un usuario.
 */
const eliminarNota = async (id, userEmail) => {
    await query('DELETE FROM prod_notas WHERE id = $1 AND usuario_email = $2', [id, userEmail]);
};

/**
 * Cambia la prioridad de una orden.
 */
const cambiarPrioridad = async (ordenId, nivelPrioridad) => {
    await query('UPDATE produccion_ordenes SET nivel_prioridad = $1, needs_reprogramming = TRUE WHERE id = $2', [nivelPrioridad, ordenId]);
};

/**
 * Verifica si hay cambios pendientes de reprogramación.
 */
const getReprogramarPendientes = async () => {
    const result = await query('SELECT COUNT(*) as count FROM produccion_ordenes WHERE needs_reprogramming = TRUE');
    return { pendientes: Number(result.rows[0].count) > 0, count: Number(result.rows[0].count) };
};

module.exports = {
    getDetalleGrupoDia,
    crearCapacidadGrupo,
    eliminarCapacidadGrupo,
    getNotas,
    crearNota,
    actualizarNota,
    eliminarNota,
    cambiarPrioridad,
    getReprogramarPendientes
};
