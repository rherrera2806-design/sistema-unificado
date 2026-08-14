const express = require('express');
const router = express.Router();
const r2Service = require('../services/r2Storage');
const { R2_ACCESS_KEY_ID } = require('../config/r2');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'pedidos';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

const requireR2 = (req, res, next) => {
    if (!R2_ACCESS_KEY_ID) return res.status(500).json({ error: 'R2 no configurado' });
    next();
};

router.post('/api/r2/presign-post', canCreate, requireR2, async (req, res, next) => {
    if (!req.body.fileName) return res.status(400).json({ error: 'fileName requerido' });
    try { res.json(r2Service.generatePresignPost(req.body.fileName)); }
    catch (e) { res.status(500).json({ error: 'Error al generar presign' }); }
});

router.post('/api/r2/presign-put', canCreate, requireR2, async (req, res, next) => {
    if (!req.body.fileName) return res.status(400).json({ error: 'fileName requerido' });
    try { res.json(r2Service.generatePresignPut(req.body.fileName)); }
    catch (e) { res.status(500).json({ error: 'Error al generar presign PUT' }); }
});

router.get('/api/r2/download', canView, (req, res, next) => {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'key es requerida' });
    res.json(r2Service.getPublicUrl(key));
});

router.delete('/api/r2/delete', canDelete, async (req, res, next) => {
    if (!req.body.key) return res.status(400).json({ error: 'key es requerida' });
    try { res.json(await r2Service.deleteFile(req.body.key)); }
    catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
