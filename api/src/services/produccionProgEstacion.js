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
        where.push(`cp.fecha_programada >= $${params.length}::date`);
    }
    if (fecha_fin) {
        params.push(fecha_fin);
        where.push(`cp.fecha_programada <= $${params.length}::date`);
    }
    if (estado) {
        params.push(estado);
        where.push(`cp.estado = $${params.length}`);
    } else {
        where.push(`cp.estado != 'MERMADO'`);
    }

    where.push(`cp.fecha_programada IS NOT NULL`);

    const whereClause = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';

    const result = await query(`
        SELECT
            cp.id as paso_id,
            cp.fecha_programada,
            cp.estado,
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
            o.tipo_venta,
            o.familia_id,
            COALESCE(o.codigo_padre, o.codigo_producto) as codigo_ref,
            COALESCE(
                (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                o.descripcion, ''
            ) as nombre_padre,
            COALESCE(
                (SELECT cc.grupo FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
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
        const fecha = typeof r.fecha_programada === 'string'
            ? r.fecha_programada.split('T')[0]
            : new Date(r.fecha_programada).toISOString().split('T')[0];

        if (!est.por_fecha[fecha]) {
            est.por_fecha[fecha] = { ordenes: [], total_m2: 0, total_kg: 0, total_ordenes: 0 };
        }
        const dia = est.por_fecha[fecha];
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
            estado: r.estado,
            estado_programacion: r.estado_programacion,
            es_compuesto: r.es_compuesto,
            grupo: r.grupo_resuelto,
            familia: r.nombre_familia,
            tipo_venta: r.tipo_venta,
            ruta: Array.isArray(r.ruta_completa) ? r.ruta_completa.join(' → ') : '',
            mp_nombre: r.mp_nombre || null,
            mp_espesor: r.mp_espesor || null,
            hora_inicio: r.hora_inicio,
            hora_fin: r.hora_fin
        };
        dia.ordenes.push(ordenInfo);
        dia.total_m2 += ordenInfo.m2_asignados || ordenInfo.m2;
        dia.total_kg += ordenInfo.kg;
        dia.total_ordenes++;
        est.total_ordenes++;
        est.total_m2 += ordenInfo.m2_asignados || ordenInfo.m2;
        est.total_kg += ordenInfo.kg;
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
