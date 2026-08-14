/**
 * VitroFlow Permission System - Frontend Helpers
 *
 * Funciones helper para autenticación y headers.
 * Las funciones canView/canCreate/canEdit/canDelete están en app-main.js
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
 * Obtiene los headers para peticiones fetch con permisos
 * @returns {Object} Headers
 */
function getAuthHeaders() {
    const u = getCurrentUser();
    return {
        'Content-Type': 'application/json',
        'X-User-Permisos': (u.permisos || []).join(','),
        'X-User-Email': u.email || ''
    };
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
