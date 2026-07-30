const { query } = require('../config/database');

// Importación de órdenes de producción desde Excel (nueva arquitectura)

const cargarDatosMaestros = async () => {
    const [estacionesRes, familiasRes, reglasRes, recetasBomRes, materiasRes, oldRecetasRes] = await Promise.all([
        query('SELECT * FROM estaciones_maestras WHERE activa = TRUE'),
        query('SELECT * FROM familias_producto WHERE activa = TRUE'),
        query('SELECT * FROM reglas_procesos_extras WHERE activa = TRUE'),
        query('SELECT * FROM recetas_bom'),
        query('SELECT * FROM materias_primas'),
        query('SELECT * FROM produccion_recetas_bom')
    ]);

    const estacionMap = {};
    estacionesRes.rows.forEach(e => { estacionMap[e.nombre_estacion] = e; });

    const familiaMap = {};
    familiasRes.rows.forEach(f => { familiaMap[f.codigo_familia] = f; });

    const reglaMap = {};
    reglasRes.rows.forEach(r => { reglaMap[r.nombre_flag] = r; });

    const recetaBomMap = {};
    recetasBomRes.rows.forEach(r => {
        if (!recetaBomMap[r.codigo_sap_padre]) recetaBomMap[r.codigo_sap_padre] = [];
        recetaBomMap[r.codigo_sap_padre].push(r);
    });

    if (Object.keys(recetaBomMap).length === 0 && oldRecetasRes.rows.length > 0) {
        console.log('[PROD] Usando recetas de produccion_recetas_bom (tabla antigua)');
        oldRecetasRes.rows.forEach(r => {
            const codigo = r.codigo_sap_padre;
            if (!recetaBomMap[codigo]) recetaBomMap[codigo] = [];
            recetaBomMap[codigo].push({
                codigo_sap_padre: codigo,
                materia_prima_id: null,
                cantidad: r.cantidad || 1,
                old_codigo: r.codigo_materia_prima,
                old_descripcion: r.descripcion,
                old_espesor: r.espesor
            });
        });
    }

    const materiaPrimaMap = {};
    materiasRes.rows.forEach(m => { materiaPrimaMap[m.id] = m; });

    const famEstRes = await query(`
        SELECT feb.familia_id, array_agg(feb.estacion_id ORDER BY em.orden_secuencia_defecto) as estacion_ids
        FROM familia_estaciones_base feb
        JOIN estaciones_maestras em ON feb.estacion_id = em.id
        GROUP BY feb.familia_id
    `);
    const familiaEstacionesMap = {};
    famEstRes.rows.forEach(r => { familiaEstacionesMap[r.familia_id] = r.estacion_ids; });

    return {
        estacionesMaestras: estacionesRes.rows,
        familias: familiasRes.rows,
        materiasPrimas: materiasRes.rows,
        estacionMap, familiaMap, reglaMap, recetaBomMap, materiaPrimaMap, familiaEstacionesMap
    };
};

const mergearFilas = (rows) => {
    const merged = {};
    const mergeOrder = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const codigo = String(row['codigo'] || row['Codigo'] || row['CODIGO'] || row['ItemCode'] || '').trim();
        const pedido = String(row['pedido'] || row['Pedido'] || row['PEDIDO'] || row['DocEntry'] || '').trim();
        const item = Number(row['item'] || row['Item'] || row['ITEM'] || i + 1);
        const key = `${pedido}|${item}|${codigo}`;
        const ancho = Number(row['anho'] || row['ancho'] || row['Ancho'] || row['ANHO'] || row['ANCHO'] || row['Width'] || 0);
        const alto = Number(row['alto'] || row['Alto'] || row['ALTO'] || row['Height'] || 0);

        if (!codigo || !ancho || !alto) continue;

        if (!merged[key]) {
            merged[key] = {
                codigo, pedido, item,
                cliente: String(row['cliente'] || row['Cliente'] || row['CLIENTE'] || row['CardName'] || '').trim(),
                descripcion: String(row['descripcion'] || row['Descripcion'] || row['ItemName'] || '').trim(),
                ancho, alto,
                cantidad: Number(row['cantidad'] || row['Cantidad'] || row['CANTIDAD'] || row['cant'] || row['Cant'] || row['CANT'] || 1),
                precio_unitario: Number(row['precio'] || row['Precio'] || row['precio_unitario'] || row['Price'] || 0),
                radio: Number(row['radio'] || row['Radio'] || row['RADIO'] || 0) === 1,
                pulido: Number(row['pulido'] || row['Pulido'] || row['PULIDO'] || 0) === 1,
                mecanizado: Number(row['mecanizado'] || row['Mecanizado'] || row['MECANIZADO'] || row['perforaciones'] || row['Perforaciones'] || 0) > 0,
                ventana: Number(row['ventana'] || row['Ventana'] || row['VENTANA'] || 0) === 1,
                pintado: Number(row['pintado'] || row['Pintado'] || row['PINTADO'] || 0) === 1,
                pintado_car: Number(row['pintado car'] || row['pintado_car'] || row['PintadoCar'] || row['PINTADO CAR'] || row['pintado_carroceros'] || row['PINTADO_CARROCEROS'] || 0) === 1,
                tipo_venta: String(row['tipo de venta'] || row['tipo_de_venta'] || row['TipoVenta'] || row['TIPO VENTA'] || row['TIPO_DE_VENTA'] || 'Normal').trim(),
                familia_codigo: String(row['familia'] || row['Familia'] || row['FAMILIA'] || row['grupo'] || row['Grupo'] || '').trim(),
                fecha_creacion: String(row['fecha_creacion'] || row['FechaCreacion'] || row['fecha'] || row['Fecha'] || '').trim() || null,
                nota: String(row['nota'] || row['Nota'] || row['NOTA'] || row['observacion'] || row['Observacion'] || '').trim() || null,
                posicion: String(row['posicion'] || row['Posicion'] || row['POSICION'] || row['position'] || '').trim() || null,
                orden_compra: String(row['orden de compra'] || row['orden_compra'] || row['OrdenCompra'] || row['ORDEN DE COMPRA'] || row['OC'] || row['oc'] || '').trim() || null,
                tipo_entrega: String(row['tipo de entrega'] || row['tipo_entrega'] || row['TipoEntrega'] || row['TIPO DE ENTREGA'] || 'Despacho').trim(),
                kilos: Number(row['kilos'] || row['Kilos'] || row['KILOS'] || row['peso'] || row['Peso'] || row['PESO'] || 0)
            };
            mergeOrder.push(key);
        } else {
            merged[key].cantidad += Number(row['cantidad'] || row['Cantidad'] || row['CANTIDAD'] || 1);
        }
    }

    return { merged, mergeOrder };
};

const buscarFamiliaParaFila = async (r, maestros) => {
    const { familias, familiaMap } = maestros;

    if (r.familia_codigo) {
        let familia = familiaMap[r.familia_codigo] || null;
        if (!familia) {
            familia = familias.find(f => f.nombre_familia.toLowerCase().includes(r.familia_codigo.toLowerCase()));
        }
        if (familia) return familia;
    }

    for (const f of familias) {
        if (r.descripcion && r.descripcion.toLowerCase().includes(f.nombre_familia.toLowerCase())) return f;
    }

    const codFam = await query('SELECT familia FROM produccion_codigos WHERE codigo = $1', [r.codigo]);
    if (codFam.rows.length && codFam.rows[0].familia) {
        return familias.find(f => f.nombre_familia.toLowerCase() === codFam.rows[0].familia.toLowerCase()) || null;
    }
    return null;
};

const calcularEstaciones = (r, familia, maestros) => {
    const { estacionesMaestras, estacionMap, reglaMap, familiaEstacionesMap } = maestros;

    let estacionesFinales = [];
    if (familia && familiaEstacionesMap[familia.id]) {
        estacionesFinales = [...familiaEstacionesMap[familia.id]];
    } else {
        estacionesFinales = [estacionMap['Corte']?.id, estacionMap['Pulido']?.id, estacionMap['Templado']?.id].filter(Boolean);
    }

    const flagsMap = { radio: 'radio', pulido: 'pulido', mecanizado: 'mecanizado', ventana: 'ventana', pintado: 'pintado', pintado_car: 'pintado_car' };
    for (const [flag, nombre] of Object.entries(flagsMap)) {
        if (r[flag] && reglaMap[nombre]) {
            const estId = reglaMap[nombre].estacion_id;
            if (!estacionesFinales.includes(estId)) estacionesFinales.push(estId);
        }
    }

    estacionesFinales.sort((a, b) => {
        const ea = estacionesMaestras.find(e => e.id === a);
        const eb = estacionesMaestras.find(e => e.id === b);
        return (ea?.orden_secuencia_defecto || 99) - (eb?.orden_secuencia_defecto || 99);
    });

    return estacionesFinales;
};

const importarOrdenes = async (rows) => {
    const maestros = await cargarDatosMaestros();
    const { merged, mergeOrder } = mergearFilas(rows);
    const { recetaBomMap, materiaPrimaMap, materiasPrimas } = maestros;

    const resultados = { importadas: 0, errores: [], pasos_creados: 0, fusiones: rows.length - mergeOrder.length, costos_calculados: 0 };

    for (const key of mergeOrder) {
        try {
            const r = merged[key];
            const m2 = ((r.ancho / 1000) * (r.alto / 1000)) * r.cantidad;
            const familia = await buscarFamiliaParaFila(r, maestros);
            const estacionesFinales = calcularEstaciones(r, familia, maestros);
            const es_compuesto = recetaBomMap[r.codigo] && recetaBomMap[r.codigo].length > 0;

            if (es_compuesto) {
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
                         nota, posicion, orden_compra, tipo_entrega, kilos, created_at)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25) RETURNING id`,
                        [r.pedido, r.cliente, mp.codigo_mp, mp.nombre || r.descripcion, r.ancho, r.alto, m2,
                         comp.id, r.tipo_venta, r.item, r.cantidad, familia?.id || null, r.codigo,
                         costo_hh, costo_energia, costo_mp_total, costo_total, r.precio_unitario, margen,
                         r.nota, r.posicion, r.orden_compra, r.tipo_entrega, Number(r.kilos || 0),
                         r.fecha_creacion || new Date().toISOString()]
                    );
                    const ordenId = result.rows[0].id;
                    for (let s = 0; s < estacionesFinales.length; s++) {
                        await query("INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, 'PENDIENTE')",
                            [ordenId, estacionesFinales[s], s + 1]);
                        resultados.pasos_creados++;
                    }
                    resultados.importadas++;
                    resultados.costos_calculados++;
                }
            } else {
                const costo_hh = familia ? Number(familia.costo_hh) : 0;
                const costo_energia = familia ? Number(familia.costo_energia) : 0;
                const costo_total = costo_hh + costo_energia;
                const margen = r.precio_unitario * r.cantidad - costo_total;

                const result = await query(
                    `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                     es_compuesto, tipo_venta, item_numero, cantidad, familia_id, codigo_padre,
                     costo_hh, costo_energia, costo_materia_prima, costo_total_estimado, precio_unitario_sap, margen_estimado,
                     nota, posicion, orden_compra, tipo_entrega, kilos, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24) RETURNING id`,
                    [r.pedido, r.cliente, r.codigo, r.descripcion, r.ancho, r.alto, m2,
                     r.tipo_venta, r.item, r.cantidad, familia?.id || null, r.codigo,
                     costo_hh, costo_energia, 0, costo_total, r.precio_unitario, margen,
                     r.nota, r.posicion, r.orden_compra, r.tipo_entrega, Number(r.kilos || 0),
                     r.fecha_creacion || new Date().toISOString()]
                );
                const ordenId = result.rows[0].id;
                for (let s = 0; s < estacionesFinales.length; s++) {
                    await query("INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, 'PENDIENTE')",
                        [ordenId, estacionesFinales[s], s + 1]);
                    resultados.pasos_creados++;
                }
                resultados.importadas++;
                if (familia) resultados.costos_calculados++;
            }
        } catch (eRow) {
            console.error('[PROD] Error en fila', key, ':', eRow.message);
            resultados.errores.push({ fila: key, error: eRow.message });
        }
    }

    console.log('[PROD] Importacion completada:', resultados);
    return resultados;
};

module.exports = { importarOrdenes };
