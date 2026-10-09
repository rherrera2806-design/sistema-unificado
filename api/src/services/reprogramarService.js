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
    // NOTA: NO se toca fecha_entrega_pactada; es una fecha pactada (puede haberse
    // cargado a mano) y no depende de la programación diaria. Antes se ponía en
    // NULL para todas las órdenes PROGRAMADO y se perdían pactos manuales.
    const liberar = await query(`
        UPDATE produccion_ordenes
        SET estado_programacion = 'PENDIENTE',
            fecha_programada = NULL
        WHERE estado_programacion = 'PROGRAMADO'
        RETURNING id
    `);
    const ordenesLiberadas = liberar.rowCount;
    const idsLiberadas = liberar.rows.map(r => r.id);

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
