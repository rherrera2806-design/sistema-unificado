const { query } = require('../config/database');
const { sanitizeString } = require('../utils/helpers');

async function getTiposCristal() {
    const result = await query('SELECT * FROM catalogo_tipos_cristal WHERE activo = TRUE ORDER BY espesor, nombre');
    return result.rows;
}

async function crearTipoCristal(data) {
    let nombre = sanitizeString(data.nombre || data);
    if (!nombre) throw new Error('Nombre requerido');
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    const espesor = parseInt(data.espesor) || 0;
    const exists = await query('SELECT id FROM catalogo_tipos_cristal WHERE nombre = $1 AND espesor = $2 AND activo = TRUE', [nombre, espesor]);
    if (exists.rows.length > 0) throw new Error('Ya existe este tipo de cristal con ese espesor');
    const codigoSap = sanitizeString(data.codigo_sap) || '';
    const stockCritico = parseInt(data.stock_critico) || 0;
    const consumoMensual = parseInt(data.consumo_mensual_aprox) || 0;
    const result = await query(
        'INSERT INTO catalogo_tipos_cristal (nombre, espesor, codigo_sap, stock_critico, consumo_mensual_aprox) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [nombre, espesor, codigoSap, stockCritico, consumoMensual]
    );
    return result.rows[0];
}

async function eliminarTipoCristal(id) {
    const result = await query('UPDATE catalogo_tipos_cristal SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
}

async function updateTipoCristal(id, data) {
    let nombre = sanitizeString(data.nombre || '');
    if (!nombre) throw new Error('Nombre requerido');
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    const result = await query(
        'UPDATE catalogo_tipos_cristal SET nombre = $1, espesor = $2, codigo_sap = $3, stock_critico = $4, consumo_mensual_aprox = $5 WHERE id = $6 AND activo = TRUE RETURNING *',
        [data.nombre, parseInt(data.espesor) || 0, sanitizeString(data.codigo_sap) || '', parseInt(data.stock_critico) || 0, parseInt(data.consumo_mensual_aprox) || 0, id]
    );
    return result.rows[0] || null;
}

async function getStockPorTipo() {
    const result = await query(`
        SELECT tipo_cristal,
            SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad_planchas ELSE 0 END) -
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN cantidad_planchas ELSE 0 END) as stock_planca
        FROM movimientos GROUP BY tipo_cristal ORDER BY tipo_cristal
    `);
    return result.rows.map(r => ({ tipo: r.tipo_cristal, stock: Number(r.stock_planca) }));
}

async function getAutonomia() {
    const [stockResult, catalogoResult] = await Promise.all([
        query(`SELECT mp.codigo_mp, mp.nombre as tipo_cristal, mp.espesor_mm as espesor,
            SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END) -
            SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END) as stock_planca
            FROM movimientos m
            LEFT JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE mp.codigo_mp IS NOT NULL
            GROUP BY mp.codigo_mp, mp.nombre, mp.espesor_mm`),
        query("SELECT codigo_mp, nombre, espesor_mm, stock_critico, consumo_promedio_mensual FROM materias_primas")
    ]);
    const catalogoMap = {};
    catalogoResult.rows.forEach(c => { catalogoMap[c.codigo_mp] = c; });
    const stockMap = {};
    stockResult.rows.forEach(s => { stockMap[s.codigo_mp] = (stockMap[s.codigo_mp] || 0) + Number(s.stock_planca); });
    const allKeys = new Set([...Object.keys(stockMap), ...Object.keys(catalogoMap)]);
    return Array.from(allKeys).map(codigo => {
        const stock = stockMap[codigo] || 0;
        const cat = catalogoMap[codigo] || {};
        const consumo = Number(cat.consumo_promedio_mensual) || 0;
        const critico = Number(cat.stock_critico) || 0;
        let autonomiaMeses = null, autonomiaSemanas = null, autonomiaDias = null, estado = 'ok';
        if (stock <= 0) { estado = 'sin_stock'; }
        else if (consumo <= 0) { estado = 'sin_datos'; }
        else {
            autonomiaMeses = stock / consumo;
            autonomiaSemanas = Math.round(autonomiaMeses * 4.33 * 10) / 10;
            autonomiaDias = Math.round(autonomiaMeses * 30);
            if (stock <= critico) estado = 'critico';
            else if (autonomiaMeses <= 1) estado = 'advertencia';
        }
        return { codigo_mp: codigo, tipo: cat.nombre || '', espesor: Number(cat.espesor_mm || 0), stock, consumoMensual: consumo, stockCritico: critico,
            autonomiaMeses: autonomiaMeses !== null ? Math.round(autonomiaMeses * 10) / 10 : null,
            autonomiaSemanas, autonomiaDias, estado };
    });
}

async function getAlertas() {
    const autonomia = await getAutonomia();
    return autonomia.filter(a => a.estado === 'critico' || a.estado === 'sin_stock');
}

async function getEspesores() {
    const result = await query('SELECT * FROM catalogo_espesores WHERE activo = TRUE ORDER BY valor');
    return result.rows;
}

async function crearEspesor(valor) {
    const val = parseInt(valor);
    if (isNaN(val) || val <= 0) throw new Error('Valor de espesor invalido');
    const exists = await query('SELECT id FROM catalogo_espesores WHERE valor = $1', [val]);
    if (exists.rows.length > 0) throw new Error('El espesor ya existe');
    const result = await query('INSERT INTO catalogo_espesores (valor) VALUES ($1) RETURNING *', [val]);
    return result.rows[0];
}

async function eliminarEspesor(id) {
    const result = await query('UPDATE catalogo_espesores SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
}

module.exports = {
    getTiposCristal, crearTipoCristal, eliminarTipoCristal, updateTipoCristal,
    getStockPorTipo, getAutonomia, getAlertas, getEspesores, crearEspesor, eliminarEspesor
};
