/**
 * Middleware centralizado de permisos para VitroFlow
 *
 * La identidad y los permisos se resuelven EXCLUSIVAMENTE desde la sesión
 * creada por POST /api/auth/login (cookie HttpOnly 'session=').
 * Los headers 'X-User-Permisos' / 'X-User-Email' los envía el cliente y pueden
 * falsificarse, por lo que se IGNORAN: no otorgan identidad ni permisos.
 *
 * Convención de permisos (ver web/public/js/modules/usuarios.js):
 *   - modulo            → acceso base / lectura (ver módulo)
 *   - modulo.agregar    → crear registros (POST)
 *   - modulo.editar     → editar registros (PUT/PATCH)
 *   - modulo.eliminar   → eliminar registros (DELETE)
 */

const { getSession } = require('./security');

/**
 * Resuelve el usuario de la sesión a partir de la cookie 'session='.
 * Retorna null si no hay cookie o el token no corresponde a una sesión válida.
 */
function getUserFromSession(req) {
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    return getSession(token);
}

/**
 * Permisos del usuario, solo desde la sesión.
 * Sin sesión válida → lista vacía (usuario anónimo).
 */
function getPermisosFromReq(req) {
    const user = getUserFromSession(req);
    if (user && Array.isArray(user.permisos)) {
        return user.permisos;
    }
    return [];
}

/**
 * Email del usuario, solo desde la sesión.
 * Sin sesión válida → '' (usuario anónimo).
 */
function getEmailFromReq(req) {
    const user = getUserFromSession(req);
    return user ? (user.email || '') : '';
}

/**
 * Usuario normalizado { id, email, permisos, rol } desde la sesión.
 * El id proviene de la sesión creada por login() (api/src/services/auth.js),
 * nunca del body ni de headers: sirve para persistir la identidad real.
 * Sin sesión válida → usuario anónimo sin permisos.
 */
function getUserFromReq(req) {
    const user = getUserFromSession(req);
    if (!user) {
        return { id: null, email: '', permisos: [], rol: null };
    }
    return {
        id: user.id || null,
        email: user.email || '',
        permisos: Array.isArray(user.permisos) ? user.permisos : [],
        rol: user.rol || 'usuario'
    };
}

/**
 * Solo el rol 'admin' de la sesión (o el permiso 'usuarios' otorgado en la BD)
 * otorga permisos de administrador. Los headers nunca definen el rol.
 */
function isAdmin(user) {
    return user.rol === 'admin' || (user.permisos || []).includes('usuarios');
}

/**
 * Verifica que el usuario tenga al menos uno de los permisos indicados.
 * Si no tiene ninguno, retorna 403.
 */
function requireAnyPerm(...permisosRequeridos) {
    return (req, res, next) => {
        const user = getUserFromReq(req);
        const userPerms = user.permisos || [];

        // Admin total: rol 'admin' o permiso 'usuarios' (de la BD)
        if (isAdmin(user)) {
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
        if (isAdmin(user)) {
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
 * Verifica que el usuario esté autenticado (sesión válida en la cookie).
 * NO verifica permisos específicos - solo que haya sesión válida.
 * Útil para recursos como PDFs que se abren en iframe/window.open.
 */
function requireAuth(req, res, next) {
    // Solo la sesión otorga identidad (los headers X-User-* se ignoran)
    const sessionUser = getUserFromSession(req);
    if (!sessionUser) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    req.user = {
        id: sessionUser.id || null,
        email: sessionUser.email || '',
        permisos: Array.isArray(sessionUser.permisos) ? sessionUser.permisos : [],
        rol: sessionUser.rol || 'usuario'
    };
    return next();
}

/**
 * Helper para crear middlewares CRUD completos para un módulo.
 * Lectura y escritura separadas: 'ver' (permiso base) solo habilita lectura;
 * crear/editar/eliminar exigen su permiso específico. El admin pasa siempre.
 */
function crudPerms(modulo) {
    return {
        view:   requireAnyPerm(modulo),
        create: requireAnyPerm(`${modulo}.agregar`),
        update: requireAnyPerm(`${modulo}.editar`),
        delete: requireAnyPerm(`${modulo}.eliminar`),
    };
}

/**
 * Middleware que verifica que el usuario sea administrador.
 * Reemplaza las funciones checkAdmin() duplicadas en los routes.
 */
function requireAdmin(req, res, next) {
    const user = getUserFromReq(req);
    if (isAdmin(user)) {
        req.user = user;
        return next();
    }
    return res.status(403).json({ error: 'Solo administradores' });
}

module.exports = {
    getPermisosFromReq,
    getEmailFromReq,
    getUserFromReq,
    requireAnyPerm,
    requirePerm,
    requireAuth,
    requireAdmin,
    crudPerms,
};
