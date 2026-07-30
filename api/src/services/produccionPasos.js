const { query } = require('../config/database');

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
    const updates = ['estado = $1'];
    const params = [estado];
    let idx = 2;
    if (estado === 'EN_PROCESO') updates.push('hora_inicio = COALESCE(hora_inicio, NOW())');
    if (estado === 'TERMINADO') updates.push('hora_fin = NOW()');
    if (operario_id !== undefined) { updates.push(`operario_id = $${idx}`); params.push(operario_id); idx++; }
    params.push(id);
    await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx}`, params);
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

const crearPasos = async (ordenId, estacionesBaseIds) => {
    for (let s = 0; s < estacionesBaseIds.length; s++) {
        await query(
            'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,$4)',
            [ordenId, estacionesBaseIds[s], s + 1, 'PENDIENTE']
        );
    }
};

module.exports = { getPasos, actualizarPaso, eliminarPaso, agregarPaso, crearPasos };
