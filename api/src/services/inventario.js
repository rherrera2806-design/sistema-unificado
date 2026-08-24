const { query } = require('../config/database');
const { sanitizeString } = require('../utils/helpers');

async function getMovimientos(filtros = {}) {
    let sql = `SELECT m.*, u.nombre as usuario_nombre,
        mp.codigo_mp, mp.nombre as mp_nombre, mp.espesor_mm, mp.costo_unitario_mp
        FROM movimientos m 
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        LEFT JOIN materias_primas mp ON m.materia_prima_id = mp.id`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.tipo) { conditions.push(`m.tipo_movimiento = $${idx++}`); params.push(filtros.tipo); }
    if (filtros.cristal) { conditions.push(`(mp.nombre ILIKE $${idx} OR m.tipo_cristal ILIKE $${idx})`); params.push('%' + filtros.cristal + '%'); idx++; }
    if (filtros.fechaInicio) { conditions.push(`m.fecha_hora >= $${idx++}`); params.push(filtros.fechaInicio); }
    if (filtros.fechaFin) { conditions.push(`m.fecha_hora <= $${idx++}`); params.push(filtros.fechaFin + ' 23:59:59'); }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY m.fecha_hora DESC';
    const result = await query(sql, params);
    return result.rows;
}

async function crearMovimiento(data) {
    const { usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, proveedor, turno, tipo_salida, observaciones, fecha_hora } = data;
    
    let tipoCristalFinal = tipo_cristal;
    let espesorFinal = espesor;
    let anchoFinal = ancho;
    let altoFinal = alto;
    
    // Si se proporciona materia_prima_id, obtener datos de la materia prima
    if (materia_prima_id) {
        const mpResult = await query('SELECT * FROM materias_primas WHERE id = $1', [materia_prima_id]);
        if (mpResult.rows.length > 0) {
            const mp = mpResult.rows[0];
            tipoCristalFinal = mp.nombre;
            espesorFinal = mp.espesor_mm;
            // Usar dimensiones de la materia prima si no se proporcionan
            if (!ancho || !alto) {
                anchoFinal = mp.ancho_nal || mp.ancho || 0;
                altoFinal = mp.alto_nal || mp.alto || 0;
            }
        }
    }
    
    const anchoInt = parseInt(anchoFinal);
    const altoInt = parseInt(altoFinal);
    if (isNaN(anchoInt) || anchoInt <= 0) throw new Error('Ancho debe ser un numero entero positivo');
    if (isNaN(altoInt) || altoInt <= 0) throw new Error('Alto debe ser un numero entero positivo');
    const metros_cuadrados = (anchoInt * altoInt * cantidad_planchas) / 1000000;
    const espesorInt = parseInt(espesorFinal) || 0;
    
    const result = await query(
        `INSERT INTO movimientos (usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, turno, tipo_salida, observaciones, fecha_hora)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
        [usuario_id || null, tipo_movimiento, materia_prima_id || null, tipoCristalFinal, espesorInt, anchoInt, altoInt, cantidad_planchas, metros_cuadrados.toFixed(4), proveedor || null, turno || null, tipo_salida || null, observaciones || null, fecha_hora || new Date().toISOString()]
    );
    return result.rows[0];
}

async function eliminarMovimiento(id) {
    const result = await query('DELETE FROM movimientos WHERE id = $1', [id]);
    return result.rowCount > 0;
}

async function editarMovimiento(id, data) {
    const { tipo_movimiento, tipo_salida, ancho, alto, cantidad_planchas, proveedor, turno, observaciones, fecha_hora } = data;
    const m2 = ((parseInt(ancho) || 0) * (parseInt(alto) || 0) * (parseInt(cantidad_planchas) || 0)) / 1000000;
    const result = await query(
        `UPDATE movimientos SET tipo_movimiento = $1, tipo_salida = $2, ancho = $3, alto = $4, cantidad_planchas = $5, metros_cuadrados = $6, proveedor = $7, turno = $8, observaciones = $9, fecha_hora = $10 WHERE id = $11 RETURNING *`,
        [tipo_movimiento, tipo_salida || null, parseInt(ancho) || 0, parseInt(alto) || 0, parseInt(cantidad_planchas) || 0, m2.toFixed(4), proveedor || null, turno || null, observaciones || null, fecha_hora || null, id]
    );
    return result.rows[0] || null;
}

async function limpiarMovimientos() {
    const result = await query('DELETE FROM movimientos');
    return result.rowCount;
}

async function getInventario(filtros = {}) {
    let sql = `SELECT 
        mp.codigo_mp,
        mp.codigo_sap,
        mp.nombre as tipo_cristal,
        mp.espesor_mm as espesor,
        mp.costo_unitario_mp,
        mp.costo_unitario_importado,
        mp.consumo_promedio_mensual,
        m.ancho,
        m.alto,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END), 0) as salidas_plancha,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'trozo' THEN m.cantidad_planchas ELSE 0 END), 0) as trozos,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.metros_cuadrados ELSE 0 END), 0) as m2_entradas,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.metros_cuadrados ELSE 0 END), 0) as m2_salidas
        FROM movimientos m
        LEFT JOIN materias_primas mp ON m.materia_prima_id = mp.id
        WHERE m.ancho IS NOT NULL AND m.alto IS NOT NULL`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.cristal) { conditions.push(`mp.nombre ILIKE $${idx}`); params.push('%' + filtros.cristal + '%'); idx++; }
    if (filtros.espesor) { conditions.push(`mp.espesor_mm = $${idx}`); params.push(filtros.espesor); idx++; }
    if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
    sql += ` GROUP BY mp.codigo_mp, mp.codigo_sap, mp.nombre, mp.espesor_mm, mp.costo_unitario_mp, mp.costo_unitario_importado, mp.consumo_promedio_mensual, m.ancho, m.alto
        ORDER BY mp.nombre, mp.espesor_mm, m.ancho, m.alto`;
    const result = await query(sql, params);
    
    // Calcular autonomia por codigo_mp (stock total del codigo / CPM)
    const stockPorCodigo = {};
    result.rows.forEach(r => {
        const cod = r.codigo_mp;
        if (!stockPorCodigo[cod]) stockPorCodigo[cod] = 0;
        stockPorCodigo[cod] += Number(r.entradas) - Number(r.salidas_plancha);
    });
    
    return result.rows.map(r => {
        const stock = Number(r.entradas) - Number(r.salidas_plancha);
        const cpm = Number(r.consumo_promedio_mensual) || 0;
        const stockTotalCodigo = stockPorCodigo[r.codigo_mp] || 0;
        const autonomiaMeses = cpm > 0 ? (stockTotalCodigo / cpm) : 0;
        const autonomiaDias = Math.round(autonomiaMeses * 21);
        return {
            ...r, stock, entradas: Number(r.entradas), salidas_plancha: Number(r.salidas_plancha),
            trozos: Number(r.trozos), m2_entradas: Number(r.m2_entradas), m2_salidas: Number(r.m2_salidas),
            autonomia_meses: Math.round(autonomiaMeses * 10) / 10,
            autonomia_dias: autonomiaDias
        };
    });
}

async function getEstadisticas() {
    const [total, entradas, salidas, stock] = await Promise.all([
        query('SELECT COUNT(*) as c FROM movimientos'),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'entrada'"),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'salida'"),
        query(`SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END), 0) as stock_m2 FROM movimientos`)
    ]);
    // Obtener tipos de cristal desde materias_primas
    const tiposResult = await query('SELECT DISTINCT nombre FROM materias_primas WHERE nombre IS NOT NULL ORDER BY nombre');
    return {
        totalMovimientos: Number(total.rows[0].c), totalEntradas: Number(entradas.rows[0].c),
        totalSalidas: Number(salidas.rows[0].c), tiposCristal: tiposResult.rows.map(r => r.nombre),
        stockM2: Number(stock.rows[0].stock_m2)
    };
}

async function getStockPorDimension(materiaPrimaId) {
    const result = await query(`
        SELECT m.ancho, m.alto,
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END), 0) as stock,
            ROUND((m.ancho * m.alto) / 1000000.0, 4) as m2_unitario
        FROM movimientos m
        WHERE m.materia_prima_id = $1 AND m.ancho IS NOT NULL AND m.alto IS NOT NULL
        GROUP BY m.ancho, m.alto
        HAVING SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END) -
               SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END) > 0
        ORDER BY m.ancho, m.alto
    `, [materiaPrimaId]);
    return result.rows.map(r => ({
        ancho: Number(r.ancho), alto: Number(r.alto),
        stock: Number(r.stock), m2_unitario: Number(r.m2_unitario)
    }));
}

async function getEstadisticasPorTipo() {
    const result = await query(`SELECT 
        mp.nombre as tipo,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.metros_cuadrados ELSE 0 END), 0) as entradas_m2,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.metros_cuadrados ELSE 0 END), 0) as salidas_m2
        FROM materias_primas mp
        LEFT JOIN movimientos m ON m.materia_prima_id = mp.id
        GROUP BY mp.id, mp.nombre ORDER BY mp.nombre`);
    return result.rows.map(r => ({
        tipo: r.tipo, entradas: Number(r.entradas_m2),
        salidas: Number(r.salidas_m2), stock: Number(r.entradas_m2) - Number(r.salidas_m2)
    }));
}

module.exports = { getMovimientos, crearMovimiento, editarMovimiento, eliminarMovimiento, limpiarMovimientos, getInventario, getStockPorDimension, getEstadisticas, getEstadisticasPorTipo };
