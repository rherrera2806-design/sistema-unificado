const { query } = require('../config/database');

// Calendario de producción y consultas de planificación

// ============ CALENDARIO ============

const getCalendario = async () => {
    const result = await query('SELECT * FROM calendario_produccion ORDER BY fecha ASC');
    return result.rows;
};

const marcarDia = async ({ fecha, es_laboral, motivo }) => {
    const existing = await query('SELECT id FROM calendario_produccion WHERE fecha = $1', [fecha]);
    if (existing.rows.length > 0) {
        await query('UPDATE calendario_produccion SET es_laboral = $1, motivo = $2 WHERE fecha = $3', [es_laboral !== false, motivo || '', fecha]);
    } else {
        await query('INSERT INTO calendario_produccion (fecha, es_laboral, motivo) VALUES ($1, $2, $3)', [fecha, es_laboral !== false, motivo || '']);
    }
};

const eliminarDia = async (id) => {
    await query('DELETE FROM calendario_produccion WHERE id = $1', [id]);
};

// ============ HELPERS DE CALENDARIO ============

const getCalendarioMap = async (inicio, fin) => {
    const calMap = {};
    try {
        const sql = inicio && fin
            ? query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral, motivo FROM calendario_produccion WHERE fecha >= $1::date AND fecha <= $2::date`, [inicio, fin])
            : query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral, motivo FROM calendario_produccion`);
        const calRes = await sql;
        for (const c of calRes.rows) calMap[c.fs] = { es_laboral: c.es_laboral, motivo: c.motivo };
    } catch (e) { /* calendario opcional */ }
    return calMap;
};

const esLaboral = (calMap, fStr) => {
    if (calMap.hasOwnProperty(fStr)) return calMap[fStr].es_laboral;
    const d = new Date(fStr + 'T12:00:00');
    return d.getDay() !== 0 && d.getDay() !== 6;
};

// ============ CARGA SEMANAL (por estación) ============

const getCargaSemanal = async (inicio, fin) => {
    const estRes = await query('SELECT id, nombre_estacion, orden_secuencia_defecto, capacidad_max_m2_dia FROM estaciones_maestras WHERE activa = TRUE ORDER BY orden_secuencia_defecto');
    const estaciones = estRes.rows || [];

    const cargaMap = {};
    try {
        const cargaRes = await query(
            `SELECT p.estacion_id, to_char(p.fecha_programada, 'YYYY-MM-DD') as fs,
             COALESCE(SUM(p.m2_asignados), 0) as m2, COUNT(*) as oc
             FROM cola_produccion_pasos p
             WHERE p.fecha_programada >= $1::date AND p.fecha_programada <= $2::date AND p.estado <> 'MERMADO'
             GROUP BY p.estacion_id, p.fecha_programada`, [inicio, fin]
        );
        for (const r of cargaRes.rows) cargaMap[r.estacion_id + '|' + r.fs] = { m2: Number(r.m2), ordenes: Number(r.oc) };
    } catch (e) { console.error('carga query err:', e.message); }

    const calendarioMap = await getCalendarioMap(inicio, fin);

    return estaciones.map(e => {
        const dias = [];
        const p = inicio.split('-');
        for (let i = 0; i < 14; i++) {
            const dt = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]) + i);
            const fs = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
            const cap = Number(e.capacidad_max_m2_dia) || 100;
            const datos = cargaMap[e.id + '|' + fs] || { m2: 0, ordenes: 0 };
            const laboral = esLaboral(calendarioMap, fs);
            const cal = calendarioMap[fs];
            dias.push({
                fecha: fs,
                m2: laboral ? datos.m2 : 0,
                ordenes: laboral ? datos.ordenes : 0,
                capacidad: cap,
                pct_ocupacion: laboral && cap > 0 ? Math.round((datos.m2 / cap) * 100) : 0,
                es_laboral: laboral,
                motivo: cal ? cal.motivo : ''
            });
        }
        return { estacion_id: e.id, nombre: e.nombre_estacion, orden: e.orden_secuencia_defecto, capacidad_dia: Number(e.capacidad_max_m2_dia) || 100, dias };
    });
};

// ============ CARGA POR GRUPO ============

const getCargaPorGrupo = async (inicio, fin) => {
    const calMap = await getCalendarioMap(inicio, fin);

    const cargaRes = await query(`
        SELECT COALESCE(o.grupo, '(sin grupo)') as nombre_familia,
            o.fecha_programada::text as fecha,
            COALESCE(SUM(o.kilos), 0) as kilos
        FROM produccion_ordenes o
        WHERE o.fecha_programada BETWEEN $1 AND $2
          AND o.estado_programacion NOT IN ('CERRADO','TERMINADO')
          AND o.kilos > 0
        GROUP BY o.grupo, o.fecha_programada
        ORDER BY o.fecha_programada, o.grupo
    `, [inicio, fin]);

    const capRes = await query(`
        SELECT o.fecha_programada::text as fecha,
            COALESCE(SUM(pg.capacidad_kg_dia), 0) as capacidad_total
        FROM (
            SELECT DISTINCT fecha_programada FROM produccion_ordenes
            WHERE fecha_programada BETWEEN $1 AND $2
              AND estado_programacion NOT IN ('CERRADO','TERMINADO')
        ) o
        CROSS JOIN produccion_capacidad_grupo pg
        WHERE pg.activo = TRUE
        GROUP BY o.fecha_programada
    `, [inicio, fin]);

    const capMap = {};
    for (const r of capRes.rows) capMap[r.fecha] = Number(r.capacidad_total);

    const familiasMap = {};
    const fechasSet = new Set();
    for (const r of cargaRes.rows) {
        if (!esLaboral(calMap, r.fecha)) continue;
        if (!familiasMap[r.nombre_familia]) familiasMap[r.nombre_familia] = {};
        familiasMap[r.nombre_familia][r.fecha] = Number(r.kilos);
        fechasSet.add(r.fecha);
    }

    const inicioD = new Date(inicio + 'T00:00:00');
    const finD = new Date(fin + 'T00:00:00');
    for (let d = new Date(inicioD); d <= finD; d.setDate(d.getDate() + 1)) {
        const fs = d.toISOString().split('T')[0];
        if (esLaboral(calMap, fs)) fechasSet.add(fs);
    }

    for (const fam of Object.keys(familiasMap)) {
        for (const fs of fechasSet) {
            if (familiasMap[fam][fs] === undefined) familiasMap[fam][fs] = 0;
        }
    }

    return {
        familias: Object.keys(familiasMap),
        fechas: Array.from(fechasSet).sort(),
        datos: familiasMap,
        capacidad_por_dia: capMap
    };
};

// ============ CARGA ESTACIONES ============

const getCargaEstaciones = async (inicio, fin) => {
    const estRes = await query(`
        SELECT id, nombre_estacion, orden_secuencia_defecto, capacidad_max_m2_dia, es_cuello_botella
        FROM estaciones_maestras WHERE activa = TRUE
        ORDER BY orden_secuencia_defecto
    `);

    const cargaRes = await query(`
        SELECT cp.estacion_id, to_char(cp.fecha_programada, 'YYYY-MM-DD') as fs,
               COALESCE(SUM(cp.m2_asignados), 0) as m2_total, COUNT(*) as ordenes
        FROM cola_produccion_pasos cp
        WHERE cp.fecha_programada >= $1::date AND cp.fecha_programada <= $2::date
          AND cp.estado != 'MERMADO'
        GROUP BY cp.estacion_id, cp.fecha_programada
    `, [inicio, fin]);

    const calendarioMap = await getCalendarioMap(inicio, fin);

    const estaciones = estRes.rows.map(e => ({
        id: e.id,
        nombre: e.nombre_estacion,
        orden: e.orden_secuencia_defecto,
        capacidad_m2_dia: Number(e.capacidad_max_m2_dia) || 100,
        es_cuello_botella: e.es_cuello_botella
    }));

    const carga = {};
    cargaRes.rows.forEach(r => {
        if (!carga[r.fs]) carga[r.fs] = {};
        const laboral = esLaboral(calendarioMap, r.fs);
        carga[r.fs][r.estacion_id] = {
            m2: laboral ? Number(r.m2_total) : 0,
            ordenes: laboral ? Number(r.ordenes) : 0,
            es_laboral: laboral
        };
    });

    const calendario = {};
    const inicioD = new Date(inicio + 'T00:00:00');
    const finD = new Date(fin + 'T00:00:00');
    for (let d = new Date(inicioD); d <= finD; d.setDate(d.getDate() + 1)) {
        const fs = d.toISOString().split('T')[0];
        const cal = calendarioMap[fs];
        calendario[fs] = {
            es_laboral: cal ? cal.es_laboral : (d.getDay() !== 0 && d.getDay() !== 6),
            motivo: cal ? cal.motivo : (d.getDay() === 0 ? 'Domingo' : d.getDay() === 6 ? 'Sabado' : '')
        };
    }

    return { estaciones, carga, inicio, fin, calendario };
};

// ============ PENDIENTES Y PROGRAMAR ============

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

// ============ CAPACIDAD GRUPO ============

const getCapacidadGrupo = async () => {
    const result = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE ORDER BY grupo');
    return result.rows;
};

const actualizarCapacidadGrupo = async (id, { capacidad_kg_dia, color, activo }) => {
    const fields = [];
    const values = [];
    let idx = 1;
    if (capacidad_kg_dia !== undefined) { fields.push(`capacidad_kg_dia = $${idx++}`); values.push(Number(capacidad_kg_dia) || 0); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (activo !== undefined) { fields.push(`activo = $${idx++}`); values.push(!!activo); }
    if (!fields.length) throw new Error('Sin campos');
    values.push(id);
    await query(`UPDATE produccion_capacidad_grupo SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    const result = await query('SELECT * FROM produccion_capacidad_grupo WHERE id = $1', [id]);
    return result.rows[0];
};

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
