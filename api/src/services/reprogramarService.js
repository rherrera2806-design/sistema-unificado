const { query } = require('../config/database');
const { autoAsignarPendientes } = require('./planificacionAuto');

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  REPROGRAMAR PENDIENTES — Wipe & Re-run                       ║
 * ║  Paso A: Liberar órdenes PROGRAMADO → PENDIENTE (solo las que  ║
 * ║          NO están en proceso/terminadas/mermadas)              ║
 * ║  Paso B: Re-ejecutar auto-asignar con Priority Queue 4→1      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * REGLA DE ORO: NUNCA tocar órdenes con estado EN PROCESO, MERMADO o TERMINADO.
 * Solo se liberan las que están PROGRAMADO (asignadas a fecha pero aún no iniciadas).
 */
async function reprogramarPendientes({ dias = 21, inicio } = {}) {
    // Fecha mínima en hora local (toISOString usa UTC y a la noche cambiaba el día)
    const fechaMinima = inicio || (() => {
        const h = new Date();
        return h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') + '-' + String(h.getDate()).padStart(2, '0');
    })();

    // ═══════════════════════════════════════════════════════════════
    // PASO A: LIBERACIÓN — Soltar TODO lo programable → PENDIENTE
    // ═══════════════════════════════════════════════════════════════
    // Se suelta TODO excepto EN PROCESO, MERMADO, TERMINADO y CERRADO
    // (antes solo se soltaban las PROGRAMADO y se escapaban órdenes con fecha
    // asignada en otro estado: quedaban sin re-ordenar por prioridad).
    // NOTA: NO se toca fecha_entrega_pactada; es una fecha pactada (puede haberse
    // cargado a mano) y no depende de la programación diaria. Antes se ponía en
    // NULL para todas las órdenes PROGRAMADO y se perdían pactos manuales.
    const liberar = await query(`
        UPDATE produccion_ordenes
        SET estado_programacion = 'PENDIENTE',
            fecha_programada = NULL
        WHERE estado_programacion NOT IN ('EN_PROCESO', 'TERMINADO', 'MERMADO', 'CERRADO')
          AND (estado_programacion = 'PROGRAMADO' OR fecha_programada IS NOT NULL)
        RETURNING id
    `);
    const ordenesLiberadas = liberar.rowCount;
    const idsLiberadas = liberar.rows.map(r => r.id);

    // REGLA: los días laborales se definen en Configuración → Calendario
    // (mes a mes); NO solo saltar sáb/dom. Ver services/calendario.js
    const calendario = require('./calendario');
    const sigHabil = (f) => calendario.siguienteDiaHabil(f);

    // ═══════════════════════════════════════════════════════════════
    // PASO A2: SINCRONIZAR RUTAS CON LA RECETA ACTUAL
    // ═══════════════════════════════════════════════════════════════
    // Si cambió la receta de un código (sus estaciones de paso), las órdenes
    // sin trabajar se quedaban con la ruta vieja. Se regeneran sus pasos desde
    // procesos_especificos_json SOLO cuando la receta define estaciones que la
    // ruta actual NO tiene; si la ruta actual ya las incluye (pasos agregados a
    // mano), se respeta. Nunca se tocan órdenes con pasos ya trabajados.
    let rutasActualizadas = 0;
    try {
        const recMap = {};
        for (const tabla of ['recetas_bom', 'produccion_recetas_bom']) {
            try {
                const rr = await query(`SELECT codigo_sap_padre, procesos_especificos_json FROM ${tabla} WHERE procesos_especificos_json IS NOT NULL`);
                for (const r of rr.rows) {
                    const k = String(r.codigo_sap_padre || '').trim().toLowerCase();
                    if (k && !recMap[k]) recMap[k] = r.procesos_especificos_json;
                }
            } catch (_) { }
        }
        const candRes = await query(`
            SELECT o.id, COALESCE(o.codigo_padre, o.codigo_producto) as codigo
            FROM produccion_ordenes o
            WHERE o.estado_programacion NOT IN ('EN_PROCESO','TERMINADO','MERMADO','CERRADO')`);
        for (const o of candRes.rows) {
            const ruta = recMap[String(o.codigo || '').trim().toLowerCase()];
            if (!Array.isArray(ruta) || !ruta.length) continue;
            const ids = ruta.map(x => Number(typeof x === 'object' ? (x.estacion_id || x.id) : x)).filter(Boolean);
            if (!ids.length) continue;
            const act = await query('SELECT estacion_id, estado, hora_inicio, hora_fin FROM cola_produccion_pasos WHERE orden_produccion_id = $1 ORDER BY orden_secuencia', [o.id]);
            if (act.rows.some(p => p.estado !== 'PENDIENTE' || p.hora_inicio || p.hora_fin)) continue;
            const actuales = act.rows.map(p => Number(p.estacion_id));
            if (ids.every(id => actuales.includes(id))) continue; // la receta ya está contemplada
            await query(`DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1 AND estado = 'PENDIENTE' AND hora_inicio IS NULL AND hora_fin IS NULL`, [o.id]);
            for (let i = 0; i < ids.length; i++) {
                await query(`INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,'PENDIENTE')`, [o.id, ids[i], i + 1]);
            }
            rutasActualizadas++;
        }
    } catch (_) { }

    // Limpiar las fechas SOLO en los pasos de las órdenes recién liberadas (antes
    // se limpiaban pasos de cualquier orden PENDIENTE con fecha_programada NULL en
    // la orden, incluidas órdenes ajenas a esta reprogramación). Se conserva lo ya
    // trabajado: no se tocan pasos con horas reales ni con estado avanzado.
    if (idsLiberadas.length > 0) {
        await query(`
            UPDATE cola_produccion_pasos
            SET fecha_programada = NULL, m2_asignados = 0
            WHERE orden_produccion_id = ANY($1)
              AND estado = 'PENDIENTE'
              AND hora_inicio IS NULL AND hora_fin IS NULL
        `, [idsLiberadas]);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO B: RE-ASIGNACIÓN — Ejecutar auto-asignar con Priority Queue
    // ═══════════════════════════════════════════════════════════════
    const resultado = await autoAsignarPendientes({ dias, inicio: fechaMinima });

    // ═══════════════════════════════════════════════════════════════
    // PASO C: PASOS PENDIENTES SIN FECHA (agregados a mano, o de órdenes
    // protegidas como EN PROCESO) → fecha en cascada, al menos un día hábil
    // después del último paso ya programado de la misma orden.
    // ═══════════════════════════════════════════════════════════════
    let pasosFechados = 0;
    const baseMap = {};
    try {
        const baseRes = await query(`
            SELECT orden_produccion_id, to_char(MAX(fecha_programada), 'YYYY-MM-DD') as ultima
            FROM cola_produccion_pasos WHERE fecha_programada IS NOT NULL
            GROUP BY orden_produccion_id`);
        for (const r of baseRes.rows) baseMap[r.orden_produccion_id] = r.ultima;
        const sinFecha = await query(`
            SELECT p.id, p.orden_produccion_id
            FROM cola_produccion_pasos p
            JOIN produccion_ordenes o ON o.id = p.orden_produccion_id
            WHERE p.estado = 'PENDIENTE' AND p.fecha_programada IS NULL
              AND p.hora_inicio IS NULL AND p.hora_fin IS NULL
              AND o.estado_programacion NOT IN ('TERMINADO','MERMADO','CERRADO')
            ORDER BY p.orden_produccion_id, p.orden_secuencia`);
        for (const p of sinFecha.rows) {
            const ultima = baseMap[p.orden_produccion_id];
            const base = (ultima && ultima >= fechaMinima) ? ultima : fechaMinima;
            const fs = await sigHabil(base);
            await query('UPDATE cola_produccion_pasos SET fecha_programada = $1 WHERE id = $2', [fs, p.id]);
            baseMap[p.orden_produccion_id] = fs;
            pasosFechados++;
        }
    } catch (_) { }

    // Limpiar flag de necesidad de reprogramación
    await query('UPDATE produccion_ordenes SET needs_reprogramming = FALSE WHERE needs_reprogramming = TRUE');

    return {
        ordenes_liberadas: ordenesLiberadas,
        rutas_actualizadas: rutasActualizadas,
        pasos_fechados: pasosFechados,
        asignados: resultado.asignados,
        noAsignados: resultado.noAsignados,
        total_procesados: resultado.total_procesados,
        mensaje: `Se liberaron ${ordenesLiberadas} órdenes, se actualizaron ${rutasActualizadas} rutas desde la receta, se fecharon ${pasosFechados} pasos sueltos y se re-asignaron ${resultado.asignados.length} de ${resultado.total_procesados} pendientes`
    };
}

module.exports = { reprogramarPendientes };
