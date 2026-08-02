const express = require('express');
const router = express.Router();
const instalaciones = require('../services/instalaciones');

const getUserEmail = (req) => req.headers['x-user-email'] || 'Sistema';

router.get('/api/instalaciones/calendario', async (req, res, next) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas requeridas' });
    try { res.json(await instalaciones.getCalendario(req.query.inicio, req.query.fin)); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones/tecnicos', async (req, res, next) => {
    try { res.json(await instalaciones.getTecnicos()); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones/vendedores', async (req, res, next) => {
    try { res.json(await instalaciones.getVendedores()); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones', async (req, res, next) => {
    try { res.json(await instalaciones.getInstalaciones()); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones/dashboard', async (req, res, next) => {
    try {
        res.json(await instalaciones.getDashboard());
    } catch (e) { next(e); }
});

router.post('/api/instalaciones', async (req, res, next) => {
    const { cliente, direccion, fecha_programada } = req.body;
    if (!cliente || !direccion || !fecha_programada) return res.status(400).json({ error: 'Cliente, dirección y fecha requeridos' });
    try { res.status(201).json(await instalaciones.crearInstalacion(req.body, getUserEmail(req))); }
    catch (e) { next(e); }
});

router.put('/api/instalaciones/:id/estado', async (req, res, next) => {
    try {
        await instalaciones.cambiarEstado(Number(req.params.id), req.body.estado, req.body.detalle, getUserEmail(req));
        res.json({ ok: true });
    } catch (e) { res.status(e.message === 'Estado inválido' ? 400 : 500).json({ error: e.message }); }
});

router.put('/api/instalaciones/:id/cerrar', async (req, res, next) => {
    try {
        await instalaciones.cerrarInstalacion(Number(req.params.id), req.body.notas_cierre, req.body.firma_cliente, getUserEmail(req));
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.post('/api/instalaciones/:id/fotos', async (req, res, next) => {
    if (!req.body.fotos || !Array.isArray(req.body.fotos)) return res.status(400).json({ error: 'fotos array requerido' });
    try {
        await instalaciones.subirFotos(Number(req.params.id), req.body.fotos, getUserEmail(req));
        res.json({ ok: true, count: req.body.fotos.length });
    } catch (e) { next(e); }
});

router.get('/api/instalaciones/:id/fotos', async (req, res, next) => {
    try { res.json(await instalaciones.getFotos(Number(req.params.id))); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones/:instId/foto/:fotoId', async (req, res, next) => {
    try {
        const foto = await instalaciones.getFoto(Number(req.params.fotoId));
        if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });
        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.end(foto);
    } catch (e) { next(e); }
});

router.delete('/api/instalaciones/:instId/foto/:fotoId', async (req, res, next) => {
    try {
        await instalaciones.eliminarFoto(Number(req.params.instId), Number(req.params.fotoId), getUserEmail(req));
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.get('/api/instalaciones/:id/historial', async (req, res, next) => {
    try { res.json(await instalaciones.getHistorial(Number(req.params.id))); }
    catch (e) { next(e); }
});

router.get('/api/instalaciones/:id', async (req, res, next) => {
    try {
        const inst = await instalaciones.getInstalacion(Number(req.params.id));
        if (!inst) return res.status(404).json({ error: 'No encontrada' });
        res.json(inst);
    } catch (e) { next(e); }
});

router.put('/api/instalaciones/:id', async (req, res, next) => {
    try {
        await instalaciones.editarInstalacion(Number(req.params.id), req.body, getUserEmail(req));
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.delete('/api/instalaciones/:id', async (req, res, next) => {
    try {
        await instalaciones.eliminarInstalacion(Number(req.params.id));
        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;
