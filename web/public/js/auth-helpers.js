/**
 * VitroFlow Permission System - Frontend Entry Point
 * 
 * Punto de entrada unificado para el sistema de permisos del frontend.
 * Proporciona funciones helper globales para verificar permisos.
 * 
 * Uso:
 *   const guard = getPermissionGuard();
 *   if (guard.canView('asistencia')) { ... }
 *   if (guard.canCreate('asistencia')) { ... }
 */

/**
 * Obtiene el usuario actual del localStorage
 * @returns {Object} Usuario con { rol, permisos, email, nombre }
 */
function getCurrentUser() {
    try {
        return JSON.parse(localStorage.getItem('unified_user')) || {};
    } catch {
        return {};
    }
}

/**
 * Crea una instancia de PermissionGuard con el usuario actual
 * @returns {PermissionGuard}
 */
function getPermissionGuard() {
    const user = getCurrentUser();
    return new PermissionGuard(user);
}

/**
 * Verifica si el usuario actual es administrador
 * @returns {boolean}
 */
function isAdmin() {
    const user = getCurrentUser();
    return user.rol === 'admin' || (user.permisos || []).includes('usuarios');
}

/**
 * Verifica si el usuario actual puede VER un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {boolean}
 */
function canView(modulo) {
    return getPermissionGuard().canView(modulo);
}

/**
 * Verifica si el usuario actual puede CREAR en un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {boolean}
 */
function canCreate(modulo) {
    return getPermissionGuard().canCreate(modulo);
}

/**
 * Verifica si el usuario actual puede EDITAR en un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {boolean}
 */
function canEdit(modulo) {
    return getPermissionGuard().canEdit(modulo);
}

/**
 * Verifica si el usuario actual puede ELIMINAR en un módulo
 * @param {string} modulo - Nombre del módulo
 * @returns {boolean}
 */
function canDelete(modulo) {
    return getPermissionGuard().canDelete(modulo);
}

/**
 * Obtiene los headers para peticiones fetch con permisos
 * @returns {Object} Headers
 */
function getAuthHeaders() {
    return getPermissionGuard().getFetchHeaders();
}

/**
 * Helper para peticiones fetch autenticadas
 * @param {string} url - URL de la petición
 * @param {Object} options - Opciones de fetch
 * @returns {Promise<Response>}
 */
async function authFetch(url, options = {}) {
    const headers = getAuthHeaders();
    const mergedOptions = {
        ...options,
        headers: {
            ...headers,
            ...(options.headers || {})
        }
    };
    return fetch(url, mergedOptions);
}
