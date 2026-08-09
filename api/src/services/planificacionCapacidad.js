const { query } = require('../config/database');
const { getCalendarioMap, esLaboral } = require('./planificacionCalendario');

const getCargaSemanal = async (inicio, fin) => {
    const estRes = await query('SELECT id, nombre_estacion, orden_secuencia_defecto, cap_max FROM estaciones_maestras WHERE activa = TRUE ORDER BY orden_secuencia_defecto');
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
            const cap = Number(e.cap_max) || 100;
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
        return { estacion_id: e.id, nombre: e.nombre_estacion, orden: e.orden_secuencia_defecto, capacidad_dia: Number(e.cap_max) || 100, dias };
    });
};

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

const getCargaEstaciones = async (inicio, fin) => {
    const estRes = await query(`
        SELECT id, nombre_estacion, orden_secuencia_defecto, cap_max, cuello_botella
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
        capacidad_m2_dia: Number(e.cap_max) || 100,
        cuello_botella: e.cuello_botella
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
    getCargaSemanal,
    getCargaPorGrupo,
    getCargaEstaciones,
    getCapacidadGrupo,
    actualizarCapacidadGrupo
};
