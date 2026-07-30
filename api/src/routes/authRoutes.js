const express = require('express');
const router = express.Router();
const { parseBody } = require('../middleware/parser');
const authService = require('../services/auth');

router.post('/api/auth/login', async (req, res, next) => {
    try {
        const email = (req.body.email || '').replace(/[<>]/g, '').trim();
        const password = req.body.password;
        if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });
        const user = await authService.login(email, password);
        if (!user) return res.status(401).json({ error: 'Credenciales invalidas' });
        const { createSession, SESSION_TTL } = require('../middleware/security');
        const token = createSession(user);
        const isSecure = req.headers.host && !req.headers.host.includes('localhost');
        const cookieValue = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${isSecure ? '; Secure' : ''}`;
        res.setHeader('Set-Cookie', cookieValue);
        res.json(user);
    } catch (e) { next(e); }
});

router.post('/api/auth/verify-password', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ ok: false });
        const { query } = require('../config/database');
        const result = await query("SELECT password FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
        if (result.rows.length === 0) return res.status(401).json({ ok: false });
        const { verifyPassword } = require('../config/database');
        const verification = verifyPassword(password, result.rows[0].password);
        if (!verification) return res.status(401).json({ ok: false });
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/api/auth/me', async (req, res, next) => {
    try {
        const { getSession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        const user = getSession(token);
        if (!user) return res.status(401).json({ error: 'No autenticado' });
        res.json(user);
    } catch (e) { next(e); }
});

router.post('/api/auth/logout', (req, res, next) => {
    try {
        const { destroySession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        destroySession(token);
        res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.get('/api/usuarios', async (req, res, next) => {
    try { res.json(await authService.getUsuarios()); }
    catch (e) { next(e); }
});

router.post('/api/usuarios', async (req, res, next) => {
    try { res.status(201).json(await authService.crearUsuario(req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/usuarios/:id', async (req, res, next) => {
    try { res.json(await authService.updateUsuario(Number(req.params.id), req.body)); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/usuarios/:id', async (req, res, next) => {
    try { res.json({ ok: await authService.eliminarUsuario(Number(req.params.id)) }); }
    catch (e) { next(e); }
});

module.exports = router;
