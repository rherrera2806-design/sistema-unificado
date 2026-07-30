const express = require('express');
const router = express.Router();
const { sanitizeObject } = require('../utils/helpers');
const catalogosService = require('../services/catalogos');
const inventarioService = require('../services/inventario');

router.get('/api/catalogos/tipos-cristal', async (req, res, next) => {
    try { res.json(await catalogosService.getTiposCristal()); }
    catch (e) { next(e); }
});

router.post('/api/catalogos/tipos-cristal', async (req, res, next) => {
    try { res.status(201).json(await catalogosService.crearTipoCristal(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/catalogos/tipos-cristal/:id', async (req, res, next) => {
    const item = await catalogosService.updateTipoCristal(Number(req.params.id), req.body);
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json(item);
});

router.delete('/api/catalogos/tipos-cristal/:id', async (req, res, next) => {
    const item = await catalogosService.eliminarTipoCristal(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, item });
});

router.get('/api/catalogos/espesores', async (req, res, next) => {
    try { res.json(await catalogosService.getEspesores()); }
    catch (e) { next(e); }
});

router.post('/api/catalogos/espesores', async (req, res, next) => {
    try { res.status(201).json(await catalogosService.crearEspesor(req.body.valor)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/catalogos/espesores/:id', async (req, res, next) => {
    const item = await catalogosService.eliminarEspesor(Number(req.params.id));
    if (!item) return res.status(404).json({ error: 'No encontrado' });
    res.json({ ok: true, item });
});

router.get('/api/inv/movimientos', async (req, res, next) => {
    try { res.json(await inventarioService.getMovimientos(req.query)); }
    catch (e) { next(e); }
});

router.post('/api/inv/movimientos', async (req, res, next) => {
    try { res.status(201).json(await inventarioService.crearMovimiento(sanitizeObject(req.body))); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/inv/movimientos/:id', async (req, res, next) => {
    await inventarioService.eliminarMovimiento(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/inv/inventario', async (req, res, next) => {
    try { res.json(await inventarioService.getInventario(req.query)); }
    catch (e) { next(e); }
});

router.get('/api/inv/estadisticas', async (req, res, next) => {
    try { res.json(await inventarioService.getEstadisticas()); }
    catch (e) { next(e); }
});

router.get('/api/inv/estadisticas-por-tipo', async (req, res, next) => {
    try { res.json(await inventarioService.getEstadisticasPorTipo()); }
    catch (e) { next(e); }
});

router.get('/api/inv/autonomia', async (req, res, next) => {
    try { res.json(await catalogosService.getAutonomia()); }
    catch (e) { next(e); }
});

router.get('/api/inv/alertas', async (req, res, next) => {
    try { res.json(await catalogosService.getAlertas()); }
    catch (e) { next(e); }
});

module.exports = router;
