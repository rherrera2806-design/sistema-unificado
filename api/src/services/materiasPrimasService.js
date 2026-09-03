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
    const result = await query(
        `UPDATE materias_primas SET codigo_mp=$1, nombre=$2, espesor_mm=$3, costo_unitario_mp=$4, costo_unitario_importado=$5,
         hojas_por_paquete_nal=$6, ancho_nal=$7, alto_nal=$8, paquetes_por_camion=$9,
         hojas_por_paquete_imp=$10, ancho_imp=$11, alto_imp=$12, paquetes_por_contenedor=$13, consumo_promedio_mensual=$14, observacion=$15, mpa=$16
         WHERE id=$17 RETURNING *`,
        [codigo_mp, nombre, espesor_mm, costo_unitario_mp, costo_unitario_importado,
         hojas_por_paquete_nal, ancho_nal, alto_nal, paquetes_por_camion,
         hojas_por_paquete_imp, ancho_imp, alto_imp, paquetes_por_contenedor, consumo_promedio_mensual||0, observacion, mpa||0, id]
    );
    return result.rows[0];
};

const eliminarMateriaPrima = async (id) => {
    await query('DELETE FROM materias_primas WHERE id = $1', [id]);
};

module.exports = {
    getMateriasPrimas,
    crearMateriaPrima,
    editarMateriaPrima,
    eliminarMateriaPrima
};
