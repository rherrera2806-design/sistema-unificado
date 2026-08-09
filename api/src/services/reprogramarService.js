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
    const fechaMinima = inicio || new Date().toISOString().split('T')[0];

    // ═══════════════════════════════════════════════════════════════
    // PASO A: LIBERACIÓN — Resetear PROGRAMADO → PENDIENTE
    // ═══════════════════════════════════════════════════════════════
    // Solo tocar órdenes PROGRAMADO. NUNCA EN PROCESO, MERMADO, TERMINADO.
    const liberar = await query(`
        UPDATE produccion_ordenes
        SET estado_programacion = 'PENDIENTE',
            fecha_programada = NULL,
            fecha_entrega_pactada = NULL
        WHERE estado_programacion = 'PROGRAMADO'
    `);
    const ordenesLiberadas = liberar.rowCount;

    // También limpiar las fechas en cola_produccion_pasos de las órdenes liberadas
    if (ordenesLiberadas > 0) {
        await query(`
            UPDATE cola_produccion_pasos cp
            SET fecha_programada = NULL, m2_asignados = 0
            FROM produccion_ordenes o
            WHERE cp.orden_produccion_id = o.id
              AND o.estado_programacion = 'PENDIENTE'
              AND o.fecha_programada IS NULL
        `);
    }

    // ═══════════════════════════════════════════════════════════════
    // PASO B: RE-ASIGNACIÓN — Ejecutar auto-asignar con Priority Queue
    // ═══════════════════════════════════════════════════════════════
    const resultado = await autoAsignarPendientes({ dias, inicio: fechaMinima });

    // Limpiar flag de necesidad de reprogramación
    await query('UPDATE produccion_ordenes SET needs_reprogramming = FALSE WHERE needs_reprogramming = TRUE');

    return {
        ordenes_liberadas: ordenesLiberadas,
        asignados: resultado.asignados,
        noAsignados: resultado.noAsignados,
        total_procesados: resultado.total_procesados,
        mensaje: `Se liberaron ${ordenesLiberadas} órdenes programadas y se re-asignaron ${resultado.asignados.length} de ${resultado.total_procesados} pendientes`
    };
}

module.exports = { reprogramarPendientes };
