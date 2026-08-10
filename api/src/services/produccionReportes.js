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
            o.ancho,
            o.alto,
            o.metros_cuadrados as m2,
            o.kilos,
            o.espesor_mm as espesor,
            o.nota as obs,
            o.tipo_entrega as tipo,
            o.grupo,
            o.fecha_entrega_pactada::text as fecha,
            f.nombre_familia as familia,
            COALESCE(o.descripcion, pc.descripcion) as descripcion_completa,
            (SELECT string_agg(
                SUBSTRING(em.nombre_estacion, 1, 1) || '-' || cp.orden_secuencia::text,
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
        ${where}
        ORDER BY o.fecha_entrega_pactada, o.grupo, o.pedido_sap_id, o.item_numero
    `, params);

    const rows = result.rows;
    const porFecha = {};

    for (const r of rows) {
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
            cliente: r.cliente,
            codigo: r.codigo_producto,
            detalle_sap: r.detalle_sap || r.descripcion_completa || '',
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

module.exports = { getReporteFechas, _buildProceso };
