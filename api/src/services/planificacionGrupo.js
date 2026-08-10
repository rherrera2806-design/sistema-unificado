const { query } = require('../config/database');
const { getCalendarioMap } = require('./planificacion');

// Planificación simplificada por grupo (kg/día)

const backfillOrdenes = async () => {
    await query(`
        UPDATE produccion_ordenes o
        SET espesor_mm = COALESCE(
            (SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id),
            o.espesor_mm, 6
        )
        WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL
    `);
    await query(`
        UPDATE produccion_ordenes
        SET kilos = ROUND(COALESCE(metros_cuadrados, 0) * 2.5 * COALESCE(espesor_mm, 6)::numeric, 2)
        WHERE metros_cuadrados > 0
    `);
};

const backfillGrupos = async () => {
    await query(`
        UPDATE produccion_ordenes o
        SET grupo = CASE
            WHEN o.es_compuesto = TRUE THEN COALESCE(
                (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
            )
            ELSE (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto)
        END
        WHERE o.grupo IS NULL OR (o.es_compuesto = TRUE AND o.grupo = (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto))
    `);
    await query(`
        UPDATE produccion_ordenes o
        SET grupo = COALESCE(
            (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
            (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
        )
        WHERE o.es_compuesto = TRUE AND o.bom_padre_id IS NOT NULL
    `);
};

const getSemanaGrupo = async (inicio, fin) => {
    await backfillOrdenes();

    const calMap = await getCalendarioMap(inicio, fin);
    const esLaboral = (fStr) => {
        if (calMap.hasOwnProperty(fStr)) return calMap[fStr].es_laboral;
        const d = new Date(fStr + 'T12:00:00');
        return d.getDay() !== 0 && d.getDay() !== 6;
    };
    const motivo = (fStr) => calMap[fStr]?.motivo || null;

    const capacidadRes = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE ORDER BY grupo');
    const grupos = capacidadRes.rows;

    const cargaRes = await query(`
        SELECT o.fecha_programada::text as fecha,
            COALESCE(o.grupo, '(sin grupo)') as grupo,
            COALESCE(SUM(o.metros_cuadrados), 0) as m2,
            COALESCE(SUM(2.0 * (COALESCE(o.ancho,0) + COALESCE(o.alto,0)) / 1000.0 * COALESCE(o.cantidad, 1)), 0) as m_lineales,
            COALESCE(SUM(o.kilos), 0) as kilos,
            COUNT(*) as ordenes
        FROM produccion_ordenes o
        WHERE o.fecha_programada BETWEEN $1 AND $2
          AND o.estado_programacion NOT IN ('CERRADO','TERMINADO')
        GROUP BY o.fecha_programada, o.grupo
        ORDER BY o.fecha_programada
    `, [inicio, fin]);

    const dias = [];
    for (let d = new Date(inicio + 'T00:00:00'); d <= new Date(fin + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
        dias.push(d.toISOString().split('T')[0]);
    }

    const data = grupos.map(g => {
        const diasMap = dias.map(f => {
            const fData = cargaRes.rows.find(r => r.fecha === f && r.grupo === g.grupo);
            return {
                fecha: f,
                es_laboral: esLaboral(f),
                motivo: motivo(f),
                m2: Number(fData?.m2) || 0,
                m_lineales: Number(fData?.m_lineales) || 0,
                kilos: Number(fData?.kilos) || 0,
                ordenes: Number(fData?.ordenes) || 0
            };
        });
        const tot = diasMap.reduce((acc, d) => ({
            m2: acc.m2 + d.m2, m_lineales: acc.m_lineales + d.m_lineales, kilos: acc.kilos + d.kilos, ordenes: acc.ordenes + d.ordenes
        }), { m2: 0, m_lineales: 0, kilos: 0, ordenes: 0 });
        return { grupo: g.grupo, color: g.color, capacidad_kg_dia: Number(g.capacidad_kg_dia) || 0, dias: diasMap, total: tot };
    });

    return { grupos: data, dias, calendario: calMap };
};

const getDiaGrupo = async (fecha) => {
    const capacidadRes = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE ORDER BY grupo');

    await backfillGrupos();
    await backfillOrdenes();

    let cargaRes;
    if (fecha) {
        cargaRes = await query(`
            SELECT COALESCE(o.grupo, '(sin grupo)') as grupo, COALESCE(SUM(o.kilos), 0) as kg_total, COUNT(*) as ordenes
            FROM produccion_ordenes o
            WHERE o.fecha_programada = $1 AND o.estado_programacion NOT IN ('CERRADO','TERMINADO')
            GROUP BY o.grupo
        `, [fecha]);
    } else {
        cargaRes = await query(`
            SELECT o.fecha_programada, COALESCE(o.grupo, '(sin grupo)') as grupo, COALESCE(SUM(o.kilos), 0) as kg_total, COUNT(*) as ordenes
            FROM produccion_ordenes o
            WHERE o.fecha_programada IS NOT NULL AND o.estado_programacion NOT IN ('CERRADO','TERMINADO')
            GROUP BY o.fecha_programada, o.grupo
            ORDER BY o.fecha_programada
        `);
    }

    const pendRes = await query(`
        SELECT o.id, o.pedido_sap_id, o.item_numero, o.cliente, o.codigo_producto, o.descripcion, o.codigo_padre as codigo_padre_orden,
               o.ancho, o.alto, o.cantidad, o.kilos, o.grupo, o.es_compuesto, o.bom_padre_id, o.created_at,
               (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto) as nombre_mp,
               (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto) as grupo_codigo,
               COALESCE(
                 (SELECT cc.codigo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                 (SELECT rb.codigo_sap_padre FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id)
               ) as codigo_padre,
               COALESCE(
                 (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                 (SELECT cc2.descripcion FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
               ) as nombre_padre,
               COALESCE(
                 (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                 (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id)
               ) as grupo_padre
        FROM produccion_ordenes o
        WHERE o.estado_programacion = 'PENDIENTE' AND o.fecha_programada IS NULL
        ORDER BY o.created_at ASC
    `);

    const pendientes = pendRes.rows.map(o => ({
        ...o,
        grupo: (o.es_compuesto && o.bom_padre_id) ? o.grupo_padre : (o.grupo || o.grupo_codigo)
    }));

    return { capacidad: capacidadRes.rows, carga: cargaRes.rows, pendientes, fecha };
};

const asignarOrdenFecha = async (orden_id, fecha) => {
    if (fecha) {
        await query("UPDATE produccion_ordenes SET fecha_programada = $1, estado_programacion = 'PROGRAMADO' WHERE id = $2", [fecha, orden_id]);
    } else {
        await query("UPDATE produccion_ordenes SET fecha_programada = NULL, estado_programacion = 'PENDIENTE' WHERE id = $1", [orden_id]);
    }
};

const getSemanaGrupoFinales = async (inicio, fin) => {
    await backfillOrdenes();

    const calMap = await getCalendarioMap(inicio, fin);
    const esLaboral = (fStr) => {
        if (calMap.hasOwnProperty(fStr)) return calMap[fStr].es_laboral;
        const d = new Date(fStr + 'T12:00:00');
        return d.getDay() !== 0 && d.getDay() !== 6;
    };
    const motivo = (fStr) => calMap[fStr]?.motivo || null;

    const capacidadRes = await query('SELECT * FROM produccion_capacidad_grupo WHERE activo = TRUE ORDER BY grupo');
    const grupos = capacidadRes.rows;

    const cargaRes = await query(`
        SELECT o.fecha_entrega_pactada::text as fecha,
            COALESCE(o.grupo, '(sin grupo)') as grupo,
            COALESCE(SUM(o.metros_cuadrados), 0) as m2,
            COALESCE(SUM(2.0 * (COALESCE(o.ancho,0) + COALESCE(o.alto,0)) / 1000.0 * COALESCE(o.cantidad, 1)), 0) as m_lineales,
            COALESCE(SUM(o.kilos), 0) as kilos,
            COUNT(*) as ordenes
        FROM produccion_ordenes o
        WHERE o.fecha_entrega_pactada BETWEEN $1 AND $2
          AND o.estado_programacion NOT IN ('CERRADO','TERMINADO')
        GROUP BY o.fecha_entrega_pactada, o.grupo
        ORDER BY o.fecha_entrega_pactada
    `, [inicio, fin]);

    const dias = [];
    for (let d = new Date(inicio + 'T00:00:00'); d <= new Date(fin + 'T00:00:00'); d.setDate(d.getDate() + 1)) {
        dias.push(d.toISOString().split('T')[0]);
    }

    const data = grupos.map(g => {
        const diasMap = dias.map(f => {
            const fData = cargaRes.rows.find(r => r.fecha === f && r.grupo === g.grupo);
            return {
                fecha: f,
                es_laboral: esLaboral(f),
                motivo: motivo(f),
                m2: Number(fData?.m2) || 0,
                m_lineales: Number(fData?.m_lineales) || 0,
                kilos: Number(fData?.kilos) || 0,
                ordenes: Number(fData?.ordenes) || 0
            };
        });
        const tot = diasMap.reduce((acc, d) => ({
            m2: acc.m2 + d.m2, m_lineales: acc.m_lineales + d.m_lineales, kilos: acc.kilos + d.kilos, ordenes: acc.ordenes + d.ordenes
        }), { m2: 0, m_lineales: 0, kilos: 0, ordenes: 0 });
        return { grupo: g.grupo, color: g.color, capacidad_kg_dia: Number(g.capacidad_kg_dia) || 0, dias: diasMap, total: tot };
    });

    return { grupos: data, dias, calendario: calMap };
};

module.exports = {
    getSemanaGrupo,
    getSemanaGrupoFinales,
    getDiaGrupo,
    asignarOrdenFecha
};
