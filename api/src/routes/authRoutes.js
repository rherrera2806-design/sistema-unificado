const express = require('express');
const router = express.Router();
const { requireAdmin, requireAuth } = require('../middleware/permisos');
const authService = require('../services/auth');
const adminService = require('../services/adminUsuarios');

router.post('/api/auth/login', async (req, res, next) => {
    try {
        const email = (req.body.email || '').replace(/[<>]/g, '').trim();
        const password = req.body.password;
        if (!email || !password) return res.status(400).json({ error: 'Email y contrasena requeridos' });

        // Bloqueo por fuerza bruta: 5 fallas en 10 min (por email o por IP).
        const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../middleware/security');
        const ip = req.ip || req.connection.remoteAddress || 'desconocida';
        if (!checkLoginAllowed(email.toLowerCase()) || !checkLoginAllowed(ip)) {
            return res.status(429).json({ error: 'Demasiados intentos fallidos. Intenta nuevamente en 10 minutos.' });
        }

        const user = await authService.login(email, password);
        if (!user) {
            recordLoginFailure(email.toLowerCase());
            recordLoginFailure(ip);
            return res.status(401).json({ error: 'Credenciales invalidas' });
        }
        clearLoginFailures(email.toLowerCase());
        clearLoginFailures(ip);

        const { createSession, SESSION_TTL } = require('../middleware/security');
        const token = createSession(user);
        const isSecure = req.headers.host && !req.headers.host.includes('localhost');
        const cookieValue = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${isSecure ? '; Secure' : ''}`;
        res.setHeader('Set-Cookie', cookieValue);
        // 'token' viaja también en el body para la app móvil (Capacitor), que no
        // puede leer la cookie HttpOnly ni enviarla cross-origin (SameSite=Lax).
        res.json({ ...user, token });
    } catch (e) { next(e); }
});

// Verificación de contraseña para confirmar acciones sensibles (borrar
// registros, etc.). Solo valida la contraseña del USUARIO DE LA SESIÓN:
// el email del body se ignora, así este endpoint no sirve para probar
// contraseñas de otras cuentas.
router.post('/api/auth/verify-password', requireAuth, async (req, res, next) => {
    try {
        const password = req.body.password;
        if (!password) return res.status(400).json({ ok: false });
        const { query, verifyPassword } = require('../config/database');
        const { checkLoginAllowed, recordLoginFailure, clearLoginFailures } = require('../middleware/security');
        const clave = 'verify:' + (req.user.email || '').toLowerCase();
        if (!checkLoginAllowed(clave)) {
            return res.status(429).json({ ok: false, error: 'Demasiados intentos. Intenta nuevamente en 10 minutos.' });
        }
        const result = await query("SELECT password FROM usuarios WHERE email = $1 AND activo = TRUE", [req.user.email]);
        if (result.rows.length === 0) return res.status(401).json({ ok: false });
        const verification = verifyPassword(password, result.rows[0].password);
        if (!verification) {
            recordLoginFailure(clave);
            return res.status(401).json({ ok: false });
        }
        clearLoginFailures(clave);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ ok: false }); }
});

router.get('/api/auth/me', async (req, res, next) => {
    try {
        const { getSession, getTokenFromReq } = require('../middleware/security');
        const sessionUser = getSession(getTokenFromReq(req));
        if (!sessionUser) return res.status(401).json({ error: 'No autenticado' });
        
        // Obtener permisos actualizados de la BD
        const { query } = require('../config/database');
        const result = await query(
            "SELECT id, nombre, email, rol, permisos, area FROM usuarios WHERE email = $1 AND activo = TRUE",
            [sessionUser.email]
        );
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }
        
        const dbUser = result.rows[0];
        res.json({
            id: dbUser.id,
            nombre: dbUser.nombre,
            email: dbUser.email,
            rol: dbUser.rol,
            area: dbUser.area || '',
            permisos: Array.isArray(dbUser.permisos) ? dbUser.permisos : []
        });
    } catch (e) { next(e); }
});

router.post('/api/auth/logout', (req, res, next) => {
    try {
        const { destroySession, getTokenFromReq } = require('../middleware/security');
        destroySession(getTokenFromReq(req));
        res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Listado de usuarios: solo administradores. La administración completa
// (crear/editar/eliminar/bitácora) vive en routes/adminUsuarios.js; aquí solo
// queda el listado por compatibilidad, delegando al MISMO servicio.
router.get('/api/usuarios', requireAdmin, async (req, res, next) => {
    try { res.json(await adminService.getAll()); }
    catch (e) { next(e); }
});

module.exports = router;
