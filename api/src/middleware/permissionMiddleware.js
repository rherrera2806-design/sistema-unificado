/**
 * PermissionMiddleware - Infrastructure Layer
 * 
 * Middleware de Express para verificación de permisos en rutas.
 * Usa PermissionChecker para la lógica de dominio.
 * 
 * Principios:
 * - Separation of Concerns: Solo maneja HTTP, delega lógica a dominio
 * - Early Return: Para mejor legibilidad
 * - Reutilización: Funciones helper para crear middlewares
 */

const PermissionChecker = require('../domain/PermissionChecker');
const { getSession } = require('./security');

/**
 * Extrae el usuario de la request (headers o sesión)
 * @param {Object} req - Request de Express
 * @returns {Object} Usuario con { rol, permisos, email }
 */
function extractUser(req) {
    // 1. Intentar desde headers (frontend envía esto)
    const headerEmail = req.headers['x-user-email'] || '';
    const headerPermisos = (req.headers['x-user-permisos'] || '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean);

    if (headerEmail) {
        return {
            email: headerEmail,
            permisos: headerPermisos,
            rol: headerPermisos.includes('usuarios') ? 'admin' : 'usuario'
        };
    }

    // 2. Intentar desde sesión (cookie)
    const cookieHeader = req.headers.cookie || '';
    const sessionCookie = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('session='));
    const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
    const sessionUser = getSession(token);

    if (sessionUser) {
        return {
            email: sessionUser.email || '',
            permisos: Array.isArray(sessionUser.permisos) ? sessionUser.permisos : [],
            rol: sessionUser.rol || 'usuario'
        };
    }

    // 3. Sin usuario
    return { email: '', permisos: [], rol: null };
}

/**
 * Middleware: requiere que el usuario esté autenticado
 */
function requireAuth(req, res, next) {
    const user = extractUser(req);
    
    if (!user.email) {
        return res.status(401).json({ error: 'No autenticado' });
    }

    req.user = user;
    req.permissionChecker = new PermissionChecker(user);
    next();
}

/**
 * Middleware: requiere permiso para VER un módulo
 * @param {string} modulo - Nombre del módulo
 */
function requireView(modulo) {
    return (req, res, next) => {
        const user = extractUser(req);
        
        if (!user.email) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const checker = new PermissionChecker(user);
        
        if (!checker.canView(modulo)) {
            return res.status(403).json({ error: 'Sin permisos para ver este módulo' });
        }

        req.user = user;
        req.permissionChecker = checker;
        next();
    };
}

/**
 * Middleware: requiere permiso para CREAR en un módulo
 * @param {string} modulo - Nombre del módulo
 */
function requireCreate(modulo) {
    return (req, res, next) => {
        const user = extractUser(req);
        
        if (!user.email) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const checker = new PermissionChecker(user);
        
        if (!checker.canCreate(modulo)) {
            return res.status(403).json({ error: 'Sin permisos para crear en este módulo' });
        }

        req.user = user;
        req.permissionChecker = checker;
        next();
    };
}

/**
 * Middleware: requiere permiso para EDITAR en un módulo
 * @param {string} modulo - Nombre del módulo
 */
function requireEdit(modulo) {
    return (req, res, next) => {
        const user = extractUser(req);
        
        if (!user.email) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const checker = new PermissionChecker(user);
        
        if (!checker.canEdit(modulo)) {
            return res.status(403).json({ error: 'Sin permisos para editar en este módulo' });
        }

        req.user = user;
        req.permissionChecker = checker;
        next();
    };
}

/**
 * Middleware: requiere permiso para ELIMINAR en un módulo
 * @param {string} modulo - Nombre del módulo
 */
function requireDelete(modulo) {
    return (req, res, next) => {
        const user = extractUser(req);
        
        if (!user.email) {
            return res.status(401).json({ error: 'No autenticado' });
        }

        const checker = new PermissionChecker(user);
        
        if (!checker.canDelete(modulo)) {
            return res.status(403).json({ error: 'Sin permisos para eliminar en este módulo' });
        }

        req.user = user;
        req.permissionChecker = checker;
        next();
    };
}

/**
 * Crea middlewares CRUD completos para un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {Object} { view, create, update, delete }
 */
function crudMiddleware(modulo) {
    return {
        view: requireView(modulo),
        create: requireCreate(modulo),
        update: requireEdit(modulo),
        delete: requireDelete(modulo)
    };
}

module.exports = {
    extractUser,
    requireAuth,
    requireView,
    requireCreate,
    requireEdit,
    requireDelete,
    crudMiddleware
};
