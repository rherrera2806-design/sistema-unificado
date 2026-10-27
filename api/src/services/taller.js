const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');
// Require normal: produccionOrdenes.js no requiere taller.js, no hay ciclo
const { sincronizarEstadoOrden } = require('./produccionOrdenes');
// Avance implícito: cierra como terminados los pasos anteriores intactos cuando
// un paso posterior ya se trabaja (no se pule un vidrio sin cortarlo)
const { cerrarPasosAtrasados } = require('./avanceImplicito');

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
                   -- FÓRMULA ESTÁNDAR: kilos/unidades PROPORCIONALES al m2 del
                   -- paso (si no tiene m2_asignado >0, se usa el total de la orden)
                   SUM(CASE WHEN COALESCE(o.metros_cuadrados, 0) > 0
                            THEN COALESCE(o.kilos, 0) * (CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END) / o.metros_cuadrados
                            ELSE COALESCE(o.kilos, 0) END) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_kilos,
                   SUM(COALESCE(p.m2_asignados, (o.ancho::DECIMAL * o.alto / 1000000) * COALESCE(o.cantidad, 1))) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_m2,
                   SUM((o.alto::DECIMAL / 1000) * COALESCE(o.cantidad, 1)) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_ml,
                   SUM(CASE WHEN COALESCE(o.metros_cuadrados, 0) > 0
                            THEN ROUND(COALESCE(o.cantidad, 1) * (CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END) / o.metros_cuadrados)
                            ELSE COALESCE(o.cantidad, 1) END) FILTER (WHERE p.estado IN ('PENDIENTE','EN_PROCESO')) as total_unidades
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
        SELECT p.id, p.estado, p.orden_secuencia, p.hora_inicio, p.hora_fin, p.m2_asignados, p.fecha_programada, p.maquina_id, p.turno,
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
               ROUND(o.cantidad * CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END / NULLIF(o.metros_cuadrados, 0)) as cantidad_paso,
               ROUND(o.kilos * CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END / NULLIF(o.metros_cuadrados, 0), 1) as kilos_paso,
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
            -- 1) Lo que se está trabajando ahora, siempre arriba
            CASE WHEN p.estado = 'EN_PROCESO' THEN 0 ELSE 1 END,
            -- 2) PROGRAMA DIARIO: lo programado primero (sin fecha = al final)
            COALESCE(p.fecha_programada, '2999-12-31') ASC,
            -- 3) TURNO 1 (Noche, que arranca la tarde anterior y se acredita al
            --    día en que termina) antes que TURNO 2 (Día) — MISMO orden que
            --    Prog. por Estación. Sin turno / 'extra' se asume DÍA.
            CASE WHEN LOWER(COALESCE(p.turno, '')) = 'noche' THEN 0 ELSE 1 END,
            -- 4) Trabajo listo para arrancar antes que el bloqueado por su paso anterior
            CASE WHEN p.estado = 'PENDIENTE' AND NOT EXISTS(
                SELECT 1 FROM cola_produccion_pasos prev
                WHERE prev.orden_produccion_id = o.id
                  AND prev.orden_secuencia = p.orden_secuencia - 1
                  AND prev.estado = 'TERMINADO'
            ) AND p.orden_secuencia > 1 THEN 1 ELSE 0 END,
            -- 5) Prioridad: Reposición → Express → Urgencia → Normal
            CASE COALESCE(o.nivel_prioridad, 1) WHEN 4 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 ELSE 4 END ASC,
            -- 6) Espesor: agrupa material y reduce cambios de herramienta
            COALESCE(o.espesor_mm, 0) ASC,
            -- 7) Pedido, item
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[^0-9]', '', 'g'), ''), '0')::BIGINT ASC,
            COALESCE(NULLIF(REGEXP_REPLACE(o.pedido_sap_id, '[0-9]', '', 'g'), ''), '') ASC,
            COALESCE(o.item_numero, 0) ASC,
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

    const upd = await query(`UPDATE cola_produccion_pasos SET ${updates.join(', ')} WHERE id = $${idx} RETURNING orden_produccion_id, orden_secuencia`, params);

    // AVANCE IMPLÍCITO: si pasos anteriores siguen intactos pero este ya se
    // trabaja, es que ocurrieron físicamente (no se pule sin cortar) → se
    // cierran solos, con trazabilidad
    if (upd.rows.length > 0) {
        try {
            await cerrarPasosAtrasados({
                ordenId: upd.rows[0].orden_produccion_id,
                hastaSecuencia: upd.rows[0].orden_secuencia,
                usuarioEmail: operarioEmail,
                usuarioNombre: operarioNombre,
                motivo: `inicio de paso ${upd.rows[0].orden_secuencia}`,
                turno
            });
        } catch (_) { }
    }

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

    // AVANCE IMPLÍCITO: los pasos anteriores intactos se cierran solos — si este
    // paso ya se terminó, los anteriores ocurrieron físicamente (no se pule sin
    // cortar). El "resto" de esta misma estación NO se toca (queda pendiente real)
    try {
        await cerrarPasosAtrasados({
            ordenId: p.orden_produccion_id,
            hastaSecuencia: p.orden_secuencia,
            usuarioEmail: operarioEmail,
            usuarioNombre: operarioNombre,
            motivo: `cierre de paso ${p.orden_secuencia}`
        });
    } catch (_) { }

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
    let pasoSecuenciaMerma = null;
    const resultado = await transaction(async ({ query: txQuery }) => {
        const pasoResult = await txQuery(
            `SELECT p.*, o.cliente, o.vendedor, o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad, o.familia_id, o.kilos, o.espesor_mm, o.pedido_sap_id, o.grupo, o.metros_cuadrados, o.costo_materia_prima, o.nota, o.pintado, o.perforaciones, o.tipo_venta, o.posicion, o.orden_compra, o.tipo_entrega, o.item_numero, o.codigo_padre, o.mecanizado_operaciones
             FROM cola_produccion_pasos p
             JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
             WHERE p.id = $1`,
            [paso_id]
        );
        if (pasoResult.rows.length === 0) return null;
        const p = pasoResult.rows[0];
        ordenAfectadaId = p.orden_produccion_id;
        pasoSecuenciaMerma = p.orden_secuencia;

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
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, vendedor, codigo_producto, descripcion, ancho, alto, metros_cuadrados, cantidad, familia_id, espesor_mm, kilos, estado_programacion, es_reposicion, merma_original_id, pintado, perforaciones, tipo_venta, nota, posicion, orden_compra, tipo_entrega, grupo, item_numero, codigo_padre, mecanizado_operaciones, nivel_prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDIENTE',TRUE,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,4) RETURNING id`,
            [p.pedido_sap_id, p.cliente, p.vendedor || null, p.codigo_producto, '[REPOSICION] ' + (p.descripcion || ''), p.ancho, p.alto, proporcion.m2, cantidadMermada, p.familia_id, p.espesor_mm, proporcion.kilos, mermaId, p.pintado, p.perforaciones, p.tipo_venta, (p.nota || '') + ' | Merma: ' + causa + (observacion ? ' - ' + observacion : ''), p.posicion, p.orden_compra, p.tipo_entrega, p.grupo, p.item_numero, p.codigo_padre, p.mecanizado_operaciones]
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
        // AVANCE IMPLÍCITO: si la merma se registró, los pasos anteriores
        // intactos también ocurrieron físicamente → se cierran solos
        try {
            await cerrarPasosAtrasados({
                ordenId: ordenAfectadaId,
                hastaSecuencia: pasoSecuenciaMerma,
                usuarioEmail: userEmail,
                usuarioNombre: userEmail,
                motivo: 'registro de merma'
            });
        } catch (_) { }
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
                o.pedido_sap_id, o.cliente, o.vendedor, o.codigo_producto, o.descripcion, o.familia_id,
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
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, vendedor, codigo_producto, descripcion, ancho, alto, metros_cuadrados, cantidad, familia_id, espesor_mm, kilos, estado_programacion, grupo, nota, pintado, perforaciones, tipo_venta, posicion, orden_compra, tipo_entrega, item_numero, codigo_padre, mecanizado_operaciones, nivel_prioridad)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'PENDIENTE',$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,COALESCE($24, 1)) RETURNING id`,
            [p.pedido_sap_id, p.cliente, p.vendedor || null, p.codigo_producto, p.descripcion, p.ancho, p.alto, proporcionRestante.m2, cantidadRestante, p.familia_id, p.espesor_mm, proporcionRestante.kilos, p.grupo, p.nota, p.pintado, p.perforaciones, p.tipo_venta, p.posicion, p.orden_compra, p.tipo_entrega, p.item_numero, p.codigo_padre, p.mecanizado_operaciones, p.nivel_prioridad]
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

// Turno actual según las ventanas horarias configuradas (GET horarios).
// Mismo criterio que la web/app: ventanas del día de la semana; fuera de
// ellas = 'extra'. Sin configuración: 06:00-22:00 día, resto noche.
async function getTurnoActual() {
    const respaldo = () => (new Date().getHours() >= 6 && new Date().getHours() < 22) ? 'dia' : 'noche';
    try {
        const horarios = await getHorariosTurnos();
        const ahora = new Date();
        const cfg = (horarios || []).filter(h => Number(h.anio) === ahora.getFullYear() && Number(h.mes) === ahora.getMonth() + 1);
        if (cfg.length) {
            for (let atras = 0; atras <= 1; atras++) {
                const d = new Date(ahora.getTime() - atras * 86400000);
                const diaSemana = d.getDay();
                for (const h of cfg) {
                    if (Number(h.dia_semana) !== diaSemana || !h.hora_inicio || !h.hora_fin) continue;
                    const [hi, mi] = String(h.hora_inicio).split(':').map(Number);
                    const [hf, mf] = String(h.hora_fin).split(':').map(Number);
                    const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi);
                    const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (h.dia_siguiente ? 1 : 0), hf, mf);
                    if (fin > ini && ahora >= ini && ahora < fin) return h.turno;
                }
            }
            return 'extra';
        }
        return respaldo();
    } catch (_) {
        return respaldo();
    }
}

// ============ DASHBOARD DE PLANTA (pantallas en vivo) ============
// Datos agregados para la TV de planta: carga por estación, resumen del día
// y los trabajos urgentes/express/reposición en cola.

async function getDashboard() {
    const [estaciones, resumen, urgencias, enProceso, hoyPorEstacion, incumplidas, ordenesGlobales, produccion] = await Promise.all([
        getEstacionesConCarga(),
        query(`
            SELECT COUNT(*)::int as pasos,
                   COALESCE(SUM(cantidad_real), 0)::int as unidades,
                   COALESCE(SUM(m2_real), 0)::numeric as m2
            FROM cola_produccion_pasos
            WHERE estado = 'TERMINADO'
              -- REGLA: todo se mide POR DÍA (2 turnos por día calendario); el
              -- turno nocturno se acredita al día en que termina (fecha_turno)
              AND COALESCE(fecha_turno, hora_fin::date) = (NOW() AT TIME ZONE 'America/Santiago')::date
        `),
        query(`
            SELECT * FROM (
                SELECT DISTINCT ON (o.id)
                       o.pedido_sap_id, o.item_numero, o.cliente, o.codigo_producto,
                       o.descripcion, o.espesor_mm, o.nivel_prioridad,
                       est.nombre_estacion as estacion,
                       p.fecha_programada
                FROM cola_produccion_pasos p
                JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
                LEFT JOIN estaciones_maestras est ON p.estacion_id = est.id
                WHERE p.estado IN ('PENDIENTE', 'EN_PROCESO')
                  AND COALESCE(o.nivel_prioridad, 1) >= 2
                ORDER BY o.id, p.orden_secuencia
            ) u
            ORDER BY nivel_prioridad DESC, pedido_sap_id
            LIMIT 25
        `),
        query(`
            SELECT p.id, o.pedido_sap_id, o.item_numero, o.codigo_producto, o.cliente,
                   est.nombre_estacion as estacion,
                   ROUND(o.cantidad * CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END / NULLIF(o.metros_cuadrados, 0)) as cantidad_paso
            FROM cola_produccion_pasos p
            JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
            LEFT JOIN estaciones_maestras est ON p.estacion_id = est.id
            WHERE p.estado = 'EN_PROCESO'
            ORDER BY p.hora_inicio NULLS LAST
            LIMIT 12
        `),
        // PENDIENTES POR PRODUCIR por estación en UNIDADES, en 3 cubetas para
        // que los reportes cuadren entre sí:
        //   HOY = fecha_programada == hoy  (igual que Prog. por Estación)
        //   VENCIDO = fecha < hoy o sin fecha (lo atrasado y lo sin programar)
        //   TOTAL = toda la cola
        query(`
            SELECT sub.estacion_id,
                   COALESCE(SUM(sub.cant) FILTER (WHERE sub.cubeta = 'hoy'), 0)::int as hoy_unidades,
                   COALESCE(SUM(sub.kilos) FILTER (WHERE sub.cubeta = 'hoy'), 0)::numeric as hoy_kilos,
                   COALESCE(SUM(sub.cant) FILTER (WHERE sub.cubeta = 'vencido'), 0)::int as venc_unidades,
                   COALESCE(SUM(sub.kilos) FILTER (WHERE sub.cubeta = 'vencido'), 0)::numeric as venc_kilos,
                   COALESCE(SUM(sub.cant), 0)::int as total_unidades,
                   COALESCE(SUM(sub.kilos), 0)::numeric as total_kilos,
                   COUNT(DISTINCT (sub.pedido, sub.item)) FILTER (WHERE sub.cubeta = 'hoy')::int as hoy_ordenes,
                   COUNT(DISTINCT (sub.pedido, sub.item)) FILTER (WHERE sub.cubeta = 'vencido')::int as venc_ordenes,
                   COUNT(DISTINCT (sub.pedido, sub.item))::int as total_ordenes
            FROM (
                SELECT p.estacion_id,
                       p.orden_produccion_id as orden_id,
                       o.pedido_sap_id as pedido,
                       o.item_numero as item,
                       CASE WHEN p.fecha_programada = (NOW() AT TIME ZONE 'America/Santiago')::date THEN 'hoy'
                            WHEN p.fecha_programada IS NULL OR p.fecha_programada < (NOW() AT TIME ZONE 'America/Santiago')::date THEN 'vencido'
                            ELSE 'futuro' END as cubeta,
                       CASE WHEN COALESCE(o.metros_cuadrados, 0) > 0
                            THEN ROUND(o.cantidad * (CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END) / o.metros_cuadrados)
                            ELSE COALESCE(o.cantidad, 1) END as cant,
                       CASE WHEN COALESCE(o.metros_cuadrados, 0) > 0
                            THEN COALESCE(o.kilos, 0) * (CASE WHEN COALESCE(p.m2_asignados, 0) > 0 THEN p.m2_asignados ELSE o.metros_cuadrados END) / o.metros_cuadrados
                            ELSE COALESCE(o.kilos, 0) END as kilos
                FROM cola_produccion_pasos p
                JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
                WHERE p.estado IN ('PENDIENTE', 'EN_PROCESO')
            ) sub
            GROUP BY sub.estacion_id
        `),
        // ÓRDENES COMPROMETIDAS INCUMPLIDAS (decisión 5): VENCIDAS (fecha
        // pactada < hoy) y POR VENCER (pactada = hoy), con el avance real
        // por estación para mostrar "Corte ✅ · Pulido ⏳ · Templado ❌"
        query(`
            SELECT o.pedido_sap_id, o.item_numero, o.cliente, o.nivel_prioridad,
                   o.fecha_entrega_pactada::text as fecha_pactada,
                   (o.fecha_entrega_pactada < (NOW() AT TIME ZONE 'America/Santiago')::date) as vencida,
                   ARRAY_AGG(e.nombre_estacion ORDER BY p.orden_secuencia) as estaciones,
                   ARRAY_AGG(p.estado ORDER BY p.orden_secuencia) as estados
            FROM produccion_ordenes o
            JOIN cola_produccion_pasos p ON p.orden_produccion_id = o.id
            LEFT JOIN estaciones_maestras e ON e.id = p.estacion_id
            WHERE o.fecha_entrega_pactada IS NOT NULL
              AND o.fecha_entrega_pactada <= (NOW() AT TIME ZONE 'America/Santiago')::date
              AND o.estado_programacion NOT IN ('TERMINADO', 'CERRADO')
            GROUP BY o.pedido_sap_id, o.item_numero, o.cliente, o.nivel_prioridad, o.fecha_entrega_pactada
            HAVING COUNT(p.id) FILTER (WHERE p.estado NOT IN ('TERMINADO', 'MERMADO')) > 0
            ORDER BY o.fecha_entrega_pactada
            LIMIT 40
        `),
        query(`
            SELECT COUNT(DISTINCT (sub.pedido, sub.item)) FILTER (WHERE sub.cubeta = 'hoy')::int as hoy_ordenes,
                   COUNT(DISTINCT (sub.pedido, sub.item)) FILTER (WHERE sub.cubeta = 'vencido')::int as venc_ordenes,
                   COUNT(DISTINCT (sub.pedido, sub.item))::int as total_ordenes
            FROM (
                SELECT p.orden_produccion_id as orden_id,
                       o.pedido_sap_id as pedido,
                       o.item_numero as item,
                       CASE WHEN p.fecha_programada = (NOW() AT TIME ZONE 'America/Santiago')::date THEN 'hoy'
                            WHEN p.fecha_programada IS NULL OR p.fecha_programada < (NOW() AT TIME ZONE 'America/Santiago')::date THEN 'vencido'
                            ELSE 'futuro' END as cubeta
                FROM cola_produccion_pasos p
                JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
                WHERE p.estado IN ('PENDIENTE', 'EN_PROCESO')
            ) sub
        `),
        // PRODUCIDO por estación: del día y del turno actual (unidades, m², kilos).
        // REGLA: 1 día calendario = 2 turnos (día y noche) y todo se mide POR DÍA;
        // el turno nocturno se acredita al día en que TERMINA (fecha_turno).
        (async () => {
            const turnoActual = await getTurnoActual();
            const prod = await query(`
                SELECT p.estacion_id,
                       COALESCE(SUM(p.cantidad_real), 0)::int as hoy_unidades,
                       COALESCE(SUM(p.m2_real), 0)::numeric as hoy_m2,
                       COALESCE(SUM(o.kilos * p.cantidad_real / NULLIF(o.cantidad, 0)), 0)::numeric as hoy_kilos,
                       COALESCE(SUM(p.cantidad_real) FILTER (WHERE LOWER(COALESCE(p.turno, '')) = $1), 0)::int as turno_unidades,
                       COALESCE(SUM(p.m2_real) FILTER (WHERE LOWER(COALESCE(p.turno, '')) = $1), 0)::numeric as turno_m2,
                       COALESCE(SUM(o.kilos * p.cantidad_real / NULLIF(o.cantidad, 0)) FILTER (WHERE LOWER(COALESCE(p.turno, '')) = $1), 0)::numeric as turno_kilos
                FROM cola_produccion_pasos p
                JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
                WHERE p.estado = 'TERMINADO'
                  AND COALESCE(p.fecha_turno, p.hora_fin::date) = (NOW() AT TIME ZONE 'America/Santiago')::date
                GROUP BY p.estacion_id
            `, [String(turnoActual).toLowerCase()]);
            return { turnoActual, rows: prod.rows };
        })()
    ]);
    const prodMap = new Map((produccion.rows || []).map(r => [Number(r.estacion_id), r]));
    const hoyMap = new Map(hoyPorEstacion.rows.map(r => [Number(r.estacion_id), r]));
    const ests = estaciones.map(e => {
        const h = hoyMap.get(Number(e.id)) || {};
        const pr = prodMap.get(Number(e.id)) || {};
        return {
            ...e,
            hoy_pendientes: Number(h.hoy_unidades) || 0,
            hoy_en_proceso: 0,
            hoy_kilos: Number(h.hoy_kilos) || 0,
            venc_pendientes: Number(h.venc_unidades) || 0,
            venc_kilos: Number(h.venc_kilos) || 0,
            total_unidades_pend: Number(h.total_unidades) || 0,
            total_kilos_pend: Number(h.total_kilos) || 0,
            hoy_ordenes: Number(h.hoy_ordenes) || 0,
            venc_ordenes: Number(h.venc_ordenes) || 0,
            total_ordenes: Number(h.total_ordenes) || 0,
            prod_hoy: {
                unidades: Number(pr.hoy_unidades) || 0,
                m2: Number(pr.hoy_m2) || 0,
                kilos: Number(pr.hoy_kilos) || 0
            },
            prod_turno: {
                unidades: Number(pr.turno_unidades) || 0,
                m2: Number(pr.turno_m2) || 0,
                kilos: Number(pr.turno_kilos) || 0
            }
        };
    });
    return {
        estaciones: ests,
        turno_actual: produccion.turnoActual || 'dia',
        ordenes: {
            hoy: Number(ordenesGlobales.rows[0] && ordenesGlobales.rows[0].hoy_ordenes) || 0,
            vencido: Number(ordenesGlobales.rows[0] && ordenesGlobales.rows[0].venc_ordenes) || 0,
            total: Number(ordenesGlobales.rows[0] && ordenesGlobales.rows[0].total_ordenes) || 0
        },
        // KPI de CUMPLIMIENTO: % de órdenes rígidas terminadas dentro de su
        // ventana (Repo 2 días / Express-Urgencia 3 días hábiles desde ingreso)
        cumplimiento: await require('./reprogramarService').getCumplimiento(),
        // Desvío del programa: VENCIDAS (pactada < hoy) y POR VENCER (pactada =
        // hoy) con avance por estación — la app avisa y ofrece reprogramar
        desvio: (() => {
            const faltanHoy = ests.reduce((a, e) => a + Number(e.hoy_pendientes || 0), 0);
            const vencidas = ests.reduce((a, e) => a + Number(e.venc_pendientes || 0), 0);
            const producido = Number((resumen.rows[0] && resumen.rows[0].unidades) || 0);
            const programado = faltanHoy + producido;
            const filas = (incumplidas && incumplidas.rows) || [];
            const arma = (r) => ({
                pedido: r.pedido_sap_id,
                item: r.item_numero,
                cliente: r.cliente,
                prioridad: Number(r.nivel_prioridad) || 1,
                fecha_pactada: String(r.fecha_pactada || '').slice(0, 10),
                avance: (r.estaciones || []).map((est, i) => ({
                    estacion: est,
                    estado: (r.estados || [])[i]
                }))
            });
            return {
                cumplimiento: programado > 0 ? Math.round((producido / programado) * 100) : 100,
                faltan_und: faltanHoy,
                vencidas_und: vencidas,
                producido_und: producido,
                programado_und: programado,
                vencidas: filas.filter(r => r.vencida).map(arma),
                por_vencer: filas.filter(r => !r.vencida).map(arma)
            };
        })(),
        resumen_hoy: resumen.rows[0] || { pasos: 0, unidades: 0, m2: 0 },
        urgencias: urgencias.rows,
        en_proceso: enProceso.rows,
        ts: Date.now()
    };
}

module.exports = {
    getEstacionesConCarga,
    getDashboard,
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
