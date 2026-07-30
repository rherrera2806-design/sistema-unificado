const { query } = require('../config/database');
const { parseBody, json } = require('../middleware/parser');
const authService = require('../services/auth');

const handleAuth = async (req, res, urlPath) => {
    if (urlPath === '/api/auth/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const email = (body.email || '').replace(/[<>]/g, '').trim();
        const password = body.password;
        if (!email || !password) { json(res, { error: 'Email y contrasena requeridos' }, 400); return true; }
        const user = await authService.login(email, password);
        if (!user) { json(res, { error: 'Credenciales invalidas' }, 401); return true; }
        const { createSession, SESSION_TTL } = require('../middleware/security');
        const token = createSession(user);
        const isSecure = req.headers.host && !req.headers.host.includes('localhost');
        const cookieValue = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${isSecure ? '; Secure' : ''}`;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': cookieValue });
        res.end(JSON.stringify(user));
        return true;
    }

    if (urlPath === '/api/auth/verify-password' && req.method === 'POST') {
        const body = await parseBody(req);
        const { email, password } = body;
        if (!email || !password) { json(res, { ok: false }, 400); return true; }
        try {
            const result = await query("SELECT password FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
            if (result.rows.length === 0) { json(res, { ok: false }, 401); return true; }
            const { verifyPassword } = require('../config/database');
            const verification = verifyPassword(password, result.rows[0].password);
            if (!verification) { json(res, { ok: false }, 401); return true; }
            json(res, { ok: true });
        } catch (e) { json(res, { ok: false }, 500); }
        return true;
    }

    if (urlPath === '/api/auth/me' && req.method === 'GET') {
        const { getSession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        const user = getSession(token);
        if (!user) { json(res, { error: 'No autenticado' }, 401); return true; }
        json(res, user);
        return true;
    }

    if (urlPath === '/api/auth/logout' && req.method === 'POST') {
        const { destroySession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        destroySession(token);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
        res.end(JSON.stringify({ ok: true }));
        return true;
    }

    return false;
};

const handleHealth = async (req, res, urlPath) => {
    if (urlPath !== '/api/health') return false;
    json(res, { status: 'ok', version: '4.0.0', modules: ['sigma', 'inventario', 'turnos', 'pedidos', 'produccion', 'instalaciones'] });
    return true;
};

const handleUsuarios = async (req, res, urlPath) => {
    if (urlPath === '/api/usuarios' && req.method === 'GET') {
        json(res, await authService.getUsuarios());
        return true;
    }
    if (urlPath === '/api/usuarios' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await authService.crearUsuario(body), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath.match(/^\/api\/usuarios\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        try { json(res, await authService.updateUsuario(id, body)); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath.match(/^\/api\/usuarios\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        json(res, { ok: await authService.eliminarUsuario(id) });
        return true;
    }
    return false;
};

module.exports = { handleAuth, handleHealth, handleUsuarios };
