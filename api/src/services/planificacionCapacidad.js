const { query } = require('../config/database');
const { getCalendarioMap, esLaboral } = require('./planificacionCalendario');

// Grupo REAL de la orden (o.grupo puede venir NULL en lo importado): receta/
// padre primero, mismo criterio que el resto del sistema.
const SQL_GRUPO_ORDEN = `COALESCE(
    o.grupo,
    CASE WHEN o.es_compuesto AND o.bom_padre_id IS NOT NULL THEN COALESCE(
        (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
        (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
        (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)) END,
    (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto),
    (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
    '(sin grupo)')`;

const getCargaSemanal = async (inicio, fin) => {
    const estRes = await query('SELECT id, nombre_estacion, orden_secuencia_defecto, cap_max FROM estaciones_maestras WHERE activa = TRUE ORDER BY orden_secuencia_defecto');
    const estaciones = estRes.rows || [];

    const cargaMap = {};
    try {
        const cargaRes = await query(
            `SELECT p.estacion_id, to_char(p.fecha_programada, 'YYYY-MM-DD') as fs,
             COALESCE(SUM(p.m2_asignados), 0) as m2, COUNT(*) as oc
             FROM cola_produccion_pasos p
             WHERE p.fecha_programada >= $1::date AND p.fecha_programada <= $2::date AND p.estado NOT IN ('TERMINADO','MERMADO')
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
        -- Grupo REAL de la orden (o.grupo puede venir NULL en lo importado):
        -- el mismo criterio del resto del sistema — receta/padre primero.
        SELECT COALESCE(
            o.grupo,
            CASE WHEN o.es_compuesto AND o.bom_padre_id IS NOT NULL THEN COALESCE(
                (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
                (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)) END,
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto),
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
            '(sin grupo)') as nombre_familia,
            p.fecha_programada::text as fecha,
            COALESCE(SUM(CASE WHEN COALESCE(o.metros_cuadrados,0) > 0
                THEN CASE WHEN p.id = (SELECT MIN(p2.id) FROM cola_produccion_pasos p2 WHERE p2.orden_produccion_id = o.id AND p2.estado NOT IN ('TERMINADO','MERMADO')) THEN COALESCE(o.kilos,0) ELSE 0 END
                ELSE COALESCE(o.kilos,0) END), 0) as kilos
        FROM cola_produccion_pasos p
        JOIN produccion_ordenes o ON o.id = p.orden_produccion_id
        WHERE p.fecha_programada BETWEEN $1 AND $2
          AND p.estado NOT IN ('TERMINADO','MERMADO')
          AND o.kilos > 0
        GROUP BY 1, 2
        ORDER BY 2, 1
    `, [inicio, fin]);

    const capRes = await query(`
        SELECT o.fecha_programada::text as fecha,
            COALESCE(SUM(pg.capacidad_kg_dia), 0) as capacidad_total
        FROM (
            SELECT DISTINCT fecha_programada FROM cola_produccion_pasos
            WHERE fecha_programada BETWEEN $1 AND $2
              AND estado NOT IN ('TERMINADO','MERMADO')
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

    // Trabajo ABIERTO sin fecha: órdenes PROGRAMADO/EN_PROCESO con pasos
    // pendientes cuyos kilos NUNCA puede mostrar la gráfica (ningún paso que
    // cargue sus kilos tiene fecha). Nunca aparecen en las barras por día, así
    // que la gráfica mostraba ~16.700 kg mientras el Tablero sumaba ~39.900 kg.
    // Se exponen aparte (columna "Sin fecha") para que el total del período
    // cuadre con el Tablero. Ventana-independiente: siempre es la misma cifra.
    const sinFechaRes = await query(`
        SELECT ${SQL_GRUPO_ORDEN} as nombre_familia,
               COALESCE(SUM(COALESCE(o.kilos, 0)), 0) as kilos,
               COUNT(*) as ordenes
        FROM produccion_ordenes o
        WHERE o.estado_programacion IN ('PENDIENTE', 'PROGRAMADO', 'EN_PROCESO')
          AND COALESCE(o.kilos, 0) > 0
          AND NOT EXISTS (SELECT 1 FROM cola_produccion_pasos p
                      WHERE p.orden_produccion_id = o.id
                        AND p.estado NOT IN ('TERMINADO','MERMADO')
                        AND p.fecha_programada IS NOT NULL
                        AND (COALESCE(o.metros_cuadrados, 0) = 0
                             OR p.id = (SELECT MIN(p2.id) FROM cola_produccion_pasos p2
                                        WHERE p2.orden_produccion_id = o.id
                                          AND p2.estado NOT IN ('TERMINADO','MERMADO'))))
        GROUP BY 1
    `);
    const sinFechaDatos = {};
    let sinFechaKg = 0, sinFechaOrd = 0;
    for (const r of sinFechaRes.rows) {
        sinFechaDatos[r.nombre_familia] = Number(r.kilos);
        sinFechaKg += Number(r.kilos);
        sinFechaOrd += Number(r.ordenes);
        // familia que SOLO tiene trabajo sin fecha → también al eje/leyenda
        if (!familiasMap[r.nombre_familia]) {
            familiasMap[r.nombre_familia] = {};
            for (const fs of fechasSet) familiasMap[r.nombre_familia][fs] = 0;
        }
    }

    return {
        familias: Object.keys(familiasMap),
        fechas: Array.from(fechasSet).sort(),
        datos: familiasMap,
        capacidad_por_dia: capMap,
        sin_fecha: { datos: sinFechaDatos, kg: sinFechaKg, ordenes: sinFechaOrd }
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
               COALESCE(SUM(cp.m2_asignados), 0) as m2_total,
               COALESCE(SUM(o.kilos * COALESCE(NULLIF(cp.m2_asignados, 0), o.metros_cuadrados) / NULLIF(o.metros_cuadrados, 0)), 0) as kg_total,
               COUNT(*) as ordenes
        FROM cola_produccion_pasos cp
        JOIN produccion_ordenes o ON o.id = cp.orden_produccion_id
        WHERE cp.fecha_programada >= $1::date AND cp.fecha_programada <= $2::date
          AND cp.estado NOT IN ('TERMINADO','MERMADO')
        GROUP BY cp.estacion_id, cp.fecha_programada
    `, [inicio, fin]);

    const calendarioMap = await getCalendarioMap(inicio, fin);

    // Excepciones de capacidad (mantencion/fallas) del rango: se devuelven para
    // que el tablero muestre la capacidad REAL de esos dias y no el cap_max.
    const excMap = {};
    try {
        const excRes = await query(
            `SELECT x.id, x.estacion_id, to_char(x.fecha, 'YYYY-MM-DD') as fs,
                    x.capacidad_m2_dia, x.motivo
             FROM estacion_excepciones x
             WHERE x.fecha >= $1::date AND x.fecha <= $2::date`,
            [inicio, fin]
        );
        excRes.rows.forEach(r => {
            excMap[r.estacion_id + '|' + r.fs] = {
                id: r.id,
                cap: Number(r.capacidad_m2_dia) || 0,
                motivo: r.motivo || ''
            };
        });
    } catch (e) { /* tabla nueva puede no existir aun */ }

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
            kg: laboral ? Number(r.kg_total) : 0,
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

    return { estaciones, carga, inicio, fin, calendario, excepciones: excMap };
};

// ---------------- TERMÓMETRO: PLAN vs EJECUTADO ----------------
// Últimos N días: de lo que el plan dijo que se haría en esos días (m² con
// fecha_programada pasada), cuánto se hizo de verdad (TERMINADO/MERMADO).
// Sirve para validar si las capacidades configuradas reflejan la realidad:
// % bajo sostenido = el plan promete más de lo que la planta da.
const getTermometro = async (dias = 14) => {
    const inicioD = new Date();
    inicioD.setDate(inicioD.getDate() - (Number(dias) || 14));
    const inicio = inicioD.toISOString().split('T')[0];
    const hoy = new Date().toISOString().split('T')[0];

    const result = await query(`
        SELECT cp.estacion_id, e.nombre_estacion,
               COALESCE(SUM(cp.m2_asignados), 0) as m2_plan,
               COALESCE(SUM(CASE WHEN cp.estado IN ('TERMINADO','MERMADO')
                    THEN COALESCE(NULLIF(cp.m2_real, 0), cp.m2_asignados, 0) ELSE 0 END), 0) as m2_ejec,
               COUNT(*) as pasos,
               COUNT(*) FILTER (WHERE cp.estado IN ('TERMINADO','MERMADO')) as pasos_ok
        FROM cola_produccion_pasos cp
        JOIN estaciones_maestras e ON e.id = cp.estacion_id
        WHERE cp.fecha_programada >= $1::date AND cp.fecha_programada < $2::date
          AND cp.estado NOT IN ('CANCELADO')
        GROUP BY cp.estacion_id, e.nombre_estacion, e.orden_secuencia_defecto
        ORDER BY e.orden_secuencia_defecto
    `, [inicio, hoy]);

    let plan = 0, ejec = 0;
    const estaciones = result.rows.map(r => {
        const mp = Number(r.m2_plan) || 0;
        const me = Number(r.m2_ejec) || 0;
        plan += mp; ejec += me;
        return {
            estacion_id: r.estacion_id,
            nombre: r.nombre_estacion,
            m2_plan: Math.round(mp * 10) / 10,
            m2_ejec: Math.round(me * 10) / 10,
            pct: mp > 0 ? Math.round((me / mp) * 100) : 100,
            pasos: Number(r.pasos),
            pasos_ok: Number(r.pasos_ok)
        };
    });
    return {
        inicio, fin: hoy, dias: Number(dias) || 14,
        m2_plan: Math.round(plan * 10) / 10,
        m2_ejec: Math.round(ejec * 10) / 10,
        pct: plan > 0 ? Math.round((ejec / plan) * 100) : 100,
        estaciones
    };
};

const getCapacidadGrupo = async () => {
    const result = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE ORDER BY grupo');
    return result.rows;
};

const getAllCapacidadGrupo = async () => {
    const result = await query('SELECT * FROM produccion_capacidad_grupo ORDER BY activo DESC, grupo');
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

const getCargaPorGrupoFinales = async (inicio, fin) => {
    const calMap = await getCalendarioMap(inicio, fin);

    const cargaRes = await query(`
        SELECT COALESCE(
            o.grupo,
            CASE WHEN o.es_compuesto AND o.bom_padre_id IS NOT NULL THEN COALESCE(
                (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
                (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)) END,
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto),
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
            '(sin grupo)') as nombre_familia,
            o.fecha_entrega_pactada::text as fecha,
            COALESCE(SUM(CASE WHEN COALESCE(o.metros_cuadrados,0) > 0
                THEN CASE WHEN p.id = (SELECT MIN(p2.id) FROM cola_produccion_pasos p2 WHERE p2.orden_produccion_id = o.id AND p2.estado NOT IN ('TERMINADO','MERMADO')) THEN COALESCE(o.kilos,0) ELSE 0 END
                ELSE COALESCE(o.kilos,0) END), 0) as kilos
        FROM cola_produccion_pasos p
        JOIN produccion_ordenes o ON o.id = p.orden_produccion_id
        WHERE o.fecha_entrega_pactada BETWEEN $1 AND $2
          AND p.estado NOT IN ('TERMINADO','MERMADO')
          AND o.kilos > 0
        GROUP BY 1, 2
        ORDER BY 2, 1
    `, [inicio, fin]);

    const capRes = await query(`
        SELECT o.fecha_entrega_pactada::text as fecha,
            COALESCE(SUM(pg.capacidad_kg_dia), 0) as capacidad_total
        FROM (
            SELECT DISTINCT o.fecha_entrega_pactada FROM cola_produccion_pasos p
            JOIN produccion_ordenes o ON o.id = p.orden_produccion_id
            WHERE o.fecha_entrega_pactada BETWEEN $1 AND $2
              AND p.estado NOT IN ('TERMINADO','MERMADO')
        ) o
        CROSS JOIN produccion_capacidad_grupo pg
        WHERE pg.activo = TRUE
        GROUP BY o.fecha_entrega_pactada
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

    // Trabajo ABIERTO sin fecha de ENTREGA: nunca aparece en las barras por día
    // de este modo (F. Término). Mismo criterio de reconciliación con el Tablero
    // que getCargaPorGrupo, pero mirando o.fecha_entrega_pactada (nivel orden).
    const sinFechaRes = await query(`
        SELECT ${SQL_GRUPO_ORDEN} as nombre_familia,
               COALESCE(SUM(COALESCE(o.kilos, 0)), 0) as kilos,
               COUNT(*) as ordenes
        FROM produccion_ordenes o
        WHERE o.estado_programacion IN ('PENDIENTE', 'PROGRAMADO', 'EN_PROCESO')
          AND COALESCE(o.kilos, 0) > 0
          AND (o.fecha_entrega_pactada IS NULL
               OR NOT EXISTS (SELECT 1 FROM cola_produccion_pasos p
                              WHERE p.orden_produccion_id = o.id
                                AND p.estado NOT IN ('TERMINADO','MERMADO')))
        GROUP BY 1
    `);
    const sinFechaDatos = {};
    let sinFechaKg = 0, sinFechaOrd = 0;
    for (const r of sinFechaRes.rows) {
        sinFechaDatos[r.nombre_familia] = Number(r.kilos);
        sinFechaKg += Number(r.kilos);
        sinFechaOrd += Number(r.ordenes);
        if (!familiasMap[r.nombre_familia]) {
            familiasMap[r.nombre_familia] = {};
            for (const fs of fechasSet) familiasMap[r.nombre_familia][fs] = 0;
        }
    }

    return {
        familias: Object.keys(familiasMap),
        fechas: Array.from(fechasSet).sort(),
        datos: familiasMap,
        capacidad_por_dia: capMap,
        sin_fecha: { datos: sinFechaDatos, kg: sinFechaKg, ordenes: sinFechaOrd }
    };
};

// Resumen del TRABAJO ABIERTO (PENDIENTE + PROGRAMADO + EN_PROCESO) para las
// stat cards: kg/órdenes totales, cuánto está fechado y cuánto no.
// "tiene_fecha" usa EXACTAMENTE la misma regla que las gráficas de arriba: los
// kilos de la orden se cargan en su primer paso pendiente (o en cualquier paso
// si la orden no tiene m²), así "sin fecha" = lo que la gráfica nunca dibuja.
const getResumenAbierto = async () => {
    const res = await query(`
        WITH base AS (
            SELECT o.id, COALESCE(o.kilos, 0) as kilos, o.estado_programacion,
                   EXISTS (
                       SELECT 1 FROM cola_produccion_pasos p
                       WHERE p.orden_produccion_id = o.id
                         AND p.estado NOT IN ('TERMINADO','MERMADO')
                         AND p.fecha_programada IS NOT NULL
                         AND (COALESCE(o.metros_cuadrados, 0) = 0
                              OR p.id = (SELECT MIN(p2.id) FROM cola_produccion_pasos p2
                                         WHERE p2.orden_produccion_id = o.id
                                           AND p2.estado NOT IN ('TERMINADO','MERMADO')))
                   ) as tiene_fecha
            FROM produccion_ordenes o
            WHERE o.estado_programacion IN ('PENDIENTE', 'PROGRAMADO', 'EN_PROCESO')
        )
        SELECT COUNT(*) as abiertos_ord,
               COALESCE(SUM(kilos), 0) as abiertos_kg,
               COUNT(*) FILTER (WHERE tiene_fecha) as fechados_ord,
               COALESCE(SUM(kilos) FILTER (WHERE tiene_fecha), 0) as fechados_kg,
               COUNT(*) FILTER (WHERE NOT tiene_fecha) as sin_fecha_ord,
               COALESCE(SUM(kilos) FILTER (WHERE NOT tiene_fecha), 0) as sin_fecha_kg,
               COUNT(*) FILTER (WHERE NOT tiene_fecha AND estado_programacion = 'EN_PROCESO') as sin_fecha_enproceso_ord,
               COUNT(*) FILTER (WHERE NOT tiene_fecha AND estado_programacion = 'PENDIENTE') as sin_fecha_pendientes_ord
        FROM base
    `);
    return res.rows[0] || {};
};

module.exports = {
    getCargaSemanal,
    getCargaPorGrupo,
    getCargaPorGrupoFinales,
    getCargaEstaciones,
    getTermometro,
    getCapacidadGrupo,
    getAllCapacidadGrupo,
    actualizarCapacidadGrupo,
    getResumenAbierto
};
