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
const { query } = require('../config/database');

/**
 * Obtiene el usuario de la request (headers o sesión)
 * @param {Object} req - Request de Express
 * @returns {Object} Usuario con { email, permisos, rol }
 */
async function getUserFromReq(req) {
    // 1. Intentar desde headers (frontend)
    const headerEmail = req.headers['x-user-email'] || '';
    const headerPermisos = (req.headers['x-user-permisos'] || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

    if (headerEmail && headerPermisos.length > 0) {
        return { email: headerEmail, permisos: headerPermisos };
    }

    // 2. Intentar desde sesión (cookie)
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const sessionUser = getSession(token);

    if (sessionUser) {
        // Si hay usuario en sesión, obtener permisos de la BD
        try {
            const result = await query(
                "SELECT id, nombre, email, rol, permisos FROM usuarios WHERE email = $1 AND activo = TRUE",
                [sessionUser.email]
            );
            if (result.rows.length > 0) {
                const dbUser = result.rows[0];
                return {
                    email: dbUser.email,
                    permisos: Array.isArray(dbUser.permisos) ? dbUser.permisos : [],
                    rol: dbUser.rol
                };
            }
        } catch (e) {
            console.error('Error obteniendo usuario:', e.message);
        }
        return { email: sessionUser.email, permisos: [], rol: sessionUser.rol };
    }

    // 3. Sin usuario
    return { email: '', permisos: [], rol: null };
}

function getEmailFromReq(req) {
    return req.headers['x-user-email'] || '';
}

/**
 * Verifica que el usuario tenga al menos uno de los permisos indicados.
 * Si no tiene ninguno, retorna 403.
 *
 * @param  {...string} permisosRequeridos - Lista de permisos aceptados (OR)
 * @returns {Function} middleware de Express
 */
function requireAnyPerm(...permisosRequeridos) {
    return async (req, res, next) => {
        try {
            const user = await getUserFromReq(req);
            const userPerms = user.permisos || [];

            // Admin total (tiene permiso 'usuarios' o rol 'admin')
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
        } catch (e) {
            console.error('Error en requireAnyPerm:', e.message);
            return res.status(500).json({ error: 'Error interno' });
        }
    };
}

/**
 * Verifica que el usuario tenga el permiso específico indicado.
 *
 * @param  {string} permisoRequerido - Permiso exacto requerido
 * @returns {Function} middleware de Express
 */
function requirePerm(permisoRequerido) {
    return async (req, res, next) => {
        try {
            const user = await getUserFromReq(req);
            const userPerms = user.permisos || [];

            // Admin total (tiene permiso 'usuarios' o rol 'admin')
            if (user.rol === 'admin' || userPerms.includes('usuarios')) {
                req.user = user;
                return next();
            }

            if (!userPerms.includes(permisoRequerido)) {
                return res.status(403).json({ error: 'Sin permisos para esta acción' });
            }

            req.user = user;
            next();
        } catch (e) {
            console.error('Error en requirePerm:', e.message);
            return res.status(500).json({ error: 'Error interno' });
        }
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
    getUserFromReq,
    getEmailFromReq,
    requireAnyPerm,
    requirePerm,
    crudPerms,
};
