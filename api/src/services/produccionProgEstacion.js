const { query } = require('../config/database');

const getProgEstacion = async ({ estacion_id, fecha_inicio, fecha_fin, estado } = {}) => {
    const params = [];
    const where = [];

    if (estacion_id) {
        params.push(Number(estacion_id));
        where.push(`cp.estacion_id = $${params.length}`);
    }
    if (fecha_inicio) {
        params.push(fecha_inicio);
        where.push(`(cp.fecha_programada >= $${params.length}::date OR cp.fecha_programada IS NULL)`);
    }
    if (fecha_fin) {
        params.push(fecha_fin);
        where.push(`(cp.fecha_programada <= $${params.length}::date OR cp.fecha_programada IS NULL)`);
    }
    // Estado del PASO en la estación:
    //  - por_fabricar (por defecto): todo lo que aún debe fabricarse
    //  - fabricado: lo ya fabricado (terminado / mermado)
    //  - todos: ambos juntos · valores viejos (PENDIENTE, TERMINADO...) siguen funcionando
    if (estado === 'fabricado') {
        where.push(`cp.estado IN ('TERMINADO', 'MERMADO')`);
    } else if (estado && estado !== 'todos' && estado !== 'por_fabricar') {
        params.push(estado);
        where.push(`cp.estado = $${params.length}`);
    } else if (estado !== 'todos') {
        where.push(`cp.estado NOT IN ('TERMINADO', 'MERMADO')`);
    }

    // NOTA: los pasos SIN fecha programada (importaciones, BOM, restos de
    // cortes parciales) también se muestran — agrupados como 'sin_fecha' —
    // para que este programa cuadre con el taller, donde sí aparecen.

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const result = await query(`
        SELECT
            cp.id as paso_id,
            cp.estacion_id,
            cp.fecha_programada,
            cp.estado,
            cp.turno,
            cp.orden_secuencia,
            cp.m2_asignados,
            cp.hora_inicio,
            cp.hora_fin,
            o.id as orden_id,
            o.pedido_sap_id,
            o.item_numero,
            o.cliente,
            o.codigo_producto,
            o.descripcion,
            o.ancho,
            o.alto,
            o.metros_cuadrados,
            o.kilos,
            o.cantidad,
            o.es_compuesto,
            o.codigo_padre,
            o.grupo,
            o.estado_programacion,
            o.nivel_prioridad,
            o.tipo_venta,
            o.familia_id,
            COALESCE(o.codigo_padre, o.codigo_producto) as codigo_ref,
            COALESCE(
                (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                o.descripcion, ''
            ) as nombre_padre,
            COALESCE(
                (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                -- bom_padre_id puede apuntar a recetas_bom (tabla nueva, donde el
                -- id lo guarda explosionBOM) o a produccion_recetas_bom (legacy):
                -- se resuelve primero contra la nueva y se usa la antigua como fallback
                (SELECT cc2.grupo FROM recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
                (SELECT cc2.grupo FROM produccion_recetas_bom rb JOIN produccion_codigos cc2 ON cc2.codigo = rb.codigo_sap_padre WHERE rb.id = o.bom_padre_id),
                o.grupo, ''
            ) as grupo_resuelto,
            em.nombre_estacion,
            em.orden_secuencia_defecto,
            em.cap_max,
            em.cuello_botella,
            fp.nombre_familia,
            mp.nombre as mp_nombre,
            mp.espesor_mm as mp_espesor,
            -- ESPESOR del producto = SUMA de los espesores de la receta BOM
            -- (ej: 5+5 = 10mm). Misma regla macro que los reportes. Si el
            -- codigo no tiene receta, cae al espesor de la orden.
            COALESCE(
                (SELECT SUM(COALESCE(m2.espesor_mm, 0))
                 FROM recetas_bom rb2
                 JOIN materias_primas m2 ON m2.id = rb2.materia_prima_id
                 WHERE LOWER(TRIM(rb2.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))),
                (SELECT SUM(COALESCE(rb_old.espesor, 0))
                 FROM produccion_recetas_bom rb_old
                 WHERE LOWER(TRIM(rb_old.codigo_sap_padre)) = LOWER(TRIM(COALESCE(o.codigo_padre, o.codigo_producto)))),
                o.espesor_mm
            ) as espesor_bom,
            -- Espesor PROPIO de la capa/componente (el de su materia prima,
            -- con fallback al espesor de la orden). En estaciones de proceso
            -- cada capa se muestra con SU espesor; el suma BOM solo aplica en
            -- la estación final.
            COALESCE(mp.espesor_mm, o.espesor_mm) as espesor_capa,
            -- ¿Este paso es el ÚLTIMO de la ruta de la orden? (genérico: en
            -- termopanel cae en Armado, en laminado en Laminado VM). Solo ahí
            -- los componentes del BOM se muestran como uno solo; en las
            -- estaciones de proceso cada componente va con su fila aparte.
            (cp.orden_secuencia >= (SELECT MAX(cp3.orden_secuencia) FROM cola_produccion_pasos cp3 WHERE cp3.orden_produccion_id = o.id)) as es_estacion_final,
            -- Cantidad de la receta BOM para este componente (ej: 1 MP x 2 und)
            COALESCE(
                (SELECT rb.cantidad FROM recetas_bom rb WHERE rb.id = o.bom_padre_id),
                (SELECT rb_old.cantidad FROM produccion_recetas_bom rb_old WHERE rb_old.id = o.bom_padre_id),
                1
            ) as bom_cantidad,
            ARRAY(
                SELECT em2.nombre_estacion
                FROM cola_produccion_pasos cp2
                JOIN estaciones_maestras em2 ON cp2.estacion_id = em2.id
                WHERE cp2.orden_produccion_id = o.id
                ORDER BY cp2.orden_secuencia
            ) as ruta_completa
        FROM cola_produccion_pasos cp
        JOIN produccion_ordenes o ON cp.orden_produccion_id = o.id
        JOIN estaciones_maestras em ON cp.estacion_id = em.id
        LEFT JOIN familias_producto fp ON o.familia_id = fp.id
        LEFT JOIN materias_primas mp ON mp.codigo_mp = o.codigo_producto
        ${whereClause}
        ORDER BY em.orden_secuencia_defecto, cp.fecha_programada, o.pedido_sap_id
    `, params);

    const estacionesMap = {};
    const estacionesLista = [];
    // Dedup de órdenes macro (pedido|item) para los contadores "ord"
    const vistasDia = new Set();
    const vistasEst = new Set();

    for (const r of result.rows) {
        const estKey = r.estacion_id;
        if (!estacionesMap[estKey]) {
            estacionesMap[estKey] = {
                estacion_id: r.estacion_id,
                nombre: r.nombre_estacion,
                orden: r.orden_secuencia_defecto,
                cap_max: Number(r.cap_max) || 0,
                cuello_botella: !!r.cuello_botella,
                por_fecha: {},
                total_ordenes: 0,
                total_m2: 0,
                total_kg: 0
            };
            estacionesLista.push(estacionesMap[estKey]);
        }
        const est = estacionesMap[estKey];
        const fecha = !r.fecha_programada
            ? 'sin_fecha'
            : (typeof r.fecha_programada === 'string'
                ? r.fecha_programada.split('T')[0]
                : new Date(r.fecha_programada).toISOString().split('T')[0]);

        if (!est.por_fecha[fecha]) {
            est.por_fecha[fecha] = { ordenes: [], total_m2: 0, total_kg: 0, total_ordenes: 0 };
        }
        const dia = est.por_fecha[fecha];
        // Cantidad y kilos PROPIOS del paso (proporción de su m2 sobre el de
        // la orden): los pasos "resto" de un parcial cubren solo una parte.
        const m2o = Number(r.metros_cuadrados) || 0;
        const m2p = Number(r.m2_asignados) || m2o;
        const cantBase = Number(r.cantidad) || 1;
        const cantidadPaso = (m2o > 0 && m2p > 0) ? Math.max(1, Math.round(cantBase * m2p / m2o)) : cantBase;
        const kgPaso = m2o > 0 ? (Number(r.kilos) || 0) * m2p / m2o : (Number(r.kilos) || 0);
        // Regla de la receta BOM: el último paso de la ruta es la estación
        // FINAL (Armado / Laminado VM) — solo ahí los componentes se agrupan.
        const esEstacionFinal = r.es_estacion_final != null ? !!r.es_estacion_final : true;
        // Piezas de MATERIA PRIMA de esta capa = unidades del pedido x cantidad
        // de la receta (ej: 1 MP x 2 und sobre 10 pedidas = 20 piezas)
        const bomCant = Number(r.bom_cantidad) || 1;
        const piezasPaso = Math.max(1, Math.round(cantidadPaso * bomCant));
        // Espesor de la FILA: en proceso el de la capa; en la estación final el
        // suma del BOM (5+5 = 10mm) — misma regla macro que los reportes.
        const espesorCapa = r.espesor_capa != null ? Number(r.espesor_capa) : (r.espesor_orden != null ? Number(r.espesor_orden) : null);
        const espesorBom = r.espesor_bom != null ? Number(r.espesor_bom) : null;
        const espesorFila = esEstacionFinal ? (espesorBom ?? espesorCapa) : (espesorCapa ?? espesorBom);
        const ordenInfo = {
            paso_id: r.paso_id,
            orden_id: r.orden_id,
            pedido: r.pedido_sap_id,
            item: r.item_numero,
            cliente: r.cliente,
            codigo: r.codigo_producto,
            codigo_ref: r.codigo_ref,
            nombre_padre: r.nombre_padre,
            descripcion: r.descripcion,
            ancho: r.ancho,
            alto: r.alto,
            m2: Number(r.metros_cuadrados) || 0,
            kg: Number(r.kilos) || 0,
            cantidad: r.cantidad || 1,
            m2_asignados: Number(r.m2_asignados) || 0,
            cantidad_paso: cantidadPaso,
            piezas_paso: piezasPaso,
            bom_cantidad: bomCant,
            kg_paso: kgPaso,
            es_estacion_final: esEstacionFinal,
            estado: r.estado,
            turno: r.turno || null,
            prioridad: r.nivel_prioridad,
            estado_programacion: r.estado_programacion,
            es_compuesto: r.es_compuesto,
            grupo: r.grupo_resuelto,
            familia: r.nombre_familia,
            tipo_venta: r.tipo_venta,
            // Ruta sin estaciones repetidas (un mismo paso puede quedar partido
            // por registros parciales: "Corte → Corte" se muestra una sola vez)
            ruta: Array.isArray(r.ruta_completa) ? r.ruta_completa.filter((v, i, a) => i === 0 || v !== a[i - 1]).join(' → ') : '',
            mp_nombre: r.mp_nombre || null,
            mp_espesor: r.mp_espesor || null,
            espesor_bom: espesorBom,
            espesor_capa: espesorCapa,
            espesor_fila: espesorFila,
            hora_inicio: r.hora_inicio,
            hora_fin: r.hora_fin
        };
        dia.ordenes.push(ordenInfo);
        dia.total_m2 += ordenInfo.m2_asignados || ordenInfo.m2;
        // kg_paso (proporcional al paso) = lo que muestra la columna Kg de cada
        // fila: antes el total sumaba los kilos COMPLETOS y no cuadraba
        dia.total_kg += ordenInfo.kg_paso;
        // "ord" = órdenes MACRO (pedido|item): las filas MP de una orden
        // compuesta cuentan UNA sola vez
        const kOrd = `${ordenInfo.pedido}|${ordenInfo.item}`;
        if (!vistasDia.has(estKey + '|' + fecha + '|' + kOrd)) { vistasDia.add(estKey + '|' + fecha + '|' + kOrd); dia.total_ordenes++; }
        if (!vistasEst.has(estKey + '|' + kOrd)) { vistasEst.add(estKey + '|' + kOrd); est.total_ordenes++; }
        est.total_m2 += ordenInfo.m2_asignados || ordenInfo.m2;
        est.total_kg += ordenInfo.kg_paso;
    }

    for (const est of estacionesLista) {
        est.fechas = Object.keys(est.por_fecha).sort().map(f => ({
            fecha: f,
            ordenes: est.por_fecha[f].ordenes,
            total_m2: est.por_fecha[f].total_m2,
            total_kg: est.por_fecha[f].total_kg,
            total_ordenes: est.por_fecha[f].total_ordenes
        }));
        delete est.por_fecha;
    }

    const todasEstRes = await query(
        'SELECT id, nombre_estacion, orden_secuencia_defecto, cap_max, cuello_botella FROM estaciones_maestras WHERE activa = TRUE ORDER BY orden_secuencia_defecto'
    );

    return {
        estaciones: estacionesLista,
        todas_estaciones: todasEstRes.rows
    };
};

module.exports = { getProgEstacion };
