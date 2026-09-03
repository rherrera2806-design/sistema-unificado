const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');

/**
 * Calcula m2 y kilos proporcionales a una cantidad.
 * Función compartida para eliminar duplicación entre procesarPaso y registrarMerma.
 */
const calcularProporcion = (cantidadTotal, cantidad, metrosCuadrados, kilos, ancho, alto) => {
    const m2Total = Number(metrosCuadrados) || ((Number(ancho) * Number(alto)) / 1000000) * cantidadTotal;
    const kilosTotal = Number(kilos) || 0;
    const m2Unit = cantidadTotal > 0 ? m2Total / cantidadTotal : 0;
    const kilosUnit = cantidadTotal > 0 ? kilosTotal / cantidadTotal : 0;
    return {
        m2: m2Unit * cantidad,
        kilos: kilosUnit * cantidad
    };
};

async function getEstacionesConCarga() {
    const result = await query(`
        SELECT e.id, e.nombre_estacion, e.orden_secuencia_defecto, e.cap_max,
               COALESCE(t.pendientes, 0) as pendientes,
               COALESCE(t.en_proceso, 0) as en_proceso,
               COALESCE(t.total_kilos, 0) as total_kilos,
               COALESCE(t.total_m2, 0) as total_m2,
               COALESCE(t.total_ml, 0) as total_ml,
               COALESCE(t.total_unidades, 0) as total_unidades
        FROM estaciones_maestras e
        LEFT JOIN (
            SELECT p.estacion_id,
                   COUNT(*) FILTER (WHERE p.estado = 'PENDIENTE') as pendientes,
                   COUNT(*) FILTER (WHERE p.estado = 'EN_PROCESO') as en_proceso,
                   SUM(COALESCE(o.kilos, 0)) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_kilos,
                   SUM(COALESCE(p.m2_asignados, (o.ancho::DECIMAL * o.alto / 1000000) * COALESCE(o.cantidad, 1))) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_m2,
                   SUM((o.alto::DECIMAL / 1000) * COALESCE(o.cantidad, 1)) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_ml,
                   SUM(COALESCE(o.cantidad, 1)) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_unidades
            FROM cola_produccion_pasos p
            JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
            WHERE p.estado IN ('PENDIENTE', 'EN_PROCESO')
            GROUP BY p.estacion_id
        ) t ON t.estacion_id = e.id
        WHERE e.activa = true
        ORDER BY e.orden_secuencia_defecto
    `);
    return result.rows;
}

async function getMaquinasPorEstacion(estacionId) {
    const result = await query(
        `SELECT id, nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso
         FROM produccion_maquinas
         WHERE estacion_id = $1 AND estado = 'ACTIVA'
         ORDER BY nombre`,
        [estacionId]
    );
    return result.rows;
}

async function getColaPorEstacion(estacionId) {
    const result = await query(`
        SELECT p.id, p.estado, p.orden_secuencia, p.hora_inicio, p.hora_fin, p.m2_asignados, p.fecha_programada, p.maquina_id,
               o.id as orden_id, o.pedido_sap_id, o.item_numero, o.cliente, o.codigo_producto, o.descripcion,
               o.ancho, o.alto, o.cantidad, o.espesor_mm, o.kilos, o.pintado, o.perforaciones,
               o.nota, o.grupo, o.es_reposicion, o.familia_id, o.mecanizado_operaciones, o.nivel_prioridad,
               f.nombre_familia,
               mq.nombre as maquina_nombre,
               nes.nombre_estacion as proxima_estacion,
               CASE WHEN p.orden_secuencia = 1 THEN TRUE
                    ELSE EXISTS(
                        SELECT 1 FROM cola_produccion_pasos prev
                        WHERE prev.orden_produccion_id = o.id
                          AND prev.orden_secuencia = p.orden_secuencia - 1
                          AND prev.estado = 'TERMINADO'
                    )
               END as paso_anterior_terminado,
               prev_est.nombre_estacion as estacion_anterior_nombre
        FROM cola_produccion_pasos p
        JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
        LEFT JOIN familias_producto f ON o.familia_id = f.id
        LEFT JOIN produccion_maquinas mq ON p.maquina_id = mq.id
        LEFT JOIN cola_produccion_pasos nes_paso ON nes_paso.orden_produccion_id = o.id
            AND nes_paso.orden_secuencia = p.orden_secuencia + 1
        LEFT JOIN estaciones_maestras nes ON nes_paso.estacion_id = nes.id
        LEFT JOIN cola_produccion_pasos prev_paso ON prev_paso.orden_produccion_id = o.id
            AND prev_paso.orden_secuencia = p.orden_secuencia - 1
        LEFT JOIN estaciones_maestras prev_est ON prev_paso.estacion_id = prev_est.id
        WHERE p.estacion_id = $1 AND p.estado IN ('PENDIENTE', 'EN_PROCESO')
        ORDER BY
            CASE WHEN p.estado = 'EN_PROCESO' THEN 0 ELSE 1 END,
            CASE WHEN p.estado = 'PENDIENTE' AND NOT EXISTS(
                SELECT 1 FROM cola_produccion_pasos prev
                WHERE prev.orden_produccion_id = o.id
                  AND prev.orden_secuencia = p.orden_secuencia - 1
                  AND prev.estado = 'TERMINADO'
            ) AND p.orden_secuencia > 1 THEN 1 ELSE 0 END,
            COALESCE(o.nivel_prioridad, 1) DESC,
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[^0-9]', '', 'g'), ''), '0')::BIGINT ASC,
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[0-9]', '', 'g'), ''), '') ASC,
            COALESCE(o.item_numero, 0) ASC,
            p.fecha_programada ASC NULLS LAST,
            p.orden_secuencia ASC, o.id ASC
    `, [estacionId]);
    return result.rows;
}

async function iniciarPaso(pasoId, maquinaId, operarioEmail, operarioNombre) {
    const updates = [`estado = 'EN_PROCESO'`, `hora_inicio = COALESCE(hora_inicio, NOW())`];
    const params = [];
    let idx = 1;

    if (maquinaId) { updates.push(`maquina_id = $${idx++}`); params.push(maquinaId); }
    updates.push(`operario_email = $${idx++}`); params.push(operarioEmail);
    updates.push(`operario_nombre = $${idx++}`); params.push(operarioNombre);
    updates.push(`locked_by = $${idx++}`); params.push(operarioEmail);
    updates.push(`locked_at = NOW()`);
    params.push(pasoId);

    await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx}`, params);

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'iniciar', jsonb_build_object('maquina_id', $2), $3, $4)`,
            [pasoId, maquinaId, operarioEmail, operarioNombre]
        );
    } catch (_) { }
}

async function pausarPaso(pasoId, operarioEmail, operarioNombre) {
    const paso = await query(
        `SELECT hora_inicio FROM cola_produccion_pasos WHERE id = $1 AND estado = 'EN_PROCESO'`,
        [pasoId]
    );
    if (paso.rows.length === 0) throw new Error('Paso no está en proceso');

    await query(
        `UPDATE cola_produccion_pasos SET estado = 'PAUSADO', pausado_en = NOW() WHERE id = $1`,
        [pasoId]
    );

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'pausar', $2, $3)`,
            [pasoId, operarioEmail, operarioNombre]
        );
    } catch (_) { }
}

async function reanudarPaso(pasoId, operarioEmail, operarioNombre) {
    const paso = await query(
        `SELECT pausado_en FROM cola_produccion_pasos WHERE id = $1 AND estado = 'PAUSADO'`,
        [pasoId]
    );
    if (paso.rows.length === 0) throw new Error('Paso no está pausado');

    const pausadoEn = new Date(paso.rows[0].pausado_en);
    const tiempoPausado = Math.floor((Date.now() - pausadoEn.getTime()) / 1000);

    await query(
        `UPDATE cola_produccion_pasos SET estado = 'EN_PROCESO', pausado_en = NULL, tiempo_pausado_segundos = tiempo_pausado_segundos + $1 WHERE id = $2`,
        [tiempoPausado, pasoId]
    );

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'reanudar', jsonb_build_object('tiempo_pausado_segundos', $2), $3, $4)`,
            [pasoId, tiempoPausado, operarioEmail, operarioNombre]
        );
    } catch (_) { }
}

async function finalizarPaso(pasoId, operarioEmail, operarioNombre) {
    const pasoResult = await query('SELECT * FROM cola_produccion_pasos WHERE id = $1', [pasoId]);
    if (pasoResult.rows.length === 0) return null;
    const p = pasoResult.rows[0];

    await query(
        `UPDATE cola_produccion_pasos SET estado = 'TERMINADO', hora_fin = NOW(), locked_by = NULL, locked_at = NULL WHERE id = $1`,
        [pasoId]
    );

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_anteriores, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'finalizar', $2, $3, $4)`,
            [pasoId, JSON.stringify(p), operarioEmail, operarioNombre]
        );
    } catch (_) { }

    const siguiente = await query(`
        SELECT cp.id, cp.estacion_id, em.nombre_estacion
        FROM cola_produccion_pasos cp
        JOIN estaciones_maestras em ON cp.estacion_id = em.id
        WHERE cp.orden_produccion_id = $1 AND cp.orden_secuencia = $2 AND cp.estado = 'PENDIENTE'
        LIMIT 1
    `, [p.orden_produccion_id, p.orden_secuencia + 1]);

    return {
        siguienteHabilitado: siguiente.rows.length > 0,
        siguientePasoId: siguiente.rows[0]?.id || null,
        siguienteEstacionId: siguiente.rows[0]?.estacion_id || null,
        siguienteEstacionNombre: siguiente.rows[0]?.nombre_estacion || null
    };
}

async function registrarMerma({ paso_id, causa, cantidad, observacion, userEmail }) {
    return await transaction(async ({ query: txQuery }) => {
        const pasoResult = await txQuery(
            `SELECT p.*, o.cliente, o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad, o.familia_id, o.kilos, o.espesor_mm, o.pedido_sap_id, o.grupo, o.metros_cuadrados, o.costo_materia_prima, o.nota, o.pintado, o.perforaciones, o.tipo_venta, o.posicion, o.orden_compra, o.tipo_entrega, o.item_numero, o.codigo_padre, o.mecanizado_operaciones
             FROM cola_produccion_pasos p
             JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
             WHERE p.id = $1`,
            [paso_id]
        );
        if (pasoResult.rows.length === 0) return null;
        const p = pasoResult.rows[0];

        const cantidadOriginal = Number(p.cantidad) || 1;
        const cantidadMermada = Number(cantidad) || 1;
        const cantidadRestante = Math.max(0, cantidadOriginal - cantidadMermada);
        const proporcion = calcularProporcion(cantidadOriginal, cantidadMermada, p.metros_cuadrados, p.kilos, p.ancho, p.alto);
        const proporcionRestante = calcularProporcion(cantidadOriginal, cantidadRestante, p.metros_cuadrados, p.kilos, p.ancho, p.alto);
        const costoMP = p.costo_materia_prima || 0;

        const mermaResult = await txQuery(
            `INSERT INTO mermas (orden_produccion_id, paso_id, estacion_id, causa, cantidad, observacion, m2_mermados, costo_materia_prima, creado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
            [p.orden_produccion_id, paso_id, p.estacion_id, causa, cantidadMermada, observacion || '', proporcion.m2, costoMP, userEmail]
        );
        const mermaId = mermaResult.rows[0].id;

        const nuevaOrdenResult = await txQuery(
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, cantidad, familia_id, espesor_mm, kilos, estado_programacion, es_reposicion, merma_original_id, pintado, perforaciones, tipo_venta, nota, posicion, orden_compra, tipo_entrega, grupo, item_numero, codigo_padre, mecanizado_operaciones, nivel_prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDIENTE',TRUE,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,4) RETURNING id`,
            [p.pedido_sap_id, p.cliente, p.codigo_producto, '[REPOSICION] ' + (p.descripcion || ''), p.ancho, p.alto, proporcion.m2, cantidadMermada, p.familia_id, p.espesor_mm, proporcion.kilos, mermaId, p.pintado, p.perforaciones, p.tipo_venta, (p.nota || '') + ' | Merma: ' + causa + (observacion ? ' - ' + observacion : ''), p.posicion, p.orden_compra, p.tipo_entrega, p.grupo, p.item_numero, p.codigo_padre, p.mecanizado_operaciones]
        );
        const nuevaOrdenId = nuevaOrdenResult.rows[0].id;

        const pasosOriginales = await txQuery(
            `SELECT cp.estacion_id, cp.orden_secuencia FROM cola_produccion_pasos cp WHERE cp.orden_produccion_id = $1 ORDER BY cp.orden_secuencia ASC`,
            [p.orden_produccion_id]
        );

        if (pasosOriginales.rows.length > 0) {
            for (const paso of pasosOriginales.rows) {
                await txQuery(
                    `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado, fecha_programada, m2_asignados)
                     VALUES ($1,$2,$3,'PENDIENTE',null,$4)`,
                    [nuevaOrdenId, paso.estacion_id, paso.orden_secuencia, proporcion.m2]
                );
            }
        } else {
            const baseEstaciones = await txQuery(
                `SELECT estacion_id FROM familia_estaciones_base WHERE familia_id = $1 ORDER BY (SELECT orden_secuencia_defecto FROM estaciones_maestras WHERE id = estacion_id)`,
                [p.familia_id]
            );
            for (let i = 0; i < baseEstaciones.rows.length; i++) {
                await txQuery(
                    `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado, fecha_programada, m2_asignados)
                     VALUES ($1,$2,$3,'PENDIENTE',null,$4)`,
                    [nuevaOrdenId, baseEstaciones.rows[i].estacion_id, i + 1, proporcion.m2]
                );
            }
        }

        if (cantidadRestante > 0) {
            await txQuery(
                `UPDATE produccion_ordenes SET cantidad = $1, metros_cuadrados = $2, kilos = $3 WHERE id = $4`,
                [cantidadRestante, proporcionRestante.m2, proporcionRestante.kilos, p.orden_produccion_id]
            );
            await txQuery(
                `UPDATE cola_produccion_pasos SET m2_asignados = $1 WHERE id = $2`,
                [proporcionRestante.m2, paso_id]
            );
        } else {
            await txQuery(
                `UPDATE cola_produccion_pasos SET estado = 'MERMADO', hora_fin = NOW() WHERE id = $1`,
                [paso_id]
            );
        }

        return { mermaId, nuevaOrdenId, cantidadRestante };
    });
}

async function getMermas(fecha) {
    const result = await query(`
        SELECT m.*, o.cliente, o.codigo_producto, o.descripcion, o.ancho, o.alto, e.nombre_estacion
        FROM mermas m
        JOIN produccion_ordenes o ON m.orden_produccion_id = o.id
        LEFT JOIN estaciones_maestras e ON m.estacion_id = e.id
        WHERE m.created_at::date = $1
        ORDER BY m.created_at DESC
    `, [fecha]);
    return result.rows;
}

async function procesarPaso(pasoId, cantidad, maquinaId, operarioEmail, operarioNombre) {
    const pasoResult = await query(
        `SELECT p.*, o.cantidad as cantidad_total, o.metros_cuadrados, o.kilos, o.ancho, o.alto,
                o.pedido_sap_id, o.cliente, o.codigo_producto, o.descripcion, o.familia_id,
                o.espesor_mm, o.grupo, o.nota, o.pintado, o.perforaciones, o.tipo_venta,
                o.posicion, o.orden_compra, o.tipo_entrega, o.item_numero, o.codigo_padre,
                o.mecanizado_operaciones
         FROM cola_produccion_pasos p
         JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
         WHERE p.id = $1`,
        [pasoId]
    );
    if (pasoResult.rows.length === 0) return null;
    const p = pasoResult.rows[0];

    const cantidadTotal = Number(p.cantidad_total) || 1;
    const cantidadProcesar = Math.min(Number(cantidad) || cantidadTotal, cantidadTotal);
    const cantidadRestante = cantidadTotal - cantidadProcesar;

    if (cantidadRestante > 0) {
        const proporcionProcesar = calcularProporcion(cantidadTotal, cantidadProcesar, p.metros_cuadrados, p.kilos, p.ancho, p.alto);
        const proporcionRestante = calcularProporcion(cantidadTotal, cantidadRestante, p.metros_cuadrados, p.kilos, p.ancho, p.alto);

        await query(
            `UPDATE produccion_ordenes SET cantidad = $1, metros_cuadrados = $2, kilos = $3 WHERE id = $4`,
            [cantidadProcesar, proporcionProcesar.m2, proporcionProcesar.kilos, p.orden_produccion_id]
        );

        const nuevaOrdenResult = await query(
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, cantidad, familia_id, espesor_mm, kilos, estado_programacion, grupo, nota, pintado, perforaciones, tipo_venta, posicion, orden_compra, tipo_entrega, item_numero, codigo_padre, mecanizado_operaciones, nivel_prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDIENTE',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,1) RETURNING id`,
            [p.pedido_sap_id, p.cliente, p.codigo_producto, p.descripcion, p.ancho, p.alto, proporcionRestante.m2, cantidadRestante, p.familia_id, p.espesor_mm, proporcionRestante.kilos, p.grupo, p.nota, p.pintado, p.perforaciones, p.tipo_venta, p.posicion, p.orden_compra, p.tipo_entrega, p.item_numero, p.codigo_padre, p.mecanizado_operaciones]
        );
        const nuevaOrdenId = nuevaOrdenResult.rows[0].id;

        const pasosOriginales = await query(
            `SELECT estacion_id, orden_secuencia FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia`,
            [p.orden_produccion_id]
        );
        for (const paso of pasosOriginales.rows) {
            await query(
                `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado, m2_asignados)
                 VALUES ($1,$2,$3,'PENDIENTE',$4)`,
                [nuevaOrdenId, paso.estacion_id, paso.orden_secuencia, proporcionRestante.m2]
            );
        }
    }

    const updates = [`estado = 'EN_PROCESO'`, `hora_inicio = COALESCE(hora_inicio, NOW())`];
    const params = [];
    let idx = 1;
    if (maquinaId) { updates.push(`maquina_id = $${idx++}`); params.push(maquinaId); }
    updates.push(`operario_email = $${idx++}`); params.push(operarioEmail);
    updates.push(`operario_nombre = $${idx++}`); params.push(operarioNombre);
    params.push(pasoId);
    await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    await query(`UPDATE cola_produccion_pasos SET estado = 'TERMINADO', hora_fin = NOW() WHERE id = $1`, [pasoId]);

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'procesar', jsonb_build_object('cantidad', $2, 'maquina_id', $3), $4, $5)`,
            [pasoId, cantidadProcesar, maquinaId, operarioEmail, operarioNombre]
        );
    } catch (_) { }

    return { cantidadProcesar, cantidadRestante };
}

async function iniciarPasosPorOrden(ordenId, maquinaId, operarioEmail, operarioNombre) {
    const result = await query(
        `SELECT id FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estado = 'PENDIENTE' ORDER BY orden_secuencia ASC`,
        [ordenId]
    );
    let count = 0;
    for (const row of result.rows) {
        try {
            await iniciarPaso(row.id, maquinaId, operarioEmail, operarioNombre);
            count++;
        } catch (_) { }
    }
    return count;
}

module.exports = {
    getEstacionesConCarga,
    getColaPorEstacion,
    getMaquinasPorEstacion,
    iniciarPaso,
    iniciarPasosPorOrden,
    finalizarPaso,
    procesarPaso,
    registrarMerma,
    getMermas
};
