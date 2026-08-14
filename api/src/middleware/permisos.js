/**
 * Middleware centralizado de permisos para VitroFlow
 *
 * Los permisos se envían desde el frontend en el header 'X-User-Permisos'
 * como string separado por comas (ej: "asistencia,asistencia.editar,pedidos")
 *
 * Convención de permisos:
 *   - modulo            → acceso base (ver módulo)
 *   - modulo.agregar    → crear registros (POST)
 *   - modulo.editar     → editar registros (PUT/PATCH)
 *   - modulo.eliminar   → eliminar registros (DELETE)
 */

const { getSession } = require('./security');

function getPermisosFromReq(req) {
    // 1. Intentar desde el header X-User-Permisos
    const raw = req.headers['x-user-permisos'] || '';
    if (raw) {
        return raw.split(',').map(p => p.trim()).filter(Boolean);
    }

    // 2. Intentar desde la sesión (cookie)
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const user = getSession(token);

    if (user && Array.isArray(user.permisos)) {
        return user.permisos;
    }

    return [];
}

function getEmailFromReq(req) {
    // 1. Intentar desde el header
    const raw = req.headers['x-user-email'] || '';
    if (raw) return raw;

    // 2. Intentar desde la sesión
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const user = getSession(token);

    return user ? user.email : '';
}

function getUserFromReq(req) {
    // 1. Intentar desde headers
    const email = req.headers['x-user-email'] || '';
    const raw = req.headers['x-user-permisos'] || '';
    const permisos = raw.split(',').map(p => p.trim()).filter(Boolean);

    if (email) {
        // Si tiene permiso 'usuarios' o el email es admin conocido, tratar como admin
        const isAdmin = permisos.includes('usuarios');
        return { email, permisos, rol: isAdmin ? 'admin' : 'usuario' };
    }

    // 2. Intentar desde sesión
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const user = getSession(token);

    if (user) {
        return {
            email: user.email || '',
            permisos: Array.isArray(user.permisos) ? user.permisos : [],
            rol: user.rol || 'usuario'
        };
    }

    return { email: '', permisos: [], rol: null };
}

/**
 * Verifica que el usuario tenga al menos uno de los permisos indicados.
 * Si no tiene ninguno, retorna 403.
 */
function requireAnyPerm(...permisosRequeridos) {
    return (req, res, next) => {
        const user = getUserFromReq(req);
        const userPerms = user.permisos || [];

        // Admin total: tiene permiso 'usuarios' o rol 'admin'
        if (user.rol === 'admin' || userPerms.includes('usuarios')) {
            req.user = user;
            return next();
        }

        const tieneAlguno = permisosRequeridos.some(p => userPerms.includes(p));
        if (!tieneAlguno) {
            return res.status(403).json({ error: 'Sin permisos para esta acción' });
        }

        req.user = user;
        next();
    };
}

/**
 * Verifica que el usuario tenga el permiso específico indicado.
 */
function requirePerm(permisoRequerido) {
    return (req, res, next) => {
        const user = getUserFromReq(req);
        const userPerms = user.permisos || [];

        // Admin total
        if (user.rol === 'admin' || userPerms.includes('usuarios')) {
            req.user = user;
            return next();
        }

        if (!userPerms.includes(permisoRequerido)) {
            return res.status(403).json({ error: 'Sin permisos para esta acción' });
        }

        req.user = user;
        next();
    };
}

/**
 * Helper para crear middlewares CRUD completos para un módulo.
 */
/**
 * Verifica que el usuario esté autenticado (sesión o headers).
 * NO verifica permisos específicos - solo que haya sesión válida.
 * Útil para recursos como PDFs que se abren en iframe/window.open.
 */
function requireAuth(req, res, next) {
    // 1. Verificar sesión directamente (cookie)
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const sessionUser = getSession(token);

    if (sessionUser) {
        req.user = {
            email: sessionUser.email || '',
            permisos: Array.isArray(sessionUser.permisos) ? sessionUser.permisos : [],
            rol: sessionUser.rol || 'usuario'
        };
        return next();
    }

    // 2. Verificar headers como fallback
    const email = req.headers['x-user-email'] || '';
    if (email) {
        const permisos = (req.headers['x-user-permisos'] || '').split(',').map(p => p.trim()).filter(Boolean);
        req.user = { email, permisos, rol: permisos.includes('usuarios') ? 'admin' : 'usuario' };
        return next();
    }

    return res.status(401).json({ error: 'No autenticado' });
}

function crudPerms(modulo) {
    return {
        view:   requireAnyPerm(modulo, `${modulo}.editar`, `${modulo}.eliminar`, `${modulo}.agregar`),
        create: requireAnyPerm(`${modulo}.agregar`, `${modulo}`),
        update: requireAnyPerm(`${modulo}.editar`, `${modulo}`),
        delete: requireAnyPerm(`${modulo}.eliminar`, `${modulo}`),
    };
}

module.exports = {
    getPermisosFromReq,
    getEmailFromReq,
    getUserFromReq,
    requireAnyPerm,
    requirePerm,
    requireAuth,
    crudPerms,
};
