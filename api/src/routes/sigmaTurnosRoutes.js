const express = require('express');
const router = express.Router();
const sigmaService = require('../services/sigma');
const turnosService = require('../services/turnos');
const { requireAnyPerm, requirePerm } = require('../middleware/permisos');

const MOD = 'dashboard';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);
const requireAdmin = requirePerm('usuarios');

router.get('/api/sigma/stats', canView, async (req, res, next) => {
    try { res.json(await sigmaService.getSigmaStats()); }
    catch (e) { next(e); }
});

router.get('/api/sigma/:collection', canView, async (req, res, next) => {
    try { res.json(await sigmaService.getAll(req.params.collection)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/api/sigma/:collection/:id', canView, async (req, res, next) => {
    try {
        const item = await sigmaService.getById(req.params.collection, Number(req.params.id));
        if (!item) return res.status(404).json({ error: 'No encontrado' });
        res.json(item);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/api/sigma/:collection', canCreate, async (req, res, next) => {
    try { res.status(201).json(await sigmaService.insert(req.params.collection, req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/sigma/:collection/:id', canUpdate, async (req, res, next) => {
    try { res.json(await sigmaService.update(req.params.collection, Number(req.params.id), req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/sigma/:collection/:id', canDelete, async (req, res, next) => {
    try {
        const ok = await sigmaService.del(req.params.collection, Number(req.params.id));
        if (!ok) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/api/sigma/export', canView, async (req, res, next) => {
    try { res.json(await sigmaService.exportJSON()); }
    catch (e) { next(e); }
});

router.post('/api/sigma/import', requireAdmin, async (req, res, next) => {
    await sigmaService.importJSON(req.body);
    res.json({ ok: true });
});

router.post('/api/sigma/clear', requireAdmin, async (req, res, next) => {
    await sigmaService.clearAllSigma();
    res.json({ ok: true });
});

router.get('/api/turnos/stats', canView, async (req, res, next) => {
    try { res.json(await turnosService.getTurnosStats()); }
    catch (e) { next(e); }
});

router.get('/api/turnos/actual', canView, async (req, res, next) => {
    try { res.json(await turnosService.getTurnoActual()); }
    catch (e) { next(e); }
});

router.get('/api/turnos/cola', canView, async (req, res, next) => {
    try { res.json(await turnosService.getCola()); }
    catch (e) { next(e); }
});

router.post('/api/turnos', canCreate, async (req, res, next) => {
    try { res.status(201).json(await turnosService.crearTurno(req.body)); }
    catch (e) { next(e); }
});

router.post('/api/turnos/:id/llamar', canUpdate, async (req, res, next) => {
    await turnosService.llamarTurno(Number(req.params.id));
    res.json({ ok: true });
});

router.post('/api/turnos/:id/finalizar', canUpdate, async (req, res, next) => {
    await turnosService.finalizarTurno(Number(req.params.id));
    res.json({ ok: true });
});

router.delete('/api/turnos/:id', canDelete, async (req, res, next) => {
    await turnosService.eliminarTurno(Number(req.params.id));
    res.json({ ok: true });
});

module.exports = router;
