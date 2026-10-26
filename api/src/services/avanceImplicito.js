// ===== AVANCE IMPLÍCITO =====
// Regla del negocio (confirmada): no se pule un vidrio sin cortarlo. Si un paso
// POSTERIOR de la misma orden ya avanzó (EN_PROCESO / PAUSADO / TERMINADO /
// MERMADO), los pasos anteriores INTACTOS tuvieron que ocurrir físicamente y
// se cierran automáticamente como TERMINADO, con trazabilidad, para que el
// sistema quede sincronizado con el piso.
// SEGURIDAD: solo se cierra lo JAMÁS tocado (PENDIENTE, sin horas, sin cantidad
// registrada). Todo paso con trabajo real registrado queda intacto — esto solo
// elimina el "trabajo fantasma" que ensuciaba la planificación, los KPI y las
// fechas pactadas.
const { query } = require('../config/database');
const { sincronizarEstadoOrden } = require('./produccionOrdenes');

/**
 * Cierra como TERMINADO los pasos intactos que quedaron "atrás" del avance real.
 * - ordenId: limita a una orden (al iniciar/finalizar un paso en Taller)
 * - hastaSecuencia: solo pasos anteriores a esa secuencia (el paso que dispara)
 * - Sin parámetros: barrido global (lo usan los motores de reprogramación)
 * Devuelve { cerrados, pasos } con lo cerrado.
 */
async function cerrarPasosAtrasados({
    ordenId = null,
    hastaSecuencia = null,
    usuarioEmail = null,
    usuarioNombre = null,
    motivo = 'avance',
    fechaTurno = null,
    turno = null
} = {}) {
    const params = [ordenId, hastaSecuencia, usuarioEmail, usuarioNombre, fechaTurno, turno];
    const upd = await query(`
        UPDATE cola_produccion_pasos p SET
            estado = 'TERMINADO',
            hora_inicio = COALESCE(p.hora_inicio, NOW()),
            hora_fin = NOW(),
            -- Cierre con las cantidades PROPIAS del paso (la misma proporción
            -- que usa finalizarPaso): el trabajo físico se hizo, solo faltó el registro
            cantidad_real = COALESCE(p.cantidad_real,
                COALESCE(ROUND(o.cantidad * COALESCE(NULLIF(p.m2_asignados, 0), o.metros_cuadrados, 0) / NULLIF(o.metros_cuadrados, 0)), o.cantidad, 1)),
            m2_real = COALESCE(p.m2_real,
                COALESCE(NULLIF(p.m2_asignados, 0), o.metros_cuadrados, 0)),
            fecha_turno = COALESCE(p.fecha_turno, $5::date, (NOW() AT TIME ZONE 'America/Santiago')::date),
            turno = COALESCE(p.turno, $6),
            operario_email = COALESCE($3, p.operario_email),
            operario_nombre = COALESCE($4, p.operario_nombre)
        FROM produccion_ordenes o
        WHERE p.orden_produccion_id = o.id
          AND p.estado = 'PENDIENTE'
          AND p.hora_inicio IS NULL
          AND p.hora_fin IS NULL
          AND p.cantidad_real IS NULL
          AND p.m2_real IS NULL
          AND ($1::int IS NULL OR p.orden_produccion_id = $1)
          AND ($2::int IS NULL OR p.orden_secuencia < $2)
          AND EXISTS (
              SELECT 1 FROM cola_produccion_pasos p2
              WHERE p2.orden_produccion_id = p.orden_produccion_id
                AND p2.orden_secuencia > p.orden_secuencia
                AND (p2.estado <> 'PENDIENTE' OR p2.hora_inicio IS NOT NULL OR p2.hora_fin IS NOT NULL)
          )
        RETURNING p.id, p.orden_produccion_id, p.orden_secuencia, p.estacion_id
    `, params);

    const pasos = upd.rows || [];
    // Trazabilidad: por qué se cerró cada paso
    for (const pz of pasos) {
        try {
            await query(
                `INSERT INTO taller_historial (entidad_tipo, entidad_id, accion, datos_nuevos, usuario_email, usuario_nombre)
                 VALUES ('paso', $1, 'auto_cierre_avance', jsonb_build_object('motivo', $2::text), $3, $4)`,
                [pz.id, motivo, usuarioEmail, usuarioNombre]
            );
        } catch (_) { }
    }
    // El estado de cada orden afectada se deriva del avance de sus pasos
    const ordenes = [...new Set(pasos.map(p => p.orden_produccion_id))];
    for (const oid of ordenes) {
        try { await sincronizarEstadoOrden(oid); } catch (_) { }
    }
    return { cerrados: pasos.length, pasos };
}

module.exports = { cerrarPasosAtrasados };
