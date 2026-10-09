/**
 * Middleware centralizado de permisos para VitroFlow
 *
 * La identidad se resuelve EXCLUSIVAMENTE desde la sesión creada por
 * POST /api/auth/login (cookie HttpOnly 'session=').
 * Los headers 'X-User-Permisos' / 'X-User-Email' los envía el cliente y pueden
 * falsificarse, por lo que se IGNORAN: no otorgan identidad ni permisos.
 *
 * En cambio los permisos, el rol y el estado 'activo' se leen SIEMPRE de la BD
 * (ver resolveUser). Si se congelaran al hacer login, un cambio hecho por un
 * admin no aplicaria hasta que el usuario cerrara sesion, mientras la UI (que
 * los lee de /api/auth/me) ya mostraria los botones nuevos: el usuario tocaba
 * "Subir Pedido" y el API respondia 403 "Sin permisos para esta accion".
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
 * Normaliza un usuario al shape { id, nombre, email, rol, area, permisos, activo }.
 */
function normalizeUser(user) {
    return {
        id: user.id || null,
        nombre: user.nombre || '',
        email: user.email || '',
        rol: user.rol || 'usuario',
        area: user.area || '',
        permisos: Array.isArray(user.permisos) ? user.permisos : [],
        activo: user.activo !== false,
    };
}

/**
 * Usuario vigente: identidad desde la sesión + permisos/rol/activo desde la BD.
 * Se resuelve UNA sola vez por request y se memoiza en req._userVigente, porque
 * algunos routers encadenan varios middlewares de permisos sobre la misma ruta.
 *
 * Retorna null si no hay sesión válida, o si el usuario fue eliminado o está
 * inactivo (eso aplica de inmediato, sin esperar a que expire la sesión).
 * Si la consulta a la BD falla, se conserva el snapshot de la sesión para no
 * cortar el acceso por un problema transitorio de base de datos.
 */
async function resolveUser(req) {
    const sessionUser = getUserFromSession(req);
    if (!sessionUser) return null;
    if (req._userVigente !== undefined) return req._userVigente;

    let user = normalizeUser(sessionUser);

    if (sessionUser.id) {
        try {
            // require perezoso: evita un ciclo con config/database al cargar el módulo
            const { query } = require('../config/database');
            const result = await query(
                'SELECT id, nombre, email, rol, area, permisos, activo FROM usuarios WHERE id = $1',
                [sessionUser.id]
            );
            const row = result.rows[0];
            if (!row || row.activo === false) {
                req._userVigente = null;
                return null;
            }
            user = {
                id: row.id,
                nombre: row.nombre || '',
                email: row.email || '',
                rol: row.rol || 'usuario',
                area: row.area || '',
                permisos: Array.isArray(row.permisos) ? row.permisos : [],
                activo: true,
            };
        } catch (e) {
            // BD no disponible: no se revoca el acceso, se usa el snapshot de la sesión.
        }
    }

    req._userVigente = user;
    return user;
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
 *
 * OJO: este helper es síncrono y devuelve el snapshot congelado al hacer login.
 * Los middlewares usan resolveUser() (permisos frescos desde la BD). No lo uses
 * para decidir accesos.
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
    return async (req, res, next) => {
        try {
            const user = await resolveUser(req);
            if (!user) return res.status(401).json({ error: 'No autenticado' });
            req.user = user;

            // Admin total: rol 'admin' o permiso 'usuarios' (de la BD)
            if (isAdmin(user)) return next();

            const userPerms = user.permisos || [];
            const tieneAlguno = permisosRequeridos.some(p => userPerms.includes(p));
            if (!tieneAlguno) {
                return res.status(403).json({ error: 'Sin permisos para esta acción' });
            }
            return next();
        } catch (e) {
            return next(e);
        }
    };
}

/**
 * Verifica que el usuario tenga el permiso específico indicado.
 */
function requirePerm(permisoRequerido) {
    return async (req, res, next) => {
        try {
            const user = await resolveUser(req);
            if (!user) return res.status(401).json({ error: 'No autenticado' });
            req.user = user;

            // Admin total
            if (isAdmin(user)) return next();

            if (!(user.permisos || []).includes(permisoRequerido)) {
                return res.status(403).json({ error: 'Sin permisos para esta acción' });
            }
            return next();
        } catch (e) {
            return next(e);
        }
    };
}

/**
 * Verifica que el usuario esté autenticado (sesión válida en la cookie).
 * NO verifica permisos específicos - solo que haya sesión válida.
 * Útil para recursos como PDFs que se abren en iframe/window.open.
 */
async function requireAuth(req, res, next) {
    try {
        // Solo la sesión otorga identidad (los headers X-User-* se ignoran)
        const user = await resolveUser(req);
        if (!user) return res.status(401).json({ error: 'No autenticado' });
        req.user = user;
        return next();
    } catch (e) {
        return next(e);
    }
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
async function requireAdmin(req, res, next) {
    try {
        const user = await resolveUser(req);
        if (!user) return res.status(401).json({ error: 'No autenticado' });
        req.user = user;
        if (isAdmin(user)) return next();
        return res.status(403).json({ error: 'Solo administradores' });
    } catch (e) {
        return next(e);
    }
}

module.exports = {
    getPermisosFromReq,
    getEmailFromReq,
    getUserFromReq,
    resolveUser,
    requireAnyPerm,
    requirePerm,
    requireAuth,
    requireAdmin,
    crudPerms,
};
