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

// Aliases tolerados para cada columna (mayúsculas/minúsculas y variantes comunes
// que SAP puede emitir). El Excel del usuario trae "pedido", "item", "precio
// unitario" pero SAP suele usar otros nombres.
const _col = (row, nombres) => {
    for (const n of nombres) {
        if (row[n] !== undefined && row[n] !== null && String(row[n]).trim() !== '') return row[n];
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
    const n = _num(v);
    return Number.isFinite(n) ? Math.round(n) : null;
};

/**
 * Importa filas del Excel de SAP. Devuelve { importados, actualizados,
 * ignoradas, errores }.
 * - importados: precios nuevos insertados
 * - actualizados: precios que ya existían y se sobrescribieron
 * - ignoradas: filas sin pedido o sin precio válido
 * - errores: descripción de las filas ignoradas (para mostrarlas en la UI)
 */
const importarPrecios = async (rows) => {
    let importados = 0;
    let actualizados = 0;
    let ignoradas = 0;
    const errores = [];

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const filaExcel = i + 2; // +2: el encabezado es fila 1, datos parten en 2

        const pedido = String(_col(row, ['pedido', 'Pedido', 'PEDIDO', 'numero_pedido', 'N° Pedido', 'OV', 'ov', 'Doc. num.', 'Document', 'Order'])).trim();
        if (!pedido) {
            ignoradas++;
            errores.push({ fila: filaExcel, error: 'Sin número de pedido' });
            continue;
        }

        const itemRaw = _col(row, ['item', 'Item', 'ITEM', 'Linea', 'Línea', 'Line', 'No. linea', 'Subitem']);
        const item = itemRaw === '' ? 1 : (_int(itemRaw) || 1);

        const precioRaw = _col(row, ['precio unitario', 'Precio Unitario', 'precio_unitario', 'PRECIO UNITARIO', 'precio', 'Precio', 'PRECIO', 'precio venta', 'Precio Venta', 'unit price', 'Price', 'Monto', 'monto', 'Total', 'total', 'Valor', 'valor']);
        const precio = _num(precioRaw);
        if (precio <= 0) {
            ignoradas++;
            errores.push({ fila: filaExcel, pedido, error: 'Precio unitario vacío o no numérico ("' + String(precioRaw).slice(0, 20) + '")' });
            continue;
        }

        const cliente = String(_col(row, ['cliente', 'Cliente', 'CLIENTE', 'CardName', 'Razon social'])).trim().slice(0, 200);
        const cantidadRaw = _col(row, ['cantidad', 'Cantidad', 'CANTIDAD', 'Qty', 'Cant.']);
        const cantidad = cantidadRaw === '' ? null : _int(cantidadRaw);

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
            [pedido, item, precio, cantidad, cliente]
        );
        if (result.rows[0] && result.rows[0].es_nuevo) importados++;
        else actualizados++;
    }

    return { importados, actualizados, ignoradas, errores, total: rows.length };
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

module.exports = { importarPrecios, getPrecios, getResumen };
