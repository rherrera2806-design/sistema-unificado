/**
 * Módulo central de catálogos de producción.
 * Re-exporta servicios separados para mejor mantenibilidad.
 * 
 * Los servicios están divididos en:
 * - materiasPrimasService.js: Gestión de materias primas
 * - recetasBomService.js: Recetas BOM (nueva y antigua)
 * - catalogosAuxiliaresService.js: Reglas extras, técnicos, vendedores
 */

const materiasPrimas = require('./materiasPrimasService');
const recetasBom = require('./recetasBomService');
const auxiliares = require('./catalogosAuxiliaresService');

module.exports = {
    // Materias primas
    getMateriasPrimas: materiasPrimas.getMateriasPrimas,
    crearMateriaPrima: materiasPrimas.crearMateriaPrima,
    editarMateriaPrima: materiasPrimas.editarMateriaPrima,
    eliminarMateriaPrima: materiasPrimas.eliminarMateriaPrima,
    
    // Recetas BOM (nueva)
    getRecetasBom: recetasBom.getRecetasBom,
    crearRecetaBom: recetasBom.crearRecetaBom,
    actualizarRecetaBom: recetasBom.actualizarRecetaBom,
    eliminarRecetaBom: recetasBom.eliminarRecetaBom,
    eliminarTodasRecetasBom: recetasBom.eliminarTodasRecetasBom,
    previewRecetasBom: recetasBom.previewRecetasBom,
    importarRecetasBom: recetasBom.importarRecetasBom,
    
    // Recetas BOM (antigua)
    getRecetasAntiguas: recetasBom.getRecetasAntiguas,
    crearRecetaAntigua: recetasBom.crearRecetaAntigua,
    eliminarRecetaAntigua: recetasBom.eliminarRecetaAntigua,
    eliminarTodasRecetasAntiguas: recetasBom.eliminarTodasRecetasAntiguas,
    importarRecetasAntiguas: recetasBom.importarRecetasAntiguas,
    
    // Reglas extras
    getReglasExtras: auxiliares.getReglasExtras,
    crearReglaExtra: auxiliares.crearReglaExtra,
    editarReglaExtra: auxiliares.editarReglaExtra,
    eliminarReglaExtra: auxiliares.eliminarReglaExtra,
    
    // Técnicos
    getTecnicos: auxiliares.getTecnicos,
    crearTecnico: auxiliares.crearTecnico,
    editarTecnico: auxiliares.editarTecnico,
    eliminarTecnico: auxiliares.eliminarTecnico,
    
    // Vendedores
    getVendedores: auxiliares.getVendedores,
    crearVendedor: auxiliares.crearVendedor,
    editarVendedor: auxiliares.editarVendedor,
    eliminarVendedor: auxiliares.eliminarVendedor
};
