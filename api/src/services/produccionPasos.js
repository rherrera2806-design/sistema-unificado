const { query } = require('../config/database');

// Vocabulario real de estados de cola_produccion_pasos
const ESTADOS_PASO_VALIDOS = ['PENDIENTE', 'EN_PROCESO', 'PAUSADO', 'TERMINADO', 'MERMADO'];

const getPasos = async (ordenId) => {
    const result = await query(`
        SELECT p.*, e.nombre_estacion, e.orden_secuencia_defecto
        FROM cola_produccion_pasos p
        LEFT JOIN estaciones_maestras e ON p.estacion_id = e.id
        WHERE p.orden_produccion_id = $1
        ORDER BY p.orden_secuencia
    `, [ordenId]);
    return result.rows;
};

const actualizarPaso = async (id, { estado, operario_id }) => {
    // El estado debe pertenecer al vocabulario de la tabla
    if (!ESTADOS_PASO_VALIDOS.includes(estado)) {
        throw new Error('Estado invalido. Permitidos: ' + ESTADOS_PASO_VALIDOS.join(', '));
    }
    const updates = ['estado = $1'];
    const params = [estado];
    let idx = 2;
    if (estado === 'EN_PROCESO') updates.push('hora_inicio = COALESCE(hora_inicio, NOW())');
    if (estado === 'TERMINADO') updates.push('hora_fin = NOW()');
    if (operario_id !== undefined) { updates.push(`operario_id = $${idx}`); params.push(operario_id); idx++; }
    params.push(id);
    const result = await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING orden_produccion_id`, params);
    // El estado de la orden se deriva del avance de sus pasos. Se usa require
    // diferido porque produccionOrdenes.js requiere este módulo (evitar ciclo).
    if (result.rows.length > 0) {
        try {
            const { sincronizarEstadoOrden } = require('./produccionOrdenes');
            await sincronizarEstadoOrden(result.rows[0].orden_produccion_id);
        } catch (e) { /* la sincronización no debe romper la actualización del paso */ }
    }
};

const eliminarPaso = async (id) => {
    await query('DELETE FROM cola_produccion_pasos WHERE id = $1', [id]);
};

const agregarPaso = async (ordenId, estacion_id) => {
    const existente = await query(
        'SELECT id FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estacion_id = $2',
        [ordenId, estacion_id]
    );
    if (existente.rows.length > 0) throw new Error('Esa estacion ya esta en la ruta');

    await query(
        "INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, 0, 'PENDIENTE')",
        [ordenId, estacion_id]
    );
    await query(`
        UPDATE cola_produccion_pasos SET orden_secuencia = sub.nueva_seq
        FROM (
            SELECT p.id, ROW_NUMBER() OVER (ORDER BY e.orden_secuencia_defecto ASC NULLS LAST) as nueva_seq
            FROM cola_produccion_pasos p
            JOIN estaciones_maestras e ON p.estacion_id = e.id
            WHERE p.orden_produccion_id = $1
        ) sub
        WHERE cola_produccion_pasos.id = sub.id
    `, [ordenId]);
};

const crearPasos = async (ordenId, estacionesBaseIds, q = query) => {
    // q permite ejecutar dentro de una transacción (ver crearOrden)
    for (let s = 0; s < estacionesBaseIds.length; s++) {
        await q(
            'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,$4)',
            [ordenId, estacionesBaseIds[s], s + 1, 'PENDIENTE']
        );
    }
};

module.exports = { getPasos, actualizarPaso, eliminarPaso, agregarPaso, crearPasos };
