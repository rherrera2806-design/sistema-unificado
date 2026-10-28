// ============================================================================
// Precios de venta SAP.
//
// El usuario exporta de SAP el listado de una OV (pedido + item + precio
// unitario) y lo sube aquí. Se guarda en la tabla PROPIA sap_precios, que NO
// toca produccion_ordenes: solo acumula precio por (pedido + item).
//
// El reporte de ventas por vendedor cruza después sap_precios con
// produccion_ordenes (pedido_sap_id + item_numero) para saber a qué vendedor
// pertenece cada precio.
//
// UPSERT: si se carga la misma OV dos veces, se ACTUALIZA el precio (no se
// duplica), gracias al UNIQUE(pedido_sap_id, item_numero).
// ============================================================================
const { query } = require('../config/database');

// Aliases tolerados para cada columna. La comparación es INSENSIBLE a
// mayúsculas/minúsculas (ver _col): SAP puede emitir "Unit Price", "unit
// price", "PRECIO UNITARIO", "Doc. num.", etc.
const _col = (row, nombres) => {
    // Claves del row en minúsculas + sin espores dobles, para comparar manzanas con manzanas
    const claves = Object.keys(row);
    for (const n of nombres) {
        const objetivo = n.toLowerCase().trim();
        for (const k of claves) {
            if (k.toLowerCase().trim() === objetivo) {
                const v = row[k];
                if (v !== undefined && v !== null && String(v).trim() !== '') return v;
            }
        }
    }
    return '';
};

const _num = (v) => {
    if (v === undefined || v === null || String(v).trim() === '') return 0;
    // Acepta "1.234,56" (es-CL) y "1234.56". Si hay coma decimal, quitar puntos de miles.
    let s = String(v).trim().replace(/\s/g, '').replace(/[^0-9.,-]/g, '');
    if (s.includes(',') && s.includes('.')) {
        // Ambos: el último separador es el decimal
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g, '').replace(',', '.');
        else s = s.replace(/,/g, '');
    } else if (s.includes(',')) {
        s = s.replace(/\./g, '').replace(',', '.');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
};

const _int = (v) => {
    // Vacío o sin número → null (los callers distinguen "no venía" de "era 0")
    if (v === undefined || v === null || String(v).trim() === '') return null;
    const n = _num(v);
    return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Parsea y valida las filas del Excel SIN tocar la base de datos.
 * Es la ÚNICA fuente de verdad del parseo: la usan tanto la validación previa
 * (validarPrecios) como el guardado real (importarPrecios), así lo que ves en
 * la preview es EXACTAMENTE lo que se va a guardar.
 * Devuelve { validas, errores }.
 */
const _parseRows = (rows) => {
    const validas = [];
    const errores = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const filaExcel = i + 2; // +2: el encabezado es fila 1, datos parten en 2

        const pedido = String(_col(row, ['pedido', 'Pedido', 'PEDIDO', 'numero_pedido', 'N° Pedido', 'OV', 'ov', 'Doc. num.', 'Doc Num', 'DocNum', 'Document', 'Order', 'Order No.', 'Sales Document', 'Base Ref'])).trim();
        if (!pedido) {
            errores.push({ fila: filaExcel, error: 'Sin número de pedido' });
            continue;
        }

        const itemRaw = _col(row, ['item', 'Item', 'ITEM', 'Linea', 'Línea', 'Line', 'Line No.', 'LineNo', 'No. linea', 'Subitem', 'SubItem', 'Line Number']);
        const item = itemRaw === '' ? 1 : (_int(itemRaw) || 1);

        const precioRaw = _col(row, ['precio unitario', 'Precio Unitario', 'precio_unitario', 'PRECIO UNITARIO', 'precio', 'Precio', 'PRECIO', 'precio venta', 'Precio Venta', 'unit price', 'Unit Price', 'UnitPrice', 'price', 'Price', 'PRICE', 'Monto', 'monto', 'Total', 'total', 'Valor', 'valor', 'Amount', 'amount', 'Line Total', 'price (unit)']);
        const precio = _num(precioRaw);
        if (precio <= 0) {
            errores.push({ fila: filaExcel, pedido, error: 'Precio unitario vacío o no numérico ("' + String(precioRaw).slice(0, 20) + '")' });
            continue;
        }

        const cliente = String(_col(row, ['cliente', 'Cliente', 'CLIENTE', 'CardName', 'Card Name', 'Razon social', 'Customer', 'customer'])).trim().slice(0, 200);
        const cantidadRaw = _col(row, ['cantidad', 'Cantidad', 'CANTIDAD', 'Qty', 'Qty.', 'Cant.', 'Quantity', 'quantity']);
        const cantidad = cantidadRaw === '' ? null : _int(cantidadRaw);

        validas.push({ fila: filaExcel, pedido, item, precio, cantidad, cliente });
    }

    return { validas, errores };
};

/**
 * VALIDACIÓN PREVIA (dry run): analiza el Excel y devuelve la preview de lo que
 * se guardaría, SIN escribir nada. Para cada fila válida indica si coincide con
 * una orden de Producción (→ tendrá vendedor) o no, y si será precio nuevo o
 * una actualización de uno ya cargado.
 */
const validarPrecios = async (rows) => {
    const { validas, errores } = _parseRows(rows);

    const pedidos = [...new Set(validas.map(v => v.pedido))];
    const ordenesMap = {};
    const existentesMap = {};

    if (pedidos.length > 0) {
        // ¿A qué orden/vendedor pertenece cada (pedido + item)?
        const rOrdenes = await query(
            `SELECT o.pedido_sap_id, o.item_numero, o.id,
                    COALESCE(NULLIF(TRIM(o.vendedor), ''), COALESCE(u.nombre, ped.vendedor)) as vendedor_nombre
             FROM produccion_ordenes o
             LEFT JOIN pedidos ped ON ped.numero_pedido = o.pedido_sap_id
             LEFT JOIN usuarios u ON u.email = ped.vendedor
             WHERE o.pedido_sap_id = ANY($1)`,
            [pedidos]
        );
        for (const o of rOrdenes.rows) ordenesMap[o.pedido_sap_id + '|' + o.item_numero] = o;

        // ¿Ya existe un precio cargado para ese (pedido + item)? → será update
        const rExis = await query(
            'SELECT pedido_sap_id, item_numero FROM sap_precios WHERE pedido_sap_id = ANY($1)',
            [pedidos]
        );
        for (const e of rExis.rows) existentesMap[e.pedido_sap_id + '|' + e.item_numero] = true;
    }

    const preview = validas.map(v => {
        const key = v.pedido + '|' + v.item;
        const o = ordenesMap[key];
        return {
            fila: v.fila,
            pedido: v.pedido,
            item: v.item,
            precio: v.precio,
            cantidad: v.cantidad,
            cliente: v.cliente,
            orden_id: o ? o.id : null,
            vendedor_nombre: o ? o.vendedor_nombre : null,
            // 'cruzada' = coincide con una orden de Producción (tendrá vendedor)
            estado: o ? 'cruzada' : 'sin_orden',
            accion: existentesMap[key] ? 'actualizar' : 'nuevo'
        };
    });

    const cruces = preview.filter(p => p.estado === 'cruzada').length;
    const sinOrden = preview.length - cruces;

    return {
        dryRun: true,
        total: rows.length,
        validas: preview.length,
        conError: errores.length,
        cruzadas: cruces,
        sinOrden,
        seranNuevos: preview.filter(p => p.accion === 'nuevo').length,
        seranActualizados: preview.filter(p => p.accion === 'actualizar').length,
        aGuardar: preview.length, // las válidas se guardan todas (con o sin orden)
        errores,
        preview: preview.slice(0, 50) // tope para la UI
    };
};

/**
 * Guarda las filas del Excel (UPSERT). Devuelve { importados, actualizados,
 * ignoradas, errores }.
 * - importados: precios nuevos insertados
 * - actualizados: precios que ya existían y se sobrescribieron
 * - ignoradas: filas sin pedido o sin precio válido
 * - errores: descripción de las filas ignoradas (para mostrarlas en la UI)
 */
const importarPrecios = async (rows) => {
    const { validas, errores } = _parseRows(rows);
    let importados = 0;
    let actualizados = 0;

    for (const v of validas) {
        // UPSERT: misma OV + item → actualiza, no duplica.
        const result = await query(
            `INSERT INTO sap_precios (pedido_sap_id, item_numero, precio_unitario, cantidad, cliente, created_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (pedido_sap_id, item_numero)
             DO UPDATE SET precio_unitario = EXCLUDED.precio_unitario,
                            cantidad = COALESCE(EXCLUDED.cantidad, sap_precios.cantidad),
                            cliente = CASE WHEN EXCLUDED.cliente <> '' THEN EXCLUDED.cliente ELSE sap_precios.cliente END,
                            created_at = NOW()
             RETURNING (xmax = 0) as es_nuevo`,
            [v.pedido, v.item, v.precio, v.cantidad, v.cliente]
        );
        if (result.rows[0] && result.rows[0].es_nuevo) importados++;
        else actualizados++;
    }

    return { importados, actualizados, ignoradas: errores.length, errores, total: rows.length };
};

/** Lista los precios cargados, con el cruce a produccion_ordenes para saber
 *  si cada precio corresponde a una orden conocida (y su vendedor). */
const getPrecios = async () => {
    const result = await query(`
        SELECT sp.id, sp.pedido_sap_id, sp.item_numero, sp.precio_unitario,
               sp.cantidad, sp.cliente, sp.created_at,
               o.id as orden_id, o.vendedor as vendedor_orden,
               COALESCE(NULLIF(TRIM(o.vendedor), ''), COALESCE(u.nombre, ped.vendedor)) as vendedor_nombre
        FROM sap_precios sp
        LEFT JOIN produccion_ordenes o
            ON o.pedido_sap_id = sp.pedido_sap_id AND o.item_numero = sp.item_numero
        LEFT JOIN pedidos ped ON ped.numero_pedido = sp.pedido_sap_id
        LEFT JOIN usuarios u ON u.email = ped.vendedor
        ORDER BY sp.created_at DESC, sp.pedido_sap_id, sp.item_numero
    `);
    return result.rows;
};

/** Borra un precio puntual (corregir fila cargada mal). */
const borrarPrecio = async (id) => {
    const result = await query('DELETE FROM sap_precios WHERE id = $1', [id]);
    if (result.rowCount === 0) {
        const err = new Error('Precio no encontrado');
        err.status = 404;
        throw err;
    }
    return { borrados: result.rowCount };
};

/** Vacía todos los precios (recarga limpia tras carga errónea). */
const vaciarPrecios = async () => {
    const result = await query('DELETE FROM sap_precios');
    return { borrados: result.rowCount };
};

/** Resumen para la UI: cuántos precios hay y a cuántas órdenes llegan. */
const getResumen = async () => {
    const result = await query(`
        SELECT
            COUNT(*) as total_precios,
            COUNT(DISTINCT sp.pedido_sap_id) as total_pedidos,
            COUNT(o.id) as cruzadas,
            COUNT(*) - COUNT(o.id) as sin_orden
        FROM sap_precios sp
        LEFT JOIN produccion_ordenes o
            ON o.pedido_sap_id = sp.pedido_sap_id AND o.item_numero = sp.item_numero
    `);
    return result.rows[0] || {};
};

// Se exportan los helpers internos para poder testear el parseo (columnas de
// SAP con distintos nombres/mayúsculas) sin necesidad de base de datos.
module.exports = { importarPrecios, validarPrecios, getPrecios, getResumen, borrarPrecio, vaciarPrecios, _col, _num, _int, _parseRows };
