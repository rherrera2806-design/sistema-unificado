const { query } = require('../config/database');
const { getCalendarioMap, esLaboral } = require('./planificacionCalendario');

const getPendientes = async () => {
    const result = await query(`
        SELECT o.*,
            (SELECT COUNT(*) FROM cola_produccion_pasos p WHERE p.orden_produccion_id = o.id) as total_pasos,
            (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto) as nombre_mp
        FROM produccion_ordenes o
        WHERE o.estado_programacion = 'PENDIENTE'
        ORDER BY o.created_at ASC
    `);
    return result.rows;
};

const fmtDateLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const programarOrden = async (orden_id, fecha_entrega_propuesta) => {
    const ordenRes = await query('SELECT * FROM produccion_ordenes WHERE id = $1', [orden_id]);
    if (ordenRes.rows.length === 0) throw new Error('Orden no encontrada');
    const orden = ordenRes.rows[0];
    if (orden.estado_programacion !== 'PENDIENTE') throw new Error('La orden ya esta programada');

    const pasosRes = await query(`
        SELECT p.*, e.orden_secuencia_defecto
        FROM cola_produccion_pasos p
        JOIN estaciones_maestras e ON p.estacion_id = e.id
        WHERE p.orden_produccion_id = $1
        ORDER BY p.orden_secuencia
    `, [orden_id]);
    const pasos = pasosRes.rows;
    if (pasos.length === 0) throw new Error('La orden no tiene pasos definidos');

    const m2 = Number(orden.metros_cuadrados) || 0;
    const calendarioMap = await getCalendarioMap();
    const calMapSimple = {};
    for (const k of Object.keys(calendarioMap)) calMapSimple[k] = calendarioMap[k].es_laboral;

    const esDiaLaboral = (fStr) => {
        if (calMapSimple.hasOwnProperty(fStr)) return calMapSimple[fStr];
        const d = new Date(fStr + 'T12:00:00');
        return d.getDay() !== 0 && d.getDay() !== 6;
    };
    const diaSiguienteLaboral = (fecha) => {
        const d = new Date(fecha);
        do { d.setDate(d.getDate() + 1); } while (!esDiaLaboral(fmtDateLocal(d)));
        return d;
    };

    const fechaInicio = new Date();
    fechaInicio.setHours(0, 0, 0, 0);
    if (!esDiaLaboral(fmtDateLocal(fechaInicio))) {
        fechaInicio.setTime(diaSiguienteLaboral(fechaInicio).getTime());
    }

    const capEstaciones = {};
    for (const paso of pasos) {
        if (paso.estacion_id && !capEstaciones[paso.estacion_id]) {
            const capRes = await query('SELECT capacidad_max_m2_dia FROM estaciones_maestras WHERE id = $1', [paso.estacion_id]);
            capEstaciones[paso.estacion_id] = Number(capRes.rows[0]?.capacidad_max_m2_dia) || 100;
        }
    }

    const asignaciones = [];
    for (const paso of pasos) {
        const estacionId = paso.estacion_id;
        if (!estacionId) continue;
        const capacidad = capEstaciones[estacionId];
        let m2Restante = m2;
        let fechaCursor = new Date(fechaInicio);
        let intentos = 0;

        while (m2Restante > 0.01 && intentos < 90) {
            intentos++;
            const fechaStr = fmtDateLocal(fechaCursor);
            const cargaRes = await query(`
                SELECT COALESCE(SUM(p.m2_asignados), 0) as m2_ocupados
                FROM cola_produccion_pasos p
                WHERE p.estacion_id = $1 AND p.fecha_programada = $2
                AND p.estado != 'MERMADO' AND p.orden_produccion_id != $3
            `, [estacionId, fechaStr, orden_id]);
            const disponible = Math.max(0, capacidad - (Number(cargaRes.rows[0]?.m2_ocupados) || 0));

            if (disponible <= 0) {
                fechaCursor.setTime(diaSiguienteLaboral(fechaCursor).getTime());
                continue;
            }

            const m2Asignar = Math.min(m2Restante, disponible);
            asignaciones.push({ paso_id: paso.id, estacion_id: estacionId, fecha: fechaStr, m2: m2Asignar });
            m2Restante -= m2Asignar;

            if (m2Restante > 0.01) {
                fechaCursor.setTime(diaSiguienteLaboral(fechaCursor).getTime());
            }
        }
    }

    const pasosActualizados = new Set();
    for (const a of asignaciones) {
        if (!pasosActualizados.has(a.paso_id)) {
            await query('UPDATE cola_produccion_pasos SET fecha_programada = $1, m2_asignados = $2 WHERE id = $3', [a.fecha, a.m2, a.paso_id]);
            pasosActualizados.add(a.paso_id);
        } else {
            const pasoOrig = await query('SELECT * FROM cola_produccion_pasos WHERE id = $1', [a.paso_id]);
            if (pasoOrig.rows.length > 0) {
                const p = pasoOrig.rows[0];
                await query(
                    "INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado, fecha_programada, m2_asignados) VALUES ($1, $2, $3, 'PENDIENTE', $4, $5)",
                    [p.orden_produccion_id, a.estacion_id, p.orden_secuencia, a.fecha, a.m2]
                );
            }
        }
    }

    const fechaFinal = fecha_entrega_propuesta || (asignaciones.length > 0 ? asignaciones.reduce((max, a) => a.fecha > max ? a.fecha : max, asignaciones[0].fecha) : null);
    await query('UPDATE produccion_ordenes SET estado_programacion = $1, fecha_entrega_pactada = $2 WHERE id = $3', ['PROGRAMADO', fechaFinal, orden_id]);

    return { asignaciones, fechaFinal };
};

const { getCalendario, marcarDia, eliminarDia } = require('./planificacionCalendario');
const { getCargaSemanal, getCargaPorGrupo, getCargaEstaciones, getCapacidadGrupo, actualizarCapacidadGrupo } = require('./planificacionCapacidad');

module.exports = {
    getCalendario,
    marcarDia,
    eliminarDia,
    getCalendarioMap,
    esLaboral,
    getCargaSemanal,
    getCargaPorGrupo,
    getCargaEstaciones,
    getPendientes,
    programarOrden,
    getCapacidadGrupo,
    actualizarCapacidadGrupo
};
