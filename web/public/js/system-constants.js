/**
 * VitroFlow - Constantes de Botones del Sistema
 * 
 * Estandariza los nombres de botones para todas las acciones CRUD.
 * Facilita el mantenimiento y garantiza consistencia en toda la UI.
 * 
 * Uso:
 *   <button class="btn">${BTN.NUEVO}</button>
 *   <button class="btn">${BTN.EDITAR}</button>
 */

const BTN = {
    // ═══════ ACCIONES CRUD ═══════
    NUEVO: 'Nuevo',
    EDITAR: 'Editar',
    ELIMINAR: 'Eliminar',
    GUARDAR: 'Guardar',
    CANCELAR: 'Cancelar',
    ACTUALIZAR: 'Actualizar',

    // ═══════ ACCIONES DE LECTURA ═══════
    CARGAR: 'Cargar',
    FILTRAR: 'Filtrar',
    BUSCAR: 'Buscar',
    VER: 'Ver',
    VER_DETALLE: 'Ver detalle',

    // ═══════ ACCIONES DE ESTADO ═══════
    APROBAR: 'Aprobar',
    RECHAZAR: 'Rechazar',
    ACTIVAR: 'Activar',
    DESACTIVAR: 'Desactivar',
    CERRAR: 'Cerrar',

    // ═══════ ACCIONES DE EXPORTACIÓN ═══════
    EXPORTAR_EXCEL: 'Excel',
    EXPORTAR_PDF: 'PDF',
    IMPORTAR: 'Importar',

    // ═══════ ACCIONES DE CONFIRMACIÓN ═══════
    CONFIRMAR: 'Confirmar',
    ACEPTAR: 'Aceptar',
    SI: 'Sí',
    NO: 'No',

    // ═══════ ICONOS (SVG paths) ═══════
    ICON: {
        NUEVO: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
        EDITAR: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
        ELIMINAR: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
        APROBAR: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
        RECHAZAR: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>',
        BUSCAR: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>'
    }
};

// ═══════ MENSAJES DE CONFIRMACIÓN ═══════
const MSG = {
    CONFIRMAR_ELIMINAR: '¿Está seguro de eliminar este registro?',
    CONFIRMAR_ELIMINAR_NOMBRE: (nombre) => `¿Está seguro de eliminar "${nombre}"?`,
    CONFIRMAR_DESACTIVAR: '¿Está seguro de desactivar este registro?',
    CONFIRMAR_ACTIVAR: '¿Está seguro de activar este registro?',
    SIN_DATOS: 'Sin datos para mostrar',
    CARGANDO: 'Cargando...',
    ERROR_CARGAR: 'Error al cargar datos',
    ERROR_GUARDAR: 'Error al guardar',
    ERROR_ELIMINAR: 'Error al eliminar',
    EXITO_GUARDAR: 'Guardado exitosamente',
    EXITO_ELIMINAR: 'Eliminado exitosamente'
};

// ═══════ PERMISOS DEL SISTEMA ═══════
// Lista completa de módulos y submódulos
const SYSTEM_MODULES = {
    // Módulo de Asistencia
    ASISTENCIA: 'asistencia',
    
    // Módulo de Atención (Turnos)
    TURNOS_RECEPCION: 'turnos_recepcion',
    TURNOS_BODEGA: 'turnos_bodega',
    TURNOS_ALMACEN: 'turnos_almacen',
    TURNOS_FACTURAR: 'turnos_facturar',
    TURNOS_QR: 'turnos_qr',
    TURNOS_REPORTE: 'turnos_reporte',
    
    // Módulo de Instalaciones
    INSTALACIONES: 'instalaciones',
    INST_HISTORIAL: 'inst_historial',
    
    // Módulo de Inventario
    INV_INVENTARIO: 'inv_inventario',
    INV_MOVIMIENTOS: 'inv_movimientos',
    INV_HISTORIAL: 'inv_historial',
    INV_CATALOGOS: 'inv_catalogos',
    
    // Módulo de Mantención
    DASHBOARD: 'dashboard',
    MACHINE_TYPES: 'machineTypes',
    MACHINES: 'machines',
    COMPONENTS: 'components',
    PREVENTIVE: 'preventive',
    CORRECTIVE: 'corrective',
    CALENDAR: 'calendar',
    NOTAS: 'notas',
    REPORTS: 'reports',
    HISTORY: 'history',
    BITACORA: 'bitacora',
    
    // Módulo de Pedidos
    PEDIDOS: 'pedidos',
    
    // Módulo de Producción
    PROD_ORDENES: 'prod_ordenes',
    PROD_PLANIFICACION: 'prod_planificacion',
    PROD_REPORTES: 'prod_reportes',
    PROD_NOTAS: 'prod_notas',
    PROD_CONFIG: 'prod_config',
    TALLER: 'taller',
    
    // Módulo de Costos
    COSTEO: 'costeo',
    
    // Administración
    USUARIOS: 'usuarios'
};

// Función helper para obtener permisos CRUD de un módulo
function getModulePerms(moduleName) {
    return {
        view: `${moduleName}`,
        create: `${moduleName}.agregar`,
        edit: `${moduleName}.editar`,
        delete: `${moduleName}.eliminar`
    };
}
