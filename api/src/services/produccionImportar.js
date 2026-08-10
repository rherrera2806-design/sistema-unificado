const { query } = require('../config/database');
const { explosionBOM, crearOrdenSimple } = require('./produccionBomExplosion');

const cargarDatosMaestros = async () => {
    const [estacionesRes, familiasRes, reglasRes, recetasBomRes, materiasRes, oldRecetasRes] = await Promise.all([
        query('SELECT * FROM estaciones_maestras WHERE activa = TRUE'),
        query('SELECT * FROM familias_producto WHERE activa = TRUE'),
        query('SELECT * FROM reglas_procesos_extras WHERE activa = TRUE'),
        query('SELECT id, codigo_sap_padre, materia_prima_id, familia_id, cantidad, ancho, alto, procesos_especificos_json FROM recetas_bom'),
        query('SELECT * FROM materias_primas'),
        query('SELECT * FROM produccion_recetas_bom')
    ]);

    const estacionMap = {};
    estacionesRes.rows.forEach(e => { estacionMap[e.nombre_estacion] = e; });

    const ordenToEstacionId = {};
    estacionesRes.rows.forEach(e => { ordenToEstacionId[e.orden_secuencia_defecto] = e.id; });

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

    const recetaProcesosMap = {};
    recetasBomRes.rows.forEach(r => {
        const key = String(r.codigo_sap_padre).trim();
        let procs = [];
        try {
            const raw = r.procesos_especificos_json;
            if (Array.isArray(raw)) procs = raw.map(Number).filter(n => Number.isFinite(n) && n > 0);
            else if (typeof raw === 'string') {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) procs = parsed.map(Number).filter(n => Number.isFinite(n) && n > 0);
            }
        } catch (e) { procs = []; }
        if (procs.length > 0) recetaProcesosMap[key] = procs;
    });

    return {
        estacionesMaestras: estacionesRes.rows,
        familias: familiasRes.rows,
        materiasPrimas: materiasRes.rows,
        estacionMap, familiaMap, reglaMap, recetaBomMap, materiaPrimaMap, familiaEstacionesMap,
        recetaProcesosMap, ordenToEstacionId
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
        const ancho = Number(row['anho'] || row['ancho'] || row['Ancho'] || row['ANHO'] || row['ANCHO'] || row['Width'] || row['width'] || row['Largo'] || row['largo'] || 0);
        const alto = Number(row['alto'] || row['Alto'] || row['ALTO'] || row['Height'] || row['height'] || row['Profundidad'] || row['profundidad'] || 0);

        if (!codigo) continue;

        if (!merged[key]) {
            merged[key] = {
                codigo, pedido, item,
                cliente: String(row['cliente'] || row['Cliente'] || row['CLIENTE'] || row['CardName'] || '').trim().toUpperCase(),
                descripcion: String(row['descripcion'] || row['Descripcion'] || row['ItemName'] || '').trim(),
                ancho, alto,
                cantidad: Number(row['cantidad'] || row['Cantidad'] || row['CANTIDAD'] || row['cant'] || row['Cant'] || row['CANT'] || 1),
                precio_unitario: Number(row['precio'] || row['Precio'] || row['precio_unitario'] || row['Price'] || 0),
                radio: Number(row['radio'] || row['Radio'] || row['RADIO'] || 0) === 1,
                pulido: Number(row['pulido'] || row['Pulido'] || row['PULIDO'] || 0) === 1,
                perforado: Number(row['perforado'] || row['Perforado'] || row['PERFORADO'] || row['perforaciones'] || row['Perforaciones'] || 0) > 0,
                destaje: Number(row['destaje'] || row['Destaje'] || row['DESTAJE'] || 0) > 0,
                sacado: Number(row['sacado'] || row['Sacado'] || row['SACADO'] || 0) > 0,
                mecanizado: Number(row['mecanizado'] || row['Mecanizado'] || row['MECANIZADO'] || row['perforaciones'] || row['Perforaciones'] || 0) > 0,
                ventana: Number(row['ventana'] || row['Ventana'] || row['VENTANA'] || 0) === 1,
                pintado: Number(row['pintado'] || row['Pintado'] || row['PINTADO'] || 0) === 1,
                pintado_car: Number(row['pintado car'] || row['pintado_car'] || row['PintadoCar'] || row['PINTADO CAR'] || row['pintado_carroceros'] || row['PINTADO_CARROCEROS'] || 0) === 1,
                tipo_venta: String(row['tipo de venta'] || row['tipo_de_venta'] || row['TipoVenta'] || row['TIPO VENTA'] || row['TIPO_DE_VENTA'] || 'Normal').trim(),
                familia_codigo: String(row['familia'] || row['Familia'] || row['FAMILIA'] || row['grupo'] || row['Grupo'] || '').trim(),
                fecha_creacion: String(row['fecha_creacion'] || row['FechaCreacion'] || row['fecha'] || row['Fecha'] || '').trim() || new Date().toISOString(),
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
    const { estacionesMaestras, estacionMap, reglaMap, familiaEstacionesMap, recetaBomMap, recetaProcesosMap, ordenToEstacionId } = maestros;

    const codigoKey = String(r.codigo || '').trim();
    let estacionesFinales = [];

    const tieneRutaCustom = codigoKey && Array.isArray(recetaProcesosMap[codigoKey]) && recetaProcesosMap[codigoKey].length > 0;
    if (tieneRutaCustom) {
        estacionesFinales = [...recetaProcesosMap[codigoKey]];
    } else {
        let familiaParaRuta = familia;
        if (!familiaParaRuta && codigoKey && recetaBomMap[codigoKey] && recetaBomMap[codigoKey].length > 0) {
            const famId = recetaBomMap[codigoKey][0].familia_id;
            if (famId) {
                familiaParaRuta = (familiaMap && Object.keys(familiaMap).length > 0)
                    ? Object.values(familiaMap).find(f => f.id === famId)
                    : maestros.familias.find(f => f.id === famId);
            }
        }
        if (familiaParaRuta && familiaEstacionesMap[familiaParaRuta.id]) {
            estacionesFinales = [...familiaEstacionesMap[familiaParaRuta.id]];
        } else {
            estacionesFinales = [estacionMap['Corte']?.id, estacionMap['Pulido']?.id, estacionMap['Templado']?.id].filter(Boolean);
        }
    }

    estacionesFinales = estacionesFinales.map(v => {
        if (estacionesMaestras.find(e => e.id === v)) return v;
        if (ordenToEstacionId[v]) return ordenToEstacionId[v];
        return v;
    });

    const flagsMap = { radio: 'radio', pulido: 'pulido', ventana: 'ventana', pintado: 'pintado', pintado_car: 'pintado_car' };
    for (const [flag, nombre] of Object.entries(flagsMap)) {
        if (r[flag] && reglaMap[nombre]) {
            const estId = reglaMap[nombre].estacion_id;
            if (!estacionesFinales.includes(estId)) estacionesFinales.push(estId);
        }
    }

    const ops = [];
    if (r.perforado) ops.push('Perforado');
    if (r.destaje) ops.push('Destaje');
    if (r.sacado) ops.push('Sacado');
    if (ops.length === 0 && r.mecanizado) ops.push('Mecanizado');
    const mecanizadoOperaciones = ops.length > 0 ? 'Operaciones: ' + ops.join(', ') : null;
    const tieneMecanizado = ops.length > 0 || r.mecanizado;
    if (tieneMecanizado && reglaMap['mecanizado']) {
        const estId = reglaMap['mecanizado'].estacion_id;
        if (!estacionesFinales.includes(estId)) estacionesFinales.push(estId);
    }

    estacionesFinales.sort((a, b) => {
        const ea = estacionesMaestras.find(e => e.id === a);
        const eb = estacionesMaestras.find(e => e.id === b);
        return (ea?.orden_secuencia_defecto || 99) - (eb?.orden_secuencia_defecto || 99);
    });

    return { estaciones: estacionesFinales, mecanizadoOperaciones };
};

const importarOrdenes = async (rows) => {
    const maestros = await cargarDatosMaestros();
    const { merged, mergeOrder } = mergearFilas(rows);
    const { recetaBomMap, materiaPrimaMap, materiasPrimas } = maestros;

    const resultados = { importadas: 0, errores: [], pasos_creados: 0, fusiones: rows.length - mergeOrder.length, costos_calculados: 0 };

    for (const key of mergeOrder) {
        try {
            const r = merged[key];
            const tieneBOM = recetaBomMap[r.codigo] && recetaBomMap[r.codigo].length > 0;

            if (!tieneBOM) {
                resultados.errores.push({
                    fila: key,
                    codigo: r.codigo,
                    pedido: r.pedido,
                    error: `Código "${r.codigo}" no tiene receta BOM configurada. Configure la receta antes de importar.`
                });
                continue;
            }

            let ancho = r.ancho;
            let alto = r.alto;
            if (!ancho || !alto) {
                const receta = recetaBomMap[r.codigo].find(rc => rc.ancho && rc.alto) || recetaBomMap[r.codigo][0];
                if (!ancho && receta.ancho) ancho = Number(receta.ancho);
                if (!alto && receta.alto) alto = Number(receta.alto);
            }
            r.ancho = ancho || 0;
            r.alto = alto || 0;

            if (!r.ancho || !r.alto) {
                resultados.errores.push({
                    fila: key,
                    codigo: r.codigo,
                    pedido: r.pedido,
                    error: `Código "${r.codigo}" tiene receta BOM pero sin dimensiones (ancho/alto). Defina dimensiones en la receta.`
                });
                continue;
            }

            const m2 = ((r.ancho / 1000) * (r.alto / 1000)) * r.cantidad;

            if (!r.kilos || r.kilos === 0) {
                const recetas = recetaBomMap[r.codigo] || [];
                for (const rec of recetas) {
                    const mp = rec.materia_prima_id ? materiaPrimaMap[rec.materia_prima_id] : null;
                    if (mp && mp.espesor_mm) {
                        r.kilos = Math.round(m2 * Number(mp.espesor_mm) * 2.5 * 100) / 100;
                        break;
                    }
                }
            }

            const familia = await buscarFamiliaParaFila(r, maestros);
            const { estaciones: estacionesFinales, mecanizadoOperaciones } = calcularEstaciones(r, familia, maestros);

            await explosionBOM(r, recetaBomMap, materiaPrimaMap, materiasPrimas, familia, estacionesFinales, m2, resultados, mecanizadoOperaciones, maestros.ordenToEstacionId);
        } catch (eRow) {
            console.error('[PROD] Error en fila', key, ':', eRow.message);
            resultados.errores.push({ fila: key, error: eRow.message });
        }
    }

    console.log('[PROD] Importacion completada:', resultados);
    return resultados;
};

module.exports = { importarOrdenes };
