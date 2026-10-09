const { query } = require('../config/database');

/**
 * Service para gestión de materias primas.
 * Extraído de produccionCatalogos.js para mejor mantenibilidad.
 */

const getMateriasPrimas = async () => {
    const result = await query('SELECT * FROM materias_primas ORDER BY nombre, espesor_mm');
    return result.rows;
};

const crearMateriaPrima = async ({ codigo_mp, nombre, espesor_mm, costo_unitario_mp, costo_unitario_importado, hojas_por_paquete_nal, ancho_nal, alto_nal, paquetes_por_camion, hojas_por_paquete_imp, ancho_imp, alto_imp, paquetes_por_contenedor, consumo_promedio_mensual, observacion, mpa }) => {
    const result = await query(
        `INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm, costo_unitario_mp, costo_unitario_importado,
         hojas_por_paquete_nal, ancho_nal, alto_nal, paquetes_por_camion,
         hojas_por_paquete_imp, ancho_imp, alto_imp, paquetes_por_contenedor, consumo_promedio_mensual, observacion, mpa)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
        [codigo_mp.trim(), nombre.trim(), espesor_mm||0, costo_unitario_mp||0, costo_unitario_importado||0,
         hojas_por_paquete_nal||0, ancho_nal||0, alto_nal||0, paquetes_por_camion||0,
         hojas_por_paquete_imp||0, ancho_imp||0, alto_imp||0, paquetes_por_contenedor||0, consumo_promedio_mensual||0, observacion||'', mpa||0]
    );
    return result.rows[0];
};

const editarMateriaPrima = async (id, { codigo_mp, nombre, espesor_mm, costo_unitario_mp, costo_unitario_importado, hojas_por_paquete_nal, ancho_nal, alto_nal, paquetes_por_camion, hojas_por_paquete_imp, ancho_imp, alto_imp, paquetes_por_contenedor, consumo_promedio_mensual, observacion, mpa }) => {
    // Actualización parcial: solo se modifican los campos presentes en el body.
    // Antes faltar codigo_mp/nombre lanzaba TypeError (.trim() sobre undefined → 500)
    // y los campos ausentes se escribían como NULL borrando datos.
    const fields = [];
    const params = [];
    let idx = 1;
    const add = (col, val) => { fields.push(`${col} = $${idx++}`); params.push(val); };

    if (codigo_mp !== undefined) add('codigo_mp', String(codigo_mp).trim());
    if (nombre !== undefined) add('nombre', String(nombre).trim());
    if (espesor_mm !== undefined) add('espesor_mm', espesor_mm || 0);
    if (costo_unitario_mp !== undefined) add('costo_unitario_mp', costo_unitario_mp || 0);
    if (costo_unitario_importado !== undefined) add('costo_unitario_importado', costo_unitario_importado || 0);
    if (hojas_por_paquete_nal !== undefined) add('hojas_por_paquete_nal', hojas_por_paquete_nal || 0);
    if (ancho_nal !== undefined) add('ancho_nal', ancho_nal || 0);
    if (alto_nal !== undefined) add('alto_nal', alto_nal || 0);
    if (paquetes_por_camion !== undefined) add('paquetes_por_camion', paquetes_por_camion || 0);
    if (hojas_por_paquete_imp !== undefined) add('hojas_por_paquete_imp', hojas_por_paquete_imp || 0);
    if (ancho_imp !== undefined) add('ancho_imp', ancho_imp || 0);
    if (alto_imp !== undefined) add('alto_imp', alto_imp || 0);
    if (paquetes_por_contenedor !== undefined) add('paquetes_por_contenedor', paquetes_por_contenedor || 0);
    if (consumo_promedio_mensual !== undefined) add('consumo_promedio_mensual', consumo_promedio_mensual || 0);
    if (observacion !== undefined) add('observacion', observacion || '');
    if (mpa !== undefined) add('mpa', mpa || 0);

    if (fields.length === 0) throw new Error('Sin campos para actualizar');

    params.push(id);
    const result = await query(
        `UPDATE materias_primas SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
        params
    );
    return result.rows[0];
};

const eliminarMateriaPrima = async (id) => {
    // recetas_bom.materia_prima_id es ON DELETE CASCADE: un DELETE directo borraría
    // recetas BOM en silencio. Se bloquea el borrado si hay recetas que usan la MP.
    const recetas = await query('SELECT COUNT(*) as total FROM recetas_bom WHERE materia_prima_id = $1', [id]);
    const total = Number(recetas.rows[0].total) || 0;
    if (total > 0) {
        const err = new Error('No se puede eliminar la materia prima: ' + total + ' receta(s) BOM la utilizan. Elimine o reasigne esas recetas primero.');
        err.status = 409;
        throw err;
    }
    const result = await query('DELETE FROM materias_primas WHERE id = $1', [id]);
    if (result.rowCount === 0) {
        const err = new Error('Materia prima no encontrada');
        err.status = 404;
        throw err;
    }
};

module.exports = {
    getMateriasPrimas,
    crearMateriaPrima,
    editarMateriaPrima,
    eliminarMateriaPrima
};
