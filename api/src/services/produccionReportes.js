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
            o.id as orden_id,
            o.pedido_sap_id as ov,
            o.item_numero as item,
            -- PENDIENTE REAL de fabricar: cantidad del pedido menos lo terminado
            -- en su ÚLTIMO paso (si el último paso no está terminado, la orden
            -- completa sigue pendiente). Antes se mostraba la cantidad total
            -- aunque la orden estuviera terminada — y sumaba al KPI "unidades a
            -- fabricar" pedidos ya fabricados.
            GREATEST(0, COALESCE(o.cantidad, 0) - COALESCE((
                SELECT p.cantidad_real FROM cola_produccion_pasos p
                WHERE p.orden_produccion_id = o.id
                  AND p.estado = 'TERMINADO'
                  AND p.orden_secuencia = (SELECT MAX(p2.orden_secuencia) FROM cola_produccion_pasos p2 WHERE p2.orden_produccion_id = o.id)
                LIMIT 1), 0)) as pend,
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
            WHERE cp.orden_produccion_id = o.id) as ruta_completa
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

    // ===== LETRAS DE ESTACIÓN (campo 'letra' de estaciones_maestras) =====
    // El código de proceso y el avance usan las MISMAS letras que ve el usuario
    // en su Excel de corte (C, P, D, R, T, F, S, A, M...). Sin letra configurada
    // cae al mapa estándar y luego a las 2 primeras letras del nombre.
    const estRes = await query('SELECT nombre_estacion, letra FROM estaciones_maestras');
    const letraPorNombre = {};
    for (const e of estRes.rows) {
        const k = String(e.nombre_estacion || '').trim().toLowerCase();
        if (k) letraPorNombre[k] = String(e.letra || '').trim().toUpperCase() || '';
    }
    const letraDe = (nom) => {
        const k = String(nom || '').trim().toLowerCase();
        return letraPorNombre[k] || LETRA_ESTACION[k] || String(nom || '').trim().slice(0, 2).toUpperCase();
    };

    // ===== AVANCE POR PROCESO (letra) =====
    // Unidades registradas en cada estación de la ruta: la vista rápida de "en
    // qué proceso está el pedido". Se consulta una sola vez para todas las órdenes.
    const idsOrdenes = [...new Set(rows.map(r => r.orden_id).filter(Boolean))];
    const pasosMap = {};
    if (idsOrdenes.length) {
        const pasosRes = await query(`
            SELECT cp.orden_produccion_id as orden_id, em.nombre_estacion as estacion,
                   cp.orden_secuencia, cp.estado,
                   COALESCE(cp.cantidad_real, 0) as cantidad_real
            FROM cola_produccion_pasos cp
            JOIN estaciones_maestras em ON em.id = cp.estacion_id
            WHERE cp.orden_produccion_id = ANY($1)
            ORDER BY cp.orden_secuencia, cp.id
        `, [idsOrdenes]);
        for (const p of pasosRes.rows) {
            if (!pasosMap[p.orden_id]) pasosMap[p.orden_id] = [];
            pasosMap[p.orden_id].push(p);
        }
    }

    // ===== MACRO POR CÓDIGO PADRE (reglas del negocio 1 y 5) =====
    // Las órdenes compuestas (BOM) crean UNA FILA POR CADA materia prima, todas
    // con el mismo m²/cantidad del pedido: el reporte se mide por CÓDIGO PADRE.
    //   espesor = SUMA de los espesores de CADA CAPA (ej: 6+6 = 12mm). Una MP
    //             usada N veces cuenta N capas (1 MP x 2 de 5mm = 10mm)
    //   kilos   = suma de las partes (= m² x espesor total x 2.5)
    //   m²      = los del PADRE (las filas MP los repiten, no se suman)
    //   pend    = unidades REALES pendientes de fabricar del padre (ya viene
    //             descontando lo terminado desde la query)
    const macro = new Map();
    for (const r of rows) {
        const key = `${r.ov}|${r.item}|${r.codigo_sap_padre || ''}`;
        if (!macro.has(key)) macro.set(key, { ...r, espesor: 0, kilos: 0, pend: 0, m2: 0, _ids: [] });
        const g = macro.get(key);
        if (r.orden_id) g._ids.push(r.orden_id);
        const veces = Number(r.cant_receta) || 1;
        g.espesor += (Number(r.espesor) || 0) * veces;
        g.kilos += (Number(r.kilos) || 0) * veces;
        g.pend = Math.max(g.pend, Number(r.pend) || 0);
        g.m2 = Math.max(g.m2, Number(r.m2) || 0);
    }
    // Avance por proceso (letra) de cada fila macro: junta los pasos de todas
    // las MP del padre — los hijos repiten las MISMAS unidades del pedido, así
    // que se toma el máximo entre ellos (no se suman)
    for (const g of macro.values()) {
        g.avance = _buildAvance(g._ids, pasosMap, letraDe);
        delete g._ids;
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
            proceso: _buildProceso(r, letraDe),
            avance: r.avance || [],
            ruta: r.ruta_completa || '',
            tiene: _buildTiene(r, letraDe)
        });
        porFecha[fecha].totales.m2 += Number(r.m2) || 0;
        porFecha[fecha].totales.kgs += Number(r.kilos) || 0;
        porFecha[fecha].totales.items += 1;
        porFecha[fecha].totales.unidades += Number(r.pend) || 0;
    }

    // ORDEN DEL PROGRAMA (misma regla que Prog. por Estación y el Programa de
    // Máquinas) dentro de cada fecha: Prioridad (Reposición → Express →
    // Urgencia → Normal) → Espesor ascendente → Pedido → Item
    const ordenPrograma = (a, b) =>
        ((({ 4: 0, 2: 1, 3: 2 }[Number(a.prioridad)] ?? 3) - ({ 4: 0, 2: 1, 3: 2 }[Number(b.prioridad)] ?? 3))
        || ((Number(a.espesor) || 0) - (Number(b.espesor) || 0))
        || String(a.ov || '').localeCompare(String(b.ov || ''), 'es', { numeric: true })
        || ((Number(a.item) || 0) - (Number(b.item) || 0)));
    for (const f of Object.values(porFecha)) f.ordenes.sort(ordenPrograma);

    const fechas = Object.values(porFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

    const famRes = await query("SELECT DISTINCT f.nombre_familia FROM familias_producto f WHERE f.activa = TRUE ORDER BY f.nombre_familia");
    const familias = famRes.rows.map(r => r.nombre_familia);

    const grpRes = await query("SELECT DISTINCT grupo FROM produccion_ordenes WHERE grupo IS NOT NULL AND grupo != '' ORDER BY grupo");
    const grupos = grpRes.rows.map(r => r.grupo);

    return { fechas, familias, grupos };
};

// Código de proceso desde la RUTA REAL de la orden (estaciones configuradas:
// incluye Laminado VM y cualquier estación nueva). ANTES eran 10 nombres
// hardcodeados que no conocían Laminado VM (la estación final del laminado) y
// obligaban a 10 subconsultas por fila. El mapa da letras conocidas; una
// estación nueva toma sus 2 primeras letras sin romper nada.
const LETRA_ESTACION = {
    corte: 'C', pulido: 'P', radio: 'R', mecanizado: 'M', ventana: 'V',
    pintado: 'PI', templado: 'T', formado: 'F', sellado: 'S', armado: 'A',
    'laminado vm': 'L', 'laminado': 'L', lavado: 'LA', biselado: 'B', cnc: 'CNC'
};
const _letraEstacion = (nom) => {
    const k = String(nom || '').trim().toLowerCase();
    return LETRA_ESTACION[k] || String(nom || '').trim().slice(0, 2).toUpperCase();
};
function _buildProceso(r, letraDe = _letraEstacion) {
    const partes = [];
    for (const nom of String(r.ruta_completa || '').split(' → ')) {
        if (!nom.trim()) continue;
        const letra = letraDe(nom);
        if (!partes.length || partes[partes.length - 1] !== letra) partes.push(letra);
    }
    return partes.join('-');
}
function _buildTiene(r, letraDe = _letraEstacion) {
    const tiene = {};
    for (const nom of String(r.ruta_completa || '').split(' → ')) {
        if (!nom.trim()) continue;
        tiene[letraDe(nom)] = true;
    }
    return tiene;
}
// AVANCE POR PROCESO (letra): unidades registradas en cada estación de la ruta
// con su estado — la vista rápida de "en qué proceso está el pedido".
//   estado: 'ok' (estación terminada) · 'curso' (en proceso o con parte hecha
//   y resto pendiente) · 'pend' (sin registrar nada)
function _buildAvance(ordenIds, pasosMap, letraDe = _letraEstacion) {
    const porLetra = {};
    for (const id of (ordenIds || [])) {
        // Los hijos de un compuesto repiten las MISMAS unidades del pedido:
        // por estación se toma el MÁXIMO entre hijos (no se suman). Los restos
        // parciales de una misma estación en un mismo hijo SÍ se suman.
        const porEst = {};
        for (const p of ((pasosMap && pasosMap[id]) || [])) {
            const letra = letraDe(p.estacion);
            if (!letra) continue;
            const e = porEst[letra] || (porEst[letra] = { letra, estacion: p.estacion, cant: 0, pendientes: 0, curso: false, orden: Number(p.orden_secuencia) || 0 });
            e.cant += Number(p.cantidad_real) || 0;
            if (p.estado === 'EN_PROCESO' || p.estado === 'PAUSADO') e.curso = true;
            else if (p.estado !== 'TERMINADO' && p.estado !== 'MERMADO') e.pendientes += 1;
        }
        for (const [letra, e] of Object.entries(porEst)) {
            const prev = porLetra[letra];
            if (!prev || e.cant > prev.cant) porLetra[letra] = e;
        }
    }
    // El ORDEN de las letras es el de la RUTA (orden_secuencia de los pasos):
    // la R (Radio) no puede ir antes de la P (Pulido) si en la ruta viene
    // después — nunca orden alfabético
    return Object.values(porLetra)
        .sort((a, b) => (a.orden - b.orden) || String(a.letra).localeCompare(String(b.letra)))
        .map(e => ({
            letra: e.letra,
            estacion: e.estacion,
            cant: e.cant,
            estado: (e.pendientes === 0 && !e.curso) ? 'ok' : ((e.cant > 0 || e.curso) ? 'curso' : 'pend')
        }));
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

module.exports = { getReporteFechas, getExportarCorte, _buildProceso, _buildAvance };
