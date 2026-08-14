/**
 * PermissionChecker - Domain Layer
 * 
 * Servicio de dominio para verificación de permisos.
 * Implementa la lógica pura de autorización sin dependencias
 * de infraestructura.
 * 
 * Principios:
 * - Single Responsibility: Solo verifica permisos
 * - Domain-Driven: Usa lenguaje ubiquo del dominio
 * - Early Return: Para mejor legibilidad
 */

class PermissionChecker {
    /**
     * @param {Object} user - Usuario con { rol, permisos }
     */
    constructor(user) {
        this.user = user || { rol: null, permisos: [] };
        this.rol = this.user.rol || null;
        this.permisos = Array.isArray(this.user.permisos) ? this.user.permisos : [];
    }

    /**
     * Verifica si el usuario es administrador
     * @returns {boolean}
     */
    isAdmin() {
        return this.rol === 'admin' || this.permisos.includes('usuarios');
    }

    /**
     * Verifica si el usuario tiene un permiso específico
     * @param {string} permiso - Permiso a verificar
     * @returns {boolean}
     */
    hasPerm(permiso) {
        if (this.isAdmin()) return true;
        return this.permisos.includes(permiso);
    }

    /**
     * Verifica si el usuario tiene AL MENOS UNO de los permisos
     * @param {string[]} permisos - Lista de permisos
     * @returns {boolean}
     */
    hasAnyPerm(permisos) {
        if (this.isAdmin()) return true;
        return permisos.some(p => this.permisos.includes(p));
    }

    /**
     * Verifica si el usuario tiene TODOS los permisos
     * @param {string[]} permisos - Lista de permisos
     * @returns {boolean}
     */
    hasAllPerms(permisos) {
        if (this.isAdmin()) return true;
        return permisos.every(p => this.permisos.includes(p));
    }

    /**
     * Verifica permiso para VER un módulo
     * Acceso base: puede ver el módulo y sus datos
     * @param {string} modulo - Nombre del módulo
     * @returns {boolean}
     */
    canView(modulo) {
        if (this.isAdmin()) return true;
        return this.hasAnyPerm([
            modulo,
            `${modulo}.agregar`,
            `${modulo}.editar`,
            `${modulo}.eliminar`
        ]);
    }

    /**
     * Verifica permiso para CREAR en un módulo
     * @param {string} modulo - Nombre del módulo
     * @returns {boolean}
     */
    canCreate(modulo) {
        if (this.isAdmin()) return true;
        return this.hasAnyPerm([modulo, `${modulo}.agregar`]);
    }

    /**
     * Verifica permiso para EDITAR en un módulo
     * @param {string} modulo - Nombre del módulo
     * @returns {boolean}
     */
    canEdit(modulo) {
        if (this.isAdmin()) return true;
        return this.hasAnyPerm([modulo, `${modulo}.editar`]);
    }

    /**
     * Verifica permiso para ELIMINAR en un módulo
     * @param {string} modulo - Nombre del módulo
     * @returns {boolean}
     */
    canDelete(modulo) {
        if (this.isAdmin()) return true;
        return this.hasAnyPerm([modulo, `${modulo}.eliminar`]);
    }

    /**
     * Obtiene un objeto con todos los permisos CRUD para un módulo
     * @param {string} modulo - Nombre del módulo
     * @returns {Object} { view, create, update, delete }
     */
    getCrudPerms(modulo) {
        return {
            view: this.canView(modulo),
            create: this.canCreate(modulo),
            update: this.canEdit(modulo),
            delete: this.canDelete(modulo)
        };
    }
}

module.exports = PermissionChecker;
