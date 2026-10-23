const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');
// Require normal: produccionOrdenes.js no requiere taller.js, no hay ciclo
const { sincronizarEstadoOrden } = require('./produccionOrdenes');

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
               o.codigo_padre,
               -- Descripción del código padre (catálogo de códigos): se muestra
               -- junto al código SAP en la cola de planta
               CASE WHEN o.codigo_padre IS NOT NULL THEN
                   COALESCE((SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre), o.codigo_padre)
               ELSE NULL END as descripcion_padre,
               -- Cantidad y kilos PROPIOS de este paso (los pasos "resto" que
               -- nacen de un ingreso parcial cubren solo una parte de la orden)
               ROUND(o.cantidad * COALESCE(p.m2_asignados, o.metros_cuadrados) / NULLIF(o.metros_cuadrados, 0)) as cantidad_paso,
               ROUND(o.kilos * COALESCE(p.m2_asignados, o.metros_cuadrados) / NULLIF(o.metros_cuadrados, 0), 1) as kilos_paso,
               f.nombre_familia,
               mq.nombre as maquina_nombre,
               est_actual.nombre_estacion as estacion_actual,
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
        LEFT JOIN estaciones_maestras est_actual ON p.estacion_id = est_actual.id
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
            CASE COALESCE(o.nivel_prioridad, 1) WHEN 4 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END ASC,
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[^0-9]', '', 'g'), ''), '0')::BIGINT ASC,
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[0-9]', '', 'g'), ''), '') ASC,
            COALESCE(o.item_numero, 0) ASC,
            p.fecha_programada ASC NULLS LAST,
            p.orden_secuencia ASC, o.id ASC
    `, [estacionId]);
    return result.rows;
}

async function registrarTurnoSiNoExiste(operarioEmail, operarioNombre, turno) {
    if (!operarioEmail || !turno) return;
    try {
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const existe = await query(
            `SELECT id FROM taller_turnos WHERE fecha = $1 AND turno = $2 AND operario_email = $3`,
            [hoy, turno, operarioEmail]
        );
        if (existe.rows.length === 0) {
            await query(
                `INSERT INTO taller_turnos (fecha, turno, operario_email, operario_nombre, hora_inicio)
                 VALUES ($1, $2, $3, $4, NOW())`,
                [hoy, turno, operarioEmail, operarioNombre]
            );
        }
    } catch (_) { }
}

async function iniciarPaso(pasoId, maquinaId, operarioEmail, operarioNombre, turno) {
    const updates = [`estado = 'EN_PROCESO'`, `hora_inicio = COALESCE(hora_inicio, NOW())`];
    const params = [];
    let idx = 1;

    if (maquinaId) { updates.push(`maquina_id = $${idx++}`); params.push(maquinaId); }
    updates.push(`operario_email = $${idx++}`); params.push(operarioEmail);
    updates.push(`operario_nombre = $${idx++}`); params.push(operarioNombre);
    updates.push(`locked_by = $${idx++}`); params.push(operarioEmail);
    updates.push(`locked_at = NOW()`);
    params.push(pasoId);

    const upd = await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING orden_produccion_id`, params);

    // El estado de la orden se deriva del avance de sus pasos
    if (upd.rows.length > 0) {
        try { await sincronizarEstadoOrden(upd.rows[0].orden_produccion_id); } catch (_) { }
    }

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'iniciar', jsonb_build_object('maquina_id', $2, 'turno', $5), $3, $4)`,
            [pasoId, maquinaId, operarioEmail, operarioNombre, turno]
        );
    } catch (_) { }

    await registrarTurnoSiNoExiste(operarioEmail, operarioNombre, turno);
}

async function pausarPaso(pasoId, operarioEmail, operarioNombre) {
    const paso = await query(
        `SELECT hora_inicio, orden_produccion_id FROM cola_produccion_pasos WHERE id = $1 AND estado = 'EN_PROCESO'`,
        [pasoId]
    );
    if (paso.rows.length === 0) throw new Error('Paso no está en proceso');

    await query(
        `UPDATE cola_produccion_pasos SET estado = 'PAUSADO', pausado_en = NOW() WHERE id = $1`,
        [pasoId]
    );

    // El estado de la orden se deriva del avance de sus pasos
    try { await sincronizarEstadoOrden(paso.rows[0].orden_produccion_id); } catch (_) { }

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
        `SELECT pausado_en, orden_produccion_id FROM cola_produccion_pasos WHERE id = $1 AND estado = 'PAUSADO'`,
        [pasoId]
    );
    if (paso.rows.length === 0) throw new Error('Paso no está pausado');

    const pausadoEn = new Date(paso.rows[0].pausado_en);
    const tiempoPausado = Math.floor((Date.now() - pausadoEn.getTime()) / 1000);

    await query(
        `UPDATE cola_produccion_pasos SET estado = 'EN_PROCESO', pausado_en = NULL, tiempo_pausado_segundos = tiempo_pausado_segundos + $1 WHERE id = $2`,
        [tiempoPausado, pasoId]
    );

    // El estado de la orden se deriva del avance de sus pasos
    try { await sincronizarEstadoOrden(paso.rows[0].orden_produccion_id); } catch (_) { }

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'reanudar', jsonb_build_object('tiempo_pausado_segundos', $2), $3, $4)`,
            [pasoId, tiempoPausado, operarioEmail, operarioNombre]
        );
    } catch (_) { }
}

async function finalizarPaso(pasoId, operarioEmail, operarioNombre, cantidadReal, turnoRegistro) {
    const pasoResult = await query(
        `SELECT p.*, o.cantidad AS cantidad_orden, o.metros_cuadrados AS m2_orden
         FROM cola_produccion_pasos p
         JOIN produccion_ordenes o ON o.id = p.orden_produccion_id WHERE p.id = $1`, [pasoId]);
    if (pasoResult.rows.length === 0) return null;
    const p = pasoResult.rows[0];

    // La cantidad REAL se mide contra lo ASIGNADO A ESTE PASO (proporción de su
    // m2 sobre el m2 de la orden), no contra el total de la orden: un paso
    // "resto" de un ingreso parcial solo cubre esa parte.
    const cantidadOrden = Number(p.cantidad_orden) || 1;
    const m2Orden = Number(p.m2_orden) || 0;
    const m2Asignados = Number(p.m2_asignados) || m2Orden;
    const cantidadAsignada = (m2Orden > 0 && m2Asignados > 0)
        ? Math.max(1, Math.round(cantidadOrden * m2Asignados / m2Orden))
        : cantidadOrden;
    let cantReal = cantidadReal == null || cantidadReal === '' ? cantidadAsignada : Number(cantidadReal);
    if (!Number.isFinite(cantReal) || cantReal < 0) cantReal = cantidadAsignada;
    if (cantReal > cantidadAsignada) cantReal = cantidadAsignada;
    const proporcion = cantidadAsignada > 0 ? cantReal / cantidadAsignada : 1;
    const m2Real = m2Asignados * proporcion;
    const restoCant = cantidadAsignada - cantReal;
    const restoM2 = m2Asignados - m2Real;

    // Trazabilidad: usuario que registró, hora (NOW), turno y fecha de turno
    const infoTurno = await getTurnoInfo();
    const turnoFinal = turnoRegistro || infoTurno.turno;
    await query(
        `UPDATE cola_produccion_pasos SET estado = 'TERMINADO', hora_fin = NOW(), locked_by = NULL, locked_at = NULL, cantidad_real = $2, m2_real = $3, fecha_turno = $4, turno = $5, operario_email = COALESCE($6, operario_email), operario_nombre = COALESCE($7, operario_nombre) WHERE id = $1`,
        [pasoId, cantReal, m2Real, infoTurno.fecha, turnoFinal, operarioEmail, operarioNombre]
    );

    // Resto pendiente en la misma estación (sin merma)
    let restoPasoId = null;
    if (restoCant > 0 && restoM2 > 0.0001) {
        const nuevo = await query(
            `INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado, m2_asignados)
             VALUES ($1, $2, $3, 'PENDIENTE', $4) RETURNING id`,
            [p.orden_produccion_id, p.estacion_id, p.orden_secuencia, restoM2]
        );
        restoPasoId = nuevo.rows[0].id;
    }

    // El estado de la orden se deriva del avance de sus pasos
    try { await sincronizarEstadoOrden(p.orden_produccion_id); } catch (_) { }

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_anteriores, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'finalizar', $2, $3, $4)`,
            [pasoId, JSON.stringify({ ...p, cantidad_real: cantReal, m2_real: m2Real, turno: turnoFinal, fecha_turno: infoTurno.fecha, resto_paso_id: restoPasoId }), operarioEmail, operarioNombre]
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
        siguienteEstacionNombre: siguiente.rows[0]?.nombre_estacion || null,
        cantidadReal: cantReal,
        restoCantidad: restoCant,
        restoPasoId
    };
}

// ===== Registro MANUAL de producción (si la terminal falla) =====
// Filas: [{ pedido, item, cantidad }]. Con estacion_id el registro se ata a la
// estación/máquina/turno donde se está trabajando (contexto del piso).
async function registroManual({ filas, userEmail, userName, estacionId, maquinaId, turno }) {
    const resultados = [];
    if (turno) {
        try { await registrarTurnoSiNoExiste(userEmail, userName, turno); } catch (_) { }
    }
    for (const f of (Array.isArray(filas) ? filas : [])) {
        const pedido = String(f.pedido || '').trim();
        const item = Number(f.item) || 1;
        const cant = Number(f.cantidad);
        if (!pedido || !Number.isFinite(cant) || cant <= 0) {
            resultados.push({ pedido, item, ok: false, mensaje: 'Datos inválidos (pedido, item y cantidad requeridos)' });
            continue;
        }
        const ords = await query(
            `SELECT id, cantidad FROM produccion_ordenes
             WHERE pedido_sap_id = $1 AND item_numero = $2
               AND estado_programacion NOT IN ('CERRADO', 'TERMINADO', 'MERMADO')
             ORDER BY id DESC LIMIT 1`, [pedido, item]);
        if (ords.rows.length === 0) {
            resultados.push({ pedido, item, ok: false, mensaje: 'No hay orden activa con ese pedido/item' });
            continue;
        }
        const orden = ords.rows[0];
        if (cant > Number(orden.cantidad)) {
            resultados.push({ pedido, item, ok: false, mensaje: `La cantidad ${cant} supera la de la orden (${orden.cantidad})` });
            continue;
        }
        const filtros = ['orden_produccion_id = $1', `estado IN ('EN_PROCESO', 'PENDIENTE')`];
        const params = [orden.id];
        if (estacionId) {
            filtros.push(`estacion_id = $${params.length + 1}`);
            params.push(estacionId);
        }
        const pasos = await query(
            `SELECT id FROM cola_produccion_pasos WHERE ${filtros.join(' AND ')}
             ORDER BY CASE estado WHEN 'EN_PROCESO' THEN 0 ELSE 1 END, orden_secuencia
             LIMIT 1`, params);
        if (pasos.rows.length === 0) {
            resultados.push({
                pedido, item, ok: false,
                mensaje: estacionId
                    ? 'La orden no tiene pasos pendientes en ESTA estación'
                    : 'La orden no tiene pasos pendientes'
            });
            continue;
        }
        const r = await finalizarPaso(pasos.rows[0].id, userEmail, userName, cant, turno);
        if (!r) {
            resultados.push({ pedido, item, ok: false, mensaje: 'No se pudo registrar la producción' });
            continue;
        }
        resultados.push({
            pedido, item, ok: true, cantidad: r.cantidadReal,
            mensaje: r.cantidadReal < cant
                ? `Solo se podían registrar ${r.cantidadReal} (era lo que quedaba en este paso)`
                : (r.restoCantidad > 0
                    ? `Registradas ${r.cantidadReal}; ${r.restoCantidad} quedan pendientes de corte`
                    : 'Producción registrada completa')
        });
    }
    return resultados;
}

async function registrarMerma({ paso_id, causa, cantidad, observacion, userEmail }) {
    let ordenAfectadaId = null;
    const resultado = await transaction(async ({ query: txQuery }) => {
        const pasoResult = await txQuery(
            `SELECT p.*, o.cliente, o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad, o.familia_id, o.kilos, o.espesor_mm, o.pedido_sap_id, o.grupo, o.metros_cuadrados, o.costo_materia_prima, o.nota, o.pintado, o.perforaciones, o.tipo_venta, o.posicion, o.orden_compra, o.tipo_entrega, o.item_numero, o.codigo_padre, o.mecanizado_operaciones
             FROM cola_produccion_pasos p
             JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
             WHERE p.id = $1`,
            [paso_id]
        );
        if (pasoResult.rows.length === 0) return null;
        const p = pasoResult.rows[0];
        ordenAfectadaId = p.orden_produccion_id;

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
            const infoTurnoMerma = await getTurnoInfo();
            await txQuery(
                `UPDATE cola_produccion_pasos SET estado = 'MERMADO', hora_fin = NOW(), fecha_turno = $2, turno = $3 WHERE id = $1`,
                [paso_id, infoTurnoMerma.fecha, infoTurnoMerma.turno]
            );
        }

        return { mermaId, nuevaOrdenId, cantidadRestante };
    });

    // Sincroniza el estado de la orden con el avance de sus pasos. Se hace fuera
    // de la transacción para no mezclar conexiones (la sincronización usa el pool).
    if (resultado && ordenAfectadaId) {
        try { await sincronizarEstadoOrden(ordenAfectadaId); } catch (_) { }
    }
    return resultado;
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
                o.mecanizado_operaciones, o.nivel_prioridad
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
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PENDIENTE',$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,COALESCE($23, 1)) RETURNING id`,
            [p.pedido_sap_id, p.cliente, p.codigo_producto, p.descripcion, p.ancho, p.alto, proporcionRestante.m2, cantidadRestante, p.familia_id, p.espesor_mm, proporcionRestante.kilos, p.grupo, p.nota, p.pintado, p.perforaciones, p.tipo_venta, p.posicion, p.orden_compra, p.tipo_entrega, p.item_numero, p.codigo_padre, p.mecanizado_operaciones, p.nivel_prioridad]
        );
        const nuevaOrdenId = nuevaOrdenResult.rows[0].id;

        // La orden nueva (resto) SOLO hereda los pasos que faltan: los ya
        // TERMINADOS no se re-crean (antes se copiaban todos y aparecían
        // "duplicados" en estaciones ya trabajadas).
        const pasosOriginales = await query(
            `SELECT estacion_id, orden_secuencia FROM cola_produccion_pasos
             WHERE orden_produccion_id = $1 AND (estado <> 'TERMINADO' OR id = $2)
             ORDER BY orden_secuencia`,
            [p.orden_produccion_id, pasoId]
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
    const infoTurnoProc = await getTurnoInfo();
    await query(`UPDATE cola_produccion_pasos SET estado = 'TERMINADO', hora_fin = NOW(), fecha_turno = $2, turno = $3, operario_email = COALESCE($4, operario_email), operario_nombre = COALESCE($5, operario_nombre) WHERE id = $1`, [pasoId, infoTurnoProc.fecha, infoTurnoProc.turno, operarioEmail, operarioNombre]);

    // El estado de la orden se deriva del avance de sus pasos
    try { await sincronizarEstadoOrden(p.orden_produccion_id); } catch (_) { }

    try {
        await query(
            `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
             VALUES ('paso', $1, 'procesar', jsonb_build_object('cantidad', $2, 'maquina_id', $3), $4, $5)`,
            [pasoId, cantidadProcesar, maquinaId, operarioEmail, operarioNombre]
        );
    } catch (_) { }

    return { cantidadProcesar, cantidadRestante };
}

async function iniciarPasosPorOrden(ordenId, pedidoSapId, estacionId, maquinaId, operarioEmail, operarioNombre, turno) {
    const params = [];
    let sql = `SELECT id, orden_produccion_id, orden_secuencia FROM cola_produccion_pasos WHERE estado = 'PENDIENTE'`;
    const where = [];
    if (ordenId) {
        params.push(ordenId);
        where.push(`orden_produccion_id = $${params.length}`);
    } else if (pedidoSapId) {
        params.push(pedidoSapId);
        where.push(`orden_produccion_id IN (SELECT id FROM produccion_ordenes WHERE pedido_sap_id = $${params.length})`);
    }
    if (estacionId) {
        params.push(estacionId);
        where.push(`estacion_id = $${params.length}`);
    }
    if (where.length) sql += ` AND ${where.join(' AND ')}`;
    sql += ` ORDER BY orden_produccion_id ASC, orden_secuencia ASC`;
    const result = await query(sql, params);
    let count = 0;
    for (const row of result.rows) {
        try {
            await iniciarPaso(row.id, maquinaId, operarioEmail, operarioNombre, turno);
            count++;
        } catch (_) { }
    }
    return count;
}

async function finalizarPasosPorPedido(pedidoSapId, estacionId, operarioEmail, operarioNombre) {
    if (!pedidoSapId) return 0;
    const params = [pedidoSapId];
    let sql = `SELECT id FROM cola_produccion_pasos WHERE estado = 'EN_PROCESO' AND orden_produccion_id IN (SELECT id FROM produccion_ordenes WHERE pedido_sap_id = $1)`;
    if (estacionId) { params.push(estacionId); sql += ` AND estacion_id = $2`; }
    sql += ` ORDER BY orden_produccion_id ASC, orden_secuencia ASC`;
    const result = await query(sql, params);
    let count = 0;
    for (const row of result.rows) {
        try {
            await finalizarPaso(row.id, operarioEmail, operarioNombre);
            count++;
        } catch (_) { }
    }
    return count;
}

// ===== Turno y día del turno: para el nocturno el día = día de TÉRMINO =====
// (ej: la noche que arranca Jue 22:00 y termina Vie 06:30 es el turno del
// VIERNES; el especial Dom 00:00 → Lun 07:30 = Lunes). Devuelve
// { turno: 'dia'|'noche'|'extra', fecha: 'YYYY-MM-DD' } (local). Sin
// configuración o fuera de ventana = 'extra' y fecha calendario.
async function getTurnoInfo(fecha) {
    const f = fecha ? new Date(fecha) : new Date();
    const local = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    try {
        const result = await query(
            `SELECT dia_semana, turno, hora_inicio, hora_fin, dia_siguiente
             FROM turnos_semanales WHERE anio = $1 AND mes = $2`,
            [f.getFullYear(), f.getMonth() + 1]);
        for (let atras = 0; atras <= 1; atras++) {
            const d = new Date(f.getTime() - atras * 86400000);
            for (const h of result.rows) {
                if (Number(h.dia_semana) !== d.getDay()) continue;
                const [hi, mi] = String(h.hora_inicio).split(':').map(Number);
                const [hf, mf] = String(h.hora_fin).split(':').map(Number);
                const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi);
                const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (h.dia_siguiente ? 1 : 0), hf, mf);
                if (fin > ini && f >= ini && f < fin) return { turno: h.turno, fecha: local(fin) }; // día de término
            }
        }
    } catch (_) { }
    return { turno: 'extra', fecha: local(f) };
}

async function getFechaTurno(fecha) {
    return (await getTurnoInfo(fecha)).fecha;
}

// ===== Horarios de turno semanales por mes (día / noche; lo demás = extra) =====
// dia_semana: 0=Dom .. 6=Sáb. dia_siguiente=true cuando el turno termina al
// día siguiente (ej: noche Lun 22:00 → Mar 07:30; el especial Dom 00:00 → Lun 07:30).
async function getHorariosTurnos(anio) {
    const where = anio ? 'WHERE anio = $1' : '';
    const params = anio ? [anio] : [];
    const result = await query(
        `SELECT id, anio, mes, dia_semana, turno,
                to_char(hora_inicio, 'HH24:MI') as hora_inicio,
                to_char(hora_fin, 'HH24:MI') as hora_fin,
                dia_siguiente
         FROM turnos_semanales ${where} ORDER BY anio DESC, mes, dia_semana, turno`, params);
    return result.rows;
}

// Guardar la semana completa de un mes: primero se limpia el mes y luego se
// insertan los turnos definidos (así el mes queda exactamente como se cargó).
async function guardarHorariosTurnos(filas) {
    const validas = (Array.isArray(filas) ? filas : []).filter(f => {
        const anio = Number(f.anio);
        const mes = Number(f.mes);
        const diaSemana = Number(f.dia_semana);
        const turno = String(f.turno || '').toLowerCase();
        return anio && mes >= 1 && mes <= 12 && diaSemana >= 0 && diaSeis(diaSemana)
            && ['dia', 'noche'].includes(turno)
            && /^\d{1,2}:\d{2}$/.test(String(f.hora_inicio || ''))
            && /^\d{1,2}:\d{2}$/.test(String(f.hora_fin || ''));
    });
    if (!validas.length) return { guardadas: 0 };
    const anio = Number(validas[0].anio);
    const mes = Number(validas[0].mes);
    await query('DELETE FROM turnos_semanales WHERE anio = $1 AND mes = $2', [anio, mes]);
    let guardadas = 0;
    for (const f of validas) {
        const diaSiguiente = f.dia_siguiente === true || f.dia_siguiente === 'true';
        await query(
            `INSERT INTO turnos_semanales (anio, mes, dia_semana, turno, hora_inicio, hora_fin, dia_siguiente, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())`,
            [Number(f.anio), Number(f.mes), Number(f.dia_semana), String(f.turno).toLowerCase(),
                String(f.hora_inicio), String(f.hora_fin), diaSiguiente]);
        guardadas++;
    }
    return { guardadas };
}
function diaSeis(d) { return Number.isInteger(d) && d >= 0 && d <= 6; }

module.exports = {
    getEstacionesConCarga,
    getColaPorEstacion,
    getMaquinasPorEstacion,
    iniciarPaso,
    iniciarPasosPorOrden,
    pausarPaso,
    reanudarPaso,
    finalizarPaso,
    finalizarPasosPorPedido,
    procesarPaso,
    registrarMerma,
    registroManual,
    getHorariosTurnos,
    guardarHorariosTurnos,
    getFechaTurno,
    getMermas
};
