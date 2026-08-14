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
    // Primero intentar desde el header
    const raw = req.headers['x-user-permisos'] || '';
    if (raw) {
        return raw.split(',').map(p => p.trim()).filter(Boolean);
    }
    
    // Si no hay header, intentar desde la sesión
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
    // Primero intentar desde el header
    const raw = req.headers['x-user-email'] || '';
    if (raw) return raw;
    
    // Si no hay header, intentar desde la sesión
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const user = getSession(token);
    
    return user ? user.email : '';
}

function getUserFromReq(req) {
    // Primero intentar desde el header
    const email = req.headers['x-user-email'] || '';
    const permisos = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);
    
    if (email) {
        return { email, permisos };
    }
    
    // Si no hay header, intentar desde la sesión
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const user = getSession(token);
    
    return user || { email: '', permisos: [] };
}

/**
 * Verifica que el usuario tenga al menos uno de los permisos indicados.
 * Si no tiene ninguno, retorna 403.
 *
 * @param  {...string} permisosRequeridos - Lista de permisos aceptados (OR)
 * @returns {Function} middleware de Express
 */
function requireAnyPerm(...permisosRequeridos) {
    return (req, res, next) => {
        const user = getUserFromReq(req);
        const userPerms = user.permisos || [];

        // Admin total (tiene permiso 'usuarios' o rol 'admin')
        if (userPerms.includes('usuarios') || user.rol === 'admin') return next();

        const tieneAlguno = permisosRequeridos.some(p => userPerms.includes(p));
        if (!tieneAlguno) {
            return res.status(403).json({ error: 'Sin permisos para esta acción' });
        }
        next();
    };
}

/**
 * Verifica que el usuario tenga el permiso específico indicado.
 *
 * @param  {string} permisoRequerido - Permiso exacto requerido
 * @returns {Function} middleware de Express
 */
function requirePerm(permisoRequerido) {
    return (req, res, next) => {
        const user = getUserFromReq(req);
        const userPerms = user.permisos || [];

        // Admin total (tiene permiso 'usuarios' o rol 'admin')
        if (userPerms.includes('usuarios') || user.rol === 'admin') return next();

        if (!userPerms.includes(permisoRequerido)) {
            return res.status(403).json({ error: 'Sin permisos para esta acción' });
        }
        next();
    };
}

/**
 * Helper para crear middlewares CRUD completos para un módulo.
 *
 * @param {string} modulo - Nombre del módulo (ej: "prod_ordenes")
 * @returns {Object} { view, create, update, delete }
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
