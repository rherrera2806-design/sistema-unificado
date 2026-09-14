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
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE tipo_movimiento = 'entrada')::int as entradas,
                COUNT(*) FILTER (WHERE tipo_movimiento = 'salida')::int as salidas,
                COALESCE(SUM(metros_cuadrados) FILTER (WHERE tipo_movimiento = 'entrada'), 0)::numeric as m2_entradas,
                COALESCE(SUM(metros_cuadrados) FILTER (WHERE tipo_movimiento = 'salida'), 0)::numeric as m2_salidas,
                COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento = 'entrada'), 0)::int as planchas_entradas,
                COALESCE(SUM(cantidad_planchas) FILTER (WHERE tipo_movimiento = 'salida'), 0)::int as planchas_salidas,
                COALESCE(NULLIF(tipo_cristal,''), 'Sin tipo') as tipo_cristal,
                espesor
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1
            GROUP BY EXTRACT(MONTH FROM fecha_hora), tipo_cristal, espesor
            ORDER BY mes
        `, [anio]);

        const topMateriales = await query(`
            SELECT tipo_cristal, COUNT(*)::int as salidas, COALESCE(SUM(metros_cuadrados), 0)::numeric as m2
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1 AND tipo_movimiento = 'salida'
            GROUP BY tipo_cristal ORDER BY salidas DESC LIMIT 8
        `, [anio]);

        const topDimensiones = await query(`
            SELECT ancho || 'x' || alto as dimension, COUNT(*)::int as salidas
            FROM movimientos
            WHERE EXTRACT(YEAR FROM fecha_hora) = $1 AND tipo_movimiento = 'salida'
            GROUP BY ancho, alto ORDER BY salidas DESC LIMIT 8
        `, [anio]);

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const porMes = {};
        const porTipo = {};

        for (const row of result.rows) {
            const idx = row.mes - 1;
            if (!porMes[idx]) porMes[idx] = { total:0, entradas:0, salidas:0, m2_entradas:0, m2_salidas:0, planchas_entradas:0, planchas_salidas:0 };
            porMes[idx].total += row.total;
            porMes[idx].entradas += row.entradas;
            porMes[idx].salidas += row.salidas;
            porMes[idx].m2_entradas += parseFloat(row.m2_entradas) || 0;
            porMes[idx].m2_salidas += parseFloat(row.m2_salidas) || 0;
            porMes[idx].planchas_entradas += row.planchas_entradas;
            porMes[idx].planchas_salidas += row.planchas_salidas;

            const tipo = ((row.tipo_cristal || '').trim() || 'Sin tipo') + ' ' + (row.espesor ? row.espesor + 'mm' : '');
            porTipo[tipo.trim()] = (porTipo[tipo.trim()] || 0) + row.salidas;
        }

        const mesesData = meses.map((nombre, i) => ({
            nombre,
            ...(porMes[i] || { total:0, entradas:0, salidas:0, m2_entradas:0, m2_salidas:0, planchas_entradas:0, planchas_salidas:0 })
        }));

        const totalEntradas = mesesData.reduce((s, m) => s + m.entradas, 0);
        const totalSalidas = mesesData.reduce((s, m) => s + m.salidas, 0);
        const totalM2Entradas = mesesData.reduce((s, m) => s + m.m2_entradas, 0);
        const totalM2Salidas = mesesData.reduce((s, m) => s + m.m2_salidas, 0);

        res.json({
            anio,
            meses: mesesData,
            topMateriales: topMateriales.rows.map(r => ({ nombre: r.tipo_cristal, total: r.salidas, m2: parseFloat(r.m2) || 0 })),
            topDimensiones: topDimensiones.rows,
            tipos: Object.entries(porTipo).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total),
            totalEntradas,
            totalSalidas,
            totalM2Entradas: Math.round(totalM2Entradas),
            totalM2Salidas: Math.round(totalM2Salidas)
        });
    } catch (e) {
        console.error('[INV REPORTE ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
