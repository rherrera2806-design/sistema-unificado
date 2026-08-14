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
    const permisos = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);

    if (email) {
        return { email, permisos };
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
    crudPerms,
};
