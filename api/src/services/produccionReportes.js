const { query } = require('../config/database');

const getReporteFechas = async ({ familia, fecha_inicio, fecha_fin, grupo, estado }) => {
    const conditions = ["o.fecha_entrega_pactada IS NOT NULL"];
    const params = [];
    let idx = 1;

    if (familia && familia !== 'todas') {
        conditions.push(`f.nombre_familia = $${idx++}`);
        params.push(familia);
    }
    if (grupo && grupo !== 'todos') {
        conditions.push(`o.grupo = $${idx++}`);
        params.push(grupo);
    }
    if (estado && estado !== 'todos') {
        conditions.push(`o.estado_programacion = $${idx++}`);
        params.push(estado);
    }
    if (fecha_inicio) {
        conditions.push(`o.fecha_entrega_pactada >= $${idx++}`);
        params.push(fecha_inicio);
    }
    if (fecha_fin) {
        conditions.push(`o.fecha_entrega_pactada <= $${idx++}`);
        params.push(fecha_fin);
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(`
        SELECT
            o.pedido_sap_id as ov,
            o.item_numero as item,
            o.cantidad as pend,
            o.estado_programacion as estado,
            o.cliente,
            o.codigo_producto,
            COALESCE(o.descripcion, pc.descripcion) as detalle_sap,
            COALESCE(pc_padre.descripcion, '') as descripcion_padre,
            COALESCE(o.codigo_padre, o.codigo_producto) as codigo_sap_padre,
            COALESCE((SELECT rb.cantidad FROM recetas_bom rb JOIN materias_primas m ON m.id = rb.materia_prima_id
                      WHERE LOWER(TRIM(rb.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
                        AND LOWER(TRIM(m.codigo_mp)) = LOWER(TRIM(o.codigo_producto))
                      ORDER BY rb.id LIMIT 1),
                     (SELECT rb.cantidad FROM produccion_recetas_bom rb
                      WHERE LOWER(TRIM(rb.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
                        AND LOWER(TRIM(rb.codigo_materia_prima)) = LOWER(TRIM(o.codigo_producto))
                      ORDER BY rb.id LIMIT 1), 1) as cant_receta,
            o.ancho,
            o.alto,
            o.metros_cuadrados as m2,
            o.kilos,
            o.espesor_mm as espesor,
            o.nota as obs,
            o.tipo_entrega as tipo,
            o.nivel_prioridad,
            o.grupo,
            o.fecha_entrega_pactada::text as fecha,
            f.nombre_familia as familia,
            COALESCE(o.descripcion, pc.descripcion) as descripcion_completa,
            (SELECT string_agg(
                COALESCE(NULLIF(UPPER(TRIM(em.letra)), ''), UPPER(SUBSTRING(em.nombre_estacion, 1, 1))) || '-' || cp.orden_secuencia::text,
                '-'
                ORDER BY cp.orden_secuencia
            ) FROM cola_produccion_pasos cp
            JOIN estaciones_maestras em ON cp.estacion_id = em.id
            WHERE cp.orden_produccion_id = o.id) as ruta_abreviada,
            (SELECT string_agg(em.nombre_estacion, ' → ' ORDER BY cp.orden_secuencia)
            FROM cola_produccion_pasos cp
            JOIN estaciones_maestras em ON cp.estacion_id = em.id
            WHERE cp.orden_produccion_id = o.id) as ruta_completa,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Corte') as tiene_corte,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Pulido') as tiene_pulido,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Templado') as tiene_templado,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Formado') as tiene_formado,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Sellado') as tiene_sellado,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Radio') as tiene_radio,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Mecanizado') as tiene_mecanizado,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Ventana') as tiene_ventana,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Pintado') as tiene_pintado,
            EXISTS(SELECT 1 FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id AND em.nombre_estacion = 'Armado') as tiene_armado
        FROM produccion_ordenes o
        LEFT JOIN familias_producto f ON o.familia_id = f.id
        LEFT JOIN produccion_codigos pc ON o.codigo_producto = pc.codigo
        LEFT JOIN produccion_codigos pc_padre ON o.codigo_padre = pc_padre.codigo
        ${where}
        ORDER BY o.fecha_entrega_pactada, o.grupo, o.pedido_sap_id, o.item_numero
    `, params);

    const rows = result.rows;
    // Ruta sin estaciones repetidas: un paso puede quedar partido por registros
    // parciales (ej: dos "Corte" de la misma secuencia) y la ruta debe verse una vez
    for (const r of rows) {
        r.ruta_completa = String(r.ruta_completa || '').split(' → ')
            .filter((v, i, a) => i === 0 || v !== a[i - 1]).join(' → ');
        const t = String(r.ruta_abreviada || '').split('-');
        const pares = [];
        for (let i = 0; i + 1 < t.length; i += 2) {
            const par = t[i] + '-' + t[i + 1];
            if (!pares.length || pares[pares.length - 1] !== par) pares.push(par);
        }
        r.ruta_abreviada = pares.join('-');
    }

    // ===== MACRO POR CÓDIGO PADRE (reglas del negocio 1 y 5) =====
    // Las órdenes compuestas (BOM) crean UNA FILA POR CADA materia prima, todas
    // con el mismo m²/cantidad del pedido: el reporte se mide por CÓDIGO PADRE.
    //   espesor = SUMA de los espesores de CADA CAPA (ej: 6+6 = 12mm). Una MP
    //             usada N veces cuenta N capas (1 MP x 2 de 5mm = 10mm)
    //   kilos   = suma de las partes (= m² x espesor total x 2.5)
    //   m² / unidades = los del PADRE (las filas MP los repiten, no se suman)
    const macro = new Map();
    for (const r of rows) {
        const key = `${r.ov}|${r.item}|${r.codigo_sap_padre || ''}`;
        if (!macro.has(key)) macro.set(key, { ...r, espesor: 0, kilos: 0, pend: 0, m2: 0 });
        const g = macro.get(key);
        const veces = Number(r.cant_receta) || 1;
        g.espesor += (Number(r.espesor) || 0) * veces;
        g.kilos += (Number(r.kilos) || 0) * veces;
        g.pend = Math.max(g.pend, Number(r.pend) || 0);
        g.m2 = Math.max(g.m2, Number(r.m2) || 0);
    }
    const rowsMacro = [...macro.values()];

    const porFecha = {};

    for (const r of rowsMacro) {
        const fecha = r.fecha;
        if (!porFecha[fecha]) {
            porFecha[fecha] = {
                fecha,
                ordenes: [],
                totales: { m2: 0, kgs: 0, items: 0, unidades: 0 }
            };
        }
        porFecha[fecha].ordenes.push({
            ov: r.ov,
            item: r.item,
            pend: r.pend,
            unidades: Number(r.pend) || 0,
            estado: r.estado,
            prioridad: r.nivel_prioridad,
            cliente: r.cliente,
            codigo: r.codigo_producto,
            detalle_sap: r.detalle_sap || r.descripcion_completa || '',
            descripcion_padre: r.descripcion_padre || '',
            codigo_sap_padre: r.codigo_sap_padre || '',
            cant_receta: Number(r.cant_receta) || 1,
            ancho: r.ancho,
            alto: r.alto,
            m2: Number(r.m2) || 0,
            kgs: Number(r.kilos) || 0,
            espesor: r.espesor || null,
            obs: r.obs || '',
            tipo: r.tipo || '',
            grupo: r.grupo || '',
            familia: r.familia || '',
            proceso: _buildProceso(r),
            ruta: r.ruta_completa || '',
            tiene: {
                C: r.tiene_corte, P: r.tiene_pulido, F: r.tiene_formado,
                S: r.tiene_sellado, T: r.tiene_templado, R: r.tiene_radio,
                M: r.tiene_mecanizado, V: r.tiene_ventana, PI: r.tiene_pintado,
                A: r.tiene_armado
            }
        });
        porFecha[fecha].totales.m2 += Number(r.m2) || 0;
        porFecha[fecha].totales.kgs += Number(r.kilos) || 0;
        porFecha[fecha].totales.items += 1;
        porFecha[fecha].totales.unidades += Number(r.pend) || 0;
    }

    const fechas = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const famRes = await query("SELECT DISTINCT f.nombre_familia FROM familias_producto f WHERE f.activa = TRUE ORDER BY f.nombre_familia");
    const familias = famRes.rows.map(r => r.nombre_familia);

    const grpRes = await query("SELECT DISTINCT grupo FROM produccion_ordenes WHERE grupo IS NOT NULL AND grupo != '' ORDER BY grupo");
    const grupos = grpRes.rows.map(r => r.grupo);

    return { fechas, familias, grupos };
};

function _buildProceso(r) {
    const parts = [];
    if (r.tiene_corte) parts.push('C');
    if (r.tiene_pulido) parts.push('P');
    if (r.tiene_radio) parts.push('R');
    if (r.tiene_mecanizado) parts.push('M');
    if (r.tiene_ventana) parts.push('V');
    if (r.tiene_pintado) parts.push('PI');
    if (r.tiene_templado) parts.push('T');
    if (r.tiene_formado) parts.push('F');
    if (r.tiene_sellado) parts.push('S');
    if (r.tiene_armado) parts.push('A');
    return parts.join('-');
}

// ===== Lista de corte: órdenes ingresadas y programadas para corte =====
// Cada línea trae sus materias primas (hasta 2, del BOM del código) y la ruta
// de procesos como iniciales (C-M-F-T), para el Excel de corte de planta.
const getExportarCorte = async () => {
    const result = await query(`
        SELECT
            o.cantidad AS fabric,
            mp1.codigo_mp AS mp1_codigo,
            mp1.espesor_mm AS mp1_espesor,
            mp2.codigo_mp AS mp2_codigo,
            o.ancho, o.alto,
            o.tipo_venta AS prioridad,
            o.item_numero AS item,
            o.pedido_sap_id AS ov,
            o.fecha_entrega_pactada::text AS f_termino,
            COALESCE(o.codigo_padre, o.codigo_producto) AS id_sap,
            o.cliente,
            COALESCE(cod.descripcion, o.descripcion, '') AS detalle_sap,
            o.tipo_entrega AS ruta,
            o.orden_compra AS oc,
            COALESCE(
                (SELECT string_agg(COALESCE(NULLIF(UPPER(TRIM(em.letra)), ''), UPPER(SUBSTRING(em.nombre_estacion, 1, 1))), '-' ORDER BY cp.orden_secuencia)
                 FROM cola_produccion_pasos cp
                 JOIN estaciones_maestras em ON cp.estacion_id = em.id
                 WHERE cp.orden_produccion_id = o.id),
                (SELECT string_agg(COALESCE(NULLIF(UPPER(TRIM(em.letra)), ''), UPPER(SUBSTRING(em.nombre_estacion, 1, 1))), '-' ORDER BY u.ord)
                 FROM recetas_bom rb,
                      jsonb_array_elements(rb.procesos_especificos_json) WITH ORDINALITY AS u(est_id, ord)
                 JOIN estaciones_maestras em ON em.id = (u.est_id)::text::int
                 WHERE rb.id = (SELECT MIN(rb2.id) FROM recetas_bom rb2
                                WHERE LOWER(TRIM(rb2.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
                                  AND rb2.procesos_especificos_json IS NOT NULL)),
                (SELECT string_agg(COALESCE(NULLIF(UPPER(TRIM(em.letra)), ''), UPPER(SUBSTRING(em.nombre_estacion, 1, 1))), '-' ORDER BY em.orden_secuencia_defecto)
                 FROM familia_estaciones_base feb
                 JOIN estaciones_maestras em ON feb.estacion_id = em.id
                 WHERE feb.familia_id = o.familia_id)
            ) AS procesos
        FROM produccion_ordenes o
        LEFT JOIN produccion_codigos cod
            ON LOWER(TRIM(cod.codigo)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
        LEFT JOIN LATERAL (
            SELECT m.codigo_mp, m.espesor_mm
            FROM recetas_bom rb JOIN materias_primas m ON m.id = rb.materia_prima_id
            WHERE LOWER(TRIM(rb.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
            ORDER BY rb.id LIMIT 1
        ) mp1 ON TRUE
        LEFT JOIN LATERAL (
            SELECT m.codigo_mp
            FROM recetas_bom rb JOIN materias_primas m ON m.id = rb.materia_prima_id
            WHERE LOWER(TRIM(rb.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))
            ORDER BY rb.id LIMIT 1 OFFSET 1
        ) mp2 ON TRUE
        WHERE o.estado_programacion IN ('PENDIENTE', 'PROGRAMADO', 'EN_PROCESO')
        ORDER BY LOWER(COALESCE(mp1.codigo_mp, '')), o.pedido_sap_id, o.item_numero
    `);
    return result.rows;
};

module.exports = { getReporteFechas, getExportarCorte, _buildProceso };
