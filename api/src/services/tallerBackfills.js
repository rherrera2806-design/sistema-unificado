const { query } = require('../config/database');

/**
 * Service para operaciones de backfill del módulo Taller.
 * Extraído de routes/taller.js para separar lógica de negocio de controladores.
 */

/**
 * Asigna familia_id a órdenes que tienen grupo pero no familia_id.
 */
const backfillFamilia = async () => {
    const result = await query(`
        UPDATE produccion_ordenes o
        SET familia_id = f.id
        FROM familias_producto f
        WHERE f.nombre_familia = o.grupo
        AND o.familia_id IS NULL
        AND o.grupo IS NOT NULL
    `);
    return result.rowCount;
};

/**
 * Actualiza espesor_mm desde materias primas.
 */
const backfillEspesor = async () => {
    const result = await query(`
        UPDATE produccion_ordenes o
        SET espesor_mm = COALESCE(
            (SELECT m.espesor_mm FROM materias_primas m WHERE m.codigo_mp = o.codigo_producto),
            o.espesor_mm
        )
    `);
    return result.rowCount;
};

/**
 * Recrea pasos de producción para órdenes de la familia Termopanel.
 */
const backfillPasosTermopanel = async () => {
    const familiaRes = await query('SELECT id FROM familias_producto WHERE nombre_familia = $1', ['Termopanel']);
    if (!familiaRes.rows.length) return { ok: false, error: 'Familia Termopanel no encontrada' };
    const familiaId = familiaRes.rows[0].id;

    const estacionesRes = await query(
        `SELECT em.id as estacion_id, em.orden_secuencia_defecto
         FROM familia_estaciones_base feb
         JOIN estaciones_maestras em ON em.id = feb.estacion_id
         WHERE feb.familia_id = $1
         ORDER BY em.orden_secuencia_defecto`, [familiaId]
    );
    const estacionesIds = estacionesRes.rows.map(r => r.estacion_id);

    if (!estacionesIds.length) return { ok: false, error: 'No hay estaciones configuradas para Termopanel' };

    const ordenesRes = await query(
        `SELECT o.id, o.familia_id, o.codigo_padre,
                (SELECT COUNT(*) FROM cola_produccion_pasos cp WHERE cp.orden_produccion_id = o.id) as pasos_count
         FROM produccion_ordenes o
         WHERE o.grupo = 'Termopanel'
         OR o.familia_id = $1`, [familiaId]
    );

    let eliminados = 0;
    let creados = 0;

    for (const orden of ordenesRes.rows) {
        await query('DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1', [orden.id]);
        eliminados++;

        for (let s = 0; s < estacionesIds.length; s++) {
            await query(
                'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, $4)',
                [orden.id, estacionesIds[s], s + 1, 'PENDIENTE']
            );
            creados++;
        }
    }

    return { ok: true, ordenes_afectadas: ordenesRes.rows.length, eliminados, creados };
};

module.exports = {
    backfillFamilia,
    backfillEspesor,
    backfillPasosTermopanel
};
