const express = require('express');
const router = express.Router();
const { sanitizeObject } = require('../utils/helpers');
const catalogosService = require('../services/catalogos');
const inventarioService = require('../services/inventario');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'inv_catalogos';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

const MOD_INV = 'inv_inventario';
const canViewInv   = requireAnyPerm(MOD_INV, `${MOD_INV}.editar`, `${MOD_INV}.eliminar`, `${MOD_INV}.agregar`);
const canCreateInv = requireAnyPerm(`${MOD_INV}.agregar`, MOD_INV);
const canUpdateInv = requireAnyPerm(`${MOD_INV}.editar`, MOD_INV);
const canDeleteInv = requireAnyPerm(`${MOD_INV}.eliminar`, MOD_INV);

router.get('/api/catalogos/tipos-cristal', canView, async (req, res, next) => {
    try { res.json(await catalogosService.getTiposCristal()); }
    catch (e) { next(e); }
});

router.post('/api/catalogos/tipos-cristal', canCreate, async (req, res, next) => {
    try { res.status(201).json(await catalogosService.crearTipoCristal(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/catalogos/tipos-cristal/:id', canUpdate, async (req, res, next) => {
    const item = await catalogosService.updateTipoCristal(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
});

router.delete('/api/catalogos/tipos-cristal/:id', canDelete, async (req, res, next) => {
    const item = await catalogosService.eliminarTipoCristal(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, item });
});

router.get('/api/catalogos/espesores', canView, async (req, res, next) => {
    try { res.json(await catalogosService.getEspesores()); }
    catch (e) { next(e); }
});

router.post('/api/catalogos/espesores', canCreate, async (req, res, next) => {
    try { res.status(201).json(await catalogosService.crearEspesor(req.body.valor)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/catalogos/espesores/:id', canDelete, async (req, res, next) => {
    const item = await catalogosService.eliminarEspesor(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, item });
});

router.get('/api/inv/materias-primas', canViewInv, async (req, res, next) => {
    try {
        const prodCatalogos = require('../services/produccionCatalogos');
        res.json(await prodCatalogos.getMateriasPrimas());
    } catch (e) { next(e); }
});

router.get('/api/inv/movimientos', canViewInv, async (req, res, next) => {
    try { res.json(await inventarioService.getMovimientos(req.query)); }
    catch (e) { next(e); }
});

router.post('/api/inv/movimientos', canCreateInv, async (req, res, next) => {
    try { res.status(201).json(await inventarioService.crearMovimiento(sanitizeObject(req.body))); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/inv/movimientos/:id', canDeleteInv, async (req, res, next) => {
    await inventarioService.eliminarMovimiento(Number(req.params.id));
    res.json({ ok: true });
});

router.put('/api/inv/movimientos/:id', canUpdateInv, async (req, res, next) => {
    try {
        const result = await inventarioService.editarMovimiento(Number(req.params.id), sanitizeObject(req.body));
        if (result) res.json(result);
        else res.status(404).json({ error: 'Movimiento no encontrado' });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/inv/movimientos', canDeleteInv, async (req, res, next) => {
    try {
        const result = await inventarioService.limpiarMovimientos();
        res.json({ ok: true, eliminados: result });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/api/inv/inventario', canViewInv, async (req, res, next) => {
    try { res.json(await inventarioService.getInventario(req.query)); }
    catch (e) { next(e); }
});

router.get('/api/inv/stock-por-dimension', canViewInv, async (req, res, next) => {
    try {
        const mpId = Number(req.query.mp_id);
        if (!mpId) return res.status(400).json({ error: 'mp_id requerido' });
        res.json(await inventarioService.getStockPorDimension(mpId));
    } catch (e) { next(e); }
});

router.get('/api/inv/estadisticas', canViewInv, async (req, res, next) => {
    try { res.json(await inventarioService.getEstadisticas()); }
    catch (e) { next(e); }
});

router.get('/api/inv/estadisticas-por-tipo', canViewInv, async (req, res, next) => {
    try { res.json(await inventarioService.getEstadisticasPorTipo()); }
    catch (e) { next(e); }
});

router.get('/api/inv/autonomia', canViewInv, async (req, res, next) => {
    try { res.json(await catalogosService.getAutonomia()); }
    catch (e) { next(e); }
});

router.get('/api/inv/alertas', canViewInv, async (req, res, next) => {
    try { res.json(await catalogosService.getAlertas()); }
    catch (e) { next(e); }
});

router.get('/api/inv/analytics', canViewInv, async (req, res, next) => {
    try { res.json(await inventarioService.getAnalyticsInventario(req.query.meses || 6, req.query.mes || null)); }
    catch (e) { next(e); }
});

router.get('/api/inv/run-migration', canViewInv, async (req, res) => {
    try {
        const { query } = require('../config/database');
        await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS turno VARCHAR(10) DEFAULT NULL");
        res.json({ ok: true, message: 'Columna turno agregada' });
    } catch (e) {
        res.json({ ok: true, message: 'Columna ya existe o error: ' + e.message });
    }
});

// Reporte de inventario por anio
router.get('/api/inv/reporte', canViewInv, async (req, res) => {
    try {
        const { query } = require('../config/database');
        const anio = parseInt(req.query.anio) || new Date().getFullYear();

        const result = await query(`
            SELECT
                EXTRACT(MONTH FROM fecha_hora)::int as mes,
                COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento = 'entrada'), 0)::int as entradas,
                COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento = 'salida'), 0)::int as salidas,
                COALESCE(SUM(metros_cuadrados) FILTER (WHERE tipo_movimiento = 'entrada'), 0)::numeric as m2_entradas,
                COALESCE(SUM(metros_cuadrados) FILTER (WHERE tipo_movimiento = 'salida'), 0)::numeric as m2_salidas,
                COALESCE(NULLIF(tipo_cristal,''), 'Sin tipo') as tipo_cristal,
                espesor
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1
            GROUP BY EXTRACT(MONTH FROM fecha_hora), tipo_cristal, espesor
            ORDER BY mes
        `, [anio]);

        const topMateriales = await query(`
            SELECT tipo_cristal, espesor, COUNT(*)::int as salidas, COALESCE(SUM(metros_cuadrados), 0)::numeric as m2
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1 AND tipo_movimiento = 'salida'
            GROUP BY tipo_cristal, espesor ORDER BY salidas DESC LIMIT 8
        `, [anio]);

        const topDimensiones = await query(`
            SELECT TRIM(TO_CHAR(ancho, 'FM999990')) || 'x' || TRIM(TO_CHAR(alto, 'FM999990')) as dimension, COUNT(*)::int as salidas
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1 AND tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa'
            GROUP BY ancho, alto ORDER BY salidas DESC LIMIT 8
        `, [anio]);

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const porMes = {};
        const porTipo = {};

        for (const row of result.rows) {
            const idx = row.mes - 1;
            if (!porMes[idx]) porMes[idx] = { entradas:0, salidas:0, m2_entradas:0, m2_salidas:0 };
            porMes[idx].entradas += row.entradas;
            porMes[idx].salidas += row.salidas;
            porMes[idx].m2_entradas += parseFloat(row.m2_entradas) || 0;
            porMes[idx].m2_salidas += parseFloat(row.m2_salidas) || 0;

            const tipo = ((row.tipo_cristal || '').trim() || 'Sin tipo') + ' ' + (row.espesor ? row.espesor + 'mm' : '');
            porTipo[tipo.trim()] = (porTipo[tipo.trim()] || 0) + row.salidas;
        }

        const mesesData = meses.map((nombre, i) => ({
            nombre,
            ...(porMes[i] || { entradas:0, salidas:0, m2_entradas:0, m2_salidas:0 })
        }));

        const totalEntradas = mesesData.reduce((s, m) => s + m.entradas, 0);
        const totalSalidas = mesesData.reduce((s, m) => s + m.salidas, 0);
        const totalM2Entradas = mesesData.reduce((s, m) => s + m.m2_entradas, 0);
        const totalM2Salidas = mesesData.reduce((s, m) => s + m.m2_salidas, 0);

        // Agrupar: top 5 tipos, resto como "Otros"
        const todosTipos = Object.entries(porTipo).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total);
        const top5 = todosTipos.slice(0, 5);
        const otrosTotal = todosTipos.slice(5).reduce((s, t) => s + t.total, 0);
        const tiposFinales = top5;
        if (otrosTotal > 0) tiposFinales.push({ nombre: 'Otros', total: otrosTotal });

        // Datos actuales de stock (como el dashboard)
        let stockData = { stockPlanchas: 0, kgStock: 0, autonomia: 0, planchasMes: 0, sparklinePlanchas: [], sparklineKg: [] };
        try {
            const stockRes = await query(`SELECT COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento='entrada'),0) - COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento='salida' AND tipo_salida='plancha_completa'),0) as stock FROM movimientos`);
            const kgRes = await query(`SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN metros_cuadrados * espesor * 2.5 WHEN tipo_movimiento='salida' THEN -metros_cuadrados * espesor * 2.5 ELSE 0 END),0) as kg FROM movimientos`);
            const mesRes = await query(`SELECT COALESCE(SUM(cantidad_planchas),0) as planchas FROM movimientos WHERE EXTRACT(MONTH FROM fecha_hora)=EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM fecha_hora)=EXTRACT(YEAR FROM CURRENT_DATE) AND tipo_movimiento='salida'`);
            stockData.stockPlanchas = Number(stockRes.rows[0]?.stock) || 0;
            stockData.kgStock = Math.round(Number(kgRes.rows[0]?.kg) || 0);
            stockData.planchasMes = Number(mesRes.rows[0]?.planchas) || 0;
            stockData.autonomia = stockData.stockPlanchas > 0 && stockData.planchasMes > 0 ? (stockData.stockPlanchas / stockData.planchasMes).toFixed(1) : '0';

            // Sparkline: ultimos 6 meses
            const sparkRes = await query(`
                SELECT EXTRACT(MONTH FROM fecha_hora)::int as mes, EXTRACT(YEAR FROM fecha_hora)::int as anio,
                    COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento='salida'),0) as salidas,
                    COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN metros_cuadrados*1.25*espesor/1000*2.5 WHEN tipo_movimiento='salida' THEN -metros_cuadrados*1.25*espesor/1000*2.5 ELSE 0 END),0) as kg
                FROM movimientos
                WHERE fecha_hora >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
                GROUP BY EXTRACT(YEAR FROM fecha_hora), EXTRACT(MONTH FROM fecha_hora)
                ORDER BY anio, mes
            `);
            stockData.sparklinePlanchas = sparkRes.rows.map(r => Number(r.salidas));
            stockData.sparklineKg = sparkRes.rows.map(r => Math.round(Number(r.kg)));
        } catch(e) {}

        // Alertas de autonomía
        let alertas = [];
        try {
            const alertRes = await query(`
                SELECT mp.codigo_mp, mp.nombre, mp.espesor_mm, mp.consumo_promedio_mensual,
                    COALESCE(ROUND((COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5, 0), 0) as kg_stock,
                    CASE
                        WHEN mp.consumo_promedio_mensual > 0 AND (COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5 / (mp.consumo_promedio_mensual * mp.espesor_mm * 2.5) <= 1.5 THEN 'critico'
                        WHEN mp.consumo_promedio_mensual > 0 AND (COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5 / (mp.consumo_promedio_mensual * mp.espesor_mm * 2.5) <= 3 THEN 'bajo'
                        WHEN mp.consumo_promedio_mensual > 0 AND (COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5 / (mp.consumo_promedio_mensual * mp.espesor_mm * 2.5) <= 6 THEN 'medio'
                        ELSE 'ok'
                    END as nivel,
                    ROUND((COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5 / NULLIF(mp.consumo_promedio_mensual * mp.espesor_mm * 2.5, 0), 1) as autonomia_meses
                FROM materias_primas mp
                LEFT JOIN movimientos m ON m.materia_prima_id = mp.id
                WHERE mp.consumo_promedio_mensual > 0
                GROUP BY mp.id, mp.codigo_mp, mp.nombre, mp.espesor_mm, mp.consumo_promedio_mensual
                HAVING (COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='entrada'),0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento='salida' AND m.tipo_salida='plancha_completa'),0)) * mp.espesor_mm * 2.5 / NULLIF(mp.consumo_promedio_mensual * mp.espesor_mm * 2.5, 0) <= 6
                ORDER BY autonomia_meses ASC
            `);
            alertas = alertRes.rows.map(r => ({
                nombre: r.nombre,
                espesor: r.espesor_mm,
                nivel: r.nivel,
                autonomia: r.autonomia_meses
            }));
        } catch(e) {}

        res.json({
            anio,
            meses: mesesData,
            topMateriales: topMateriales.rows.map(r => ({ nombre: (r.tipo_cristal || 'Sin tipo') + ' ' + (r.espesor ? r.espesor + 'mm' : ''), total: r.salidas, m2: parseFloat(r.m2) || 0 })),
            topDimensiones: topDimensiones.rows,
            tipos: tiposFinales,
            totalEntradas,
            totalSalidas,
            totalM2Entradas: Math.round(totalM2Entradas),
            totalM2Salidas: Math.round(totalM2Salidas),
            stockPlanchas: stockData.stockPlanchas,
            kgStock: stockData.kgStock,
            autonomia: stockData.autonomia,
            planchasMes: stockData.planchasMes,
            alertas
        });
    } catch (e) {
        console.error('[INV REPORTE ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
