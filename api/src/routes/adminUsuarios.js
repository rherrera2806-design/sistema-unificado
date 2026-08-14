const express = require('express');
const router = express.Router();
const adminService = require('../services/adminUsuarios');
const { parseBody } = require('../middleware/parser');
const { requirePerm } = require('../middleware/permisos');

// Todas las rutas de admin requieren permiso 'usuarios'
const requireAdmin = requirePerm('usuarios');

router.get('/api/admin/usuarios', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.getAll()); }
    catch (e) { next(e); }
});

router.get('/api/admin/usuarios/export', requireAdmin, async (req, res, next) => {
    try {
        const txt = await adminService.exportTxt();
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="usuarios_vitroflow.txt"');
        res.send(txt);
    } catch (e) { next(e); }
});

router.post('/api/admin/usuarios', requireAdmin, async (req, res, next) => {
    try { res.status(201).json(await adminService.create(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/admin/usuarios/:id', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.update(Number(req.params.id), req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/admin/usuarios/:id', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.remove(Number(req.params.id))); }
    catch (e) { next(e); }
});

module.exports = router;
