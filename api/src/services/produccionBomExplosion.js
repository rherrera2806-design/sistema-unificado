const { query } = require('../config/database');

const explosionBOM = async (r, recetaBomMap, materiaPrimaMap, materiasPrimas, familia, estacionesFinales, m2, resultados, mecanizadoOperaciones, ordenToEstacionId) => {
    for (const comp of recetaBomMap[r.codigo]) {
        let mp = comp.materia_prima_id ? materiaPrimaMap[comp.materia_prima_id] : null;
        if (!mp && comp.old_codigo) mp = materiasPrimas.find(m => m.codigo_mp === comp.old_codigo);
        if (!mp) continue;

        const costo_hh = familia ? Number(familia.costo_hh) : 0;
        const costo_energia = familia ? Number(familia.costo_energia) : 0;
        const costo_mp_total = (Number(mp.costo_unitario_mp) || 0) * (Number(comp.cantidad) || 1) * m2;
        const costo_total = costo_hh + costo_energia + costo_mp_total;
        const margen = r.precio_unitario * r.cantidad - costo_total;

        const result = await query(
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
             es_compuesto, bom_padre_id, tipo_venta, item_numero, cantidad, familia_id, codigo_padre,
             costo_hh, costo_energia, costo_materia_prima, costo_total_estimado, precio_unitario_sap, margen_estimado,
             nota, posicion, orden_compra, tipo_entrega, kilos, created_at, mecanizado_operaciones)
             VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26) RETURNING id`,
            [r.pedido, r.cliente, mp.codigo_mp, mp.nombre || r.descripcion, r.ancho, r.alto, m2,
             comp.id, r.tipo_venta, r.item, r.cantidad, familia?.id || null, r.codigo,
             costo_hh, costo_energia, costo_mp_total, costo_total, r.precio_unitario, margen,
             r.nota, r.posicion, r.orden_compra, r.tipo_entrega, Number(r.kilos || 0),
             r.fecha_creacion || new Date().toISOString(), mecanizadoOperaciones || null]
        );
        const ordenId = result.rows[0].id;
        for (let s = 0; s < estacionesFinales.length; s++) {
            const estacionId = ordenToEstacionId ? (ordenToEstacionId[estacionesFinales[s]] || estacionesFinales[s]) : estacionesFinales[s];
            if (!estacionId) continue;
            await query("INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, 'PENDIENTE')",
                [ordenId, estacionId, s + 1]);
            resultados.pasos_creados++;
        }
        resultados.importadas++;
        resultados.costos_calculados++;
    }
};

const crearOrdenSimple = async (r, familia, estacionesFinales, m2, resultados, mecanizadoOperaciones, ordenToEstacionId) => {
    const costo_hh = familia ? Number(familia.costo_hh) : 0;
    const costo_energia = familia ? Number(familia.costo_energia) : 0;
    const costo_total = costo_hh + costo_energia;
    const margen = r.precio_unitario * r.cantidad - costo_total;

    const result = await query(
        `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
         es_compuesto, tipo_venta, item_numero, cantidad, familia_id, codigo_padre,
         costo_hh, costo_energia, costo_materia_prima, costo_total_estimado, precio_unitario_sap, margen_estimado,
         nota, posicion, orden_compra, tipo_entrega, kilos, created_at, mecanizado_operaciones)
         VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
        [r.pedido, r.cliente, r.codigo, r.descripcion, r.ancho, r.alto, m2,
         r.tipo_venta, r.item, r.cantidad, familia?.id || null, r.codigo,
         costo_hh, costo_energia, 0, costo_total, r.precio_unitario, margen,
         r.nota, r.posicion, r.orden_compra, r.tipo_entrega, Number(r.kilos || 0),
         r.fecha_creacion || new Date().toISOString(), mecanizadoOperaciones || null]
    );
    const ordenId = result.rows[0].id;
    for (let s = 0; s < estacionesFinales.length; s++) {
        const estacionId = ordenToEstacionId ? (ordenToEstacionId[estacionesFinales[s]] || estacionesFinales[s]) : estacionesFinales[s];
        if (!estacionId) continue;
        await query("INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, 'PENDIENTE')",
            [ordenId, estacionId, s + 1]);
        resultados.pasos_creados++;
    }
    resultados.importadas++;
    if (familia) resultados.costos_calculados++;
};

module.exports = { explosionBOM, crearOrdenSimple };
