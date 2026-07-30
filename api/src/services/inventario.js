const { query } = require('../config/database');
const { sanitizeString } = require('../utils/helpers');

async function getMovimientos(filtros = {}) {
    let sql = 'SELECT m.*, u.nombre as usuario_nombre FROM movimientos m LEFT JOIN usuarios u ON m.usuario_id = u.id';
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.tipo) { conditions.push(`m.tipo_movimiento = $${idx++}`); params.push(filtros.tipo); }
    if (filtros.cristal) { conditions.push(`m.tipo_cristal = $${idx++}`); params.push(filtros.cristal); }
    if (filtros.fechaInicio) { conditions.push(`m.fecha_hora >= $${idx++}`); params.push(filtros.fechaInicio); }
    if (filtros.fechaFin) { conditions.push(`m.fecha_hora <= $${idx++}`); params.push(filtros.fechaFin + ' 23:59:59'); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY m.fecha_hora DESC';
    const result = await query(sql, params);
    return result.rows;
}

async function crearMovimiento(data) {
    const { usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, proveedor, tipo_salida, observaciones, fecha_hora } = data;
    const anchoInt = parseInt(ancho);
    const altoInt = parseInt(alto);
    if (isNaN(anchoInt) || anchoInt <= 0) throw new Error('Ancho debe ser un numero entero positivo');
    if (isNaN(altoInt) || altoInt <= 0) throw new Error('Alto debe ser un numero entero positivo');
    const metros_cuadrados = (anchoInt * altoInt * cantidad_planchas) / 1000000;
    const result = await query(
        `INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, tipo_salida, observaciones, fecha_hora)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [usuario_id || null, tipo_movimiento, tipo_cristal, espesor, anchoInt, altoInt, cantidad_planchas, metros_cuadrados.toFixed(4), proveedor || null, tipo_salida || null, observaciones || null, fecha_hora || new Date().toISOString()]
    );
    return result.rows[0];
}

async function eliminarMovimiento(id) {
    const result = await query('DELETE FROM movimientos WHERE id = $1', [id]);
    return result.rowCount > 0;
}

async function getInventario(filtros = {}) {
    let sql = `SELECT tipo_cristal, espesor, ancho, alto,
        SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad_planchas ELSE 0 END) as entradas,
        SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN cantidad_planchas ELSE 0 END) as salidas_plancha,
        SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'trozo' THEN cantidad_planchas ELSE 0 END) as trozos,
        SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END) as m2_entradas,
        SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END) as m2_salidas
        FROM movimientos`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.cristal) { conditions.push(`tipo_cristal = $${idx++}`); params.push(filtros.cristal); }
    if (filtros.espesor) { conditions.push(`espesor = $${idx++}`); params.push(filtros.espesor); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' GROUP BY tipo_cristal, espesor, ancho, alto ORDER BY tipo_cristal, espesor';
    const result = await query(sql, params);
    return result.rows.map(r => ({
        ...r, stock: Number(r.entradas) - Number(r.salidas_plancha),
        entradas: Number(r.entradas), salidas_plancha: Number(r.salidas_plancha),
        trozos: Number(r.trozos), m2_entradas: Number(r.m2_entradas), m2_salidas: Number(r.m2_salidas)
    }));
}

async function getEstadisticas() {
    const [total, entradas, salidas, tipos, stock] = await Promise.all([
        query('SELECT COUNT(*) as c FROM movimientos'),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'entrada'"),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'salida'"),
        query('SELECT DISTINCT tipo_cristal FROM movimientos ORDER BY tipo_cristal'),
        query(`SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END), 0) as stock_m2 FROM movimientos`)
    ]);
    return {
        totalMovimientos: Number(total.rows[0].c), totalEntradas: Number(entradas.rows[0].c),
        totalSalidas: Number(salidas.rows[0].c), tiposCristal: tipos.rows.map(r => r.tipo_cristal),
        stockM2: Number(stock.rows[0].stock_m2)
    };
}

async function getEstadisticasPorTipo() {
    const result = await query(`SELECT tipo_cristal,
        SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END) as entradas_m2,
        SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END) as salidas_m2
        FROM movimientos GROUP BY tipo_cristal ORDER BY tipo_cristal`);
    return result.rows.map(r => ({
        tipo: r.tipo_cristal, entradas: Number(r.entradas_m2),
        salidas: Number(r.salidas_m2), stock: Number(r.entradas_m2) - Number(r.salidas_m2)
    }));
}

module.exports = { getMovimientos, crearMovimiento, eliminarMovimiento, getInventario, getEstadisticas, getEstadisticasPorTipo };
