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

router.get('/api/inv/run-migration', canViewInv, async (req, res) => {
    try {
        const { query } = require('../config/database');
        await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS turno VARCHAR(10) DEFAULT NULL");
        res.json({ ok: true, message: 'Columna turno agregada' });
    } catch (e) {
        res.json({ ok: true, message: 'Columna ya existe o error: ' + e.message });
    }
});

module.exports = router;
