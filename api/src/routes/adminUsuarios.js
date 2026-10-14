const express = require('express');
const router = express.Router();
const adminService = require('../services/adminUsuarios');
const { requirePerm } = require('../middleware/permisos');

// Todas las rutas de admin requieren permiso 'usuarios' (o rol admin)
const requireAdmin = requirePerm('usuarios');

// La identidad del que ejecuta la acción viene SIEMPRE de la sesión (req.user
// lo inyecta el middleware): es el "actor" de la bitácora.
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

// Bitácora de administración (quién hizo qué y cuándo)
router.get('/api/admin/usuarios/auditoria', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.getAuditoria(req.query.limite)); }
    catch (e) { next(e); }
});

router.post('/api/admin/usuarios', requireAdmin, async (req, res, next) => {
    try { res.status(201).json(await adminService.create(req.body, req.user.email)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/admin/usuarios/:id', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.update(Number(req.params.id), req.body, req.user.email)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

// Activar / desactivar sin borrar (conserva historial y bitácora)
router.patch('/api/admin/usuarios/:id/activo', requireAdmin, async (req, res, next) => {
    try {
        const activo = req.body.activo === true || req.body.activo === 'true';
        res.json(await adminService.setActivo(Number(req.params.id), activo, req.user.email));
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/admin/usuarios/:id', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.remove(Number(req.params.id), req.user.email)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
