const { query } = require('../config/database');

/**
 * Service para catálogos auxiliares: reglas de procesos extras, técnicos y vendedores.
 * Extraído de produccionCatalogos.js para mejor mantenibilidad.
 */

// ============ REGLAS PROCESOS EXTRAS ============

const getReglasExtras = async () => {
    const result = await query(`
        SELECT r.*, e.nombre_estacion, e.orden_secuencia_defecto
        FROM reglas_procesos_extras r
        LEFT JOIN estaciones_maestras e ON r.estacion_id = e.id
        ORDER BY r.nombre_flag
    `);
    return result.rows;
};

const crearReglaExtra = async ({ nombre_flag, estacion_id }) => {
    const result = await query(
        'INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2) RETURNING *',
        [nombre_flag.trim().toLowerCase(), estacion_id]
    );
    return result.rows[0];
};

const editarReglaExtra = async (id, { nombre_flag, estacion_id, activa }) => {
    await query(
        'UPDATE reglas_procesos_extras SET nombre_flag=$1, estacion_id=$2, activa=$3 WHERE id=$4',
        [nombre_flag, estacion_id, activa, id]
    );
};

const eliminarReglaExtra = async (id) => {
    await query('DELETE FROM reglas_procesos_extras WHERE id = $1', [id]);
};

// ============ TÉCNICOS ============

const getTecnicos = async () => {
    const result = await query('SELECT * FROM tecnicos ORDER BY nombre');
    return result.rows;
};

const crearTecnico = async (nombre) => {
    const result = await query('INSERT INTO tecnicos (nombre) VALUES ($1) RETURNING *', [nombre.trim()]);
    return result.rows[0];
};

const editarTecnico = async (id, { nombre, activo }) => {
    await query('UPDATE tecnicos SET nombre=$1, activo=$2 WHERE id=$3', [nombre, activo !== false, id]);
};

const eliminarTecnico = async (id) => {
    await query('DELETE FROM tecnicos WHERE id = $1', [id]);
};

// ============ VENDEDORES ============

const getVendedores = async () => {
    const result = await query('SELECT * FROM vendedores ORDER BY nombre');
    return result.rows;
};

const crearVendedor = async (nombre) => {
    const result = await query('INSERT INTO vendedores (nombre) VALUES ($1) RETURNING *', [nombre.trim()]);
    return result.rows[0];
};

const editarVendedor = async (id, { nombre, activo }) => {
    await query('UPDATE vendedores SET nombre=$1, activo=$2 WHERE id=$3', [nombre, activo !== false, id]);
};

const eliminarVendedor = async (id) => {
    await query('DELETE FROM vendedores WHERE id = $1', [id]);
};

module.exports = {
    getReglasExtras, crearReglaExtra, editarReglaExtra, eliminarReglaExtra,
    getTecnicos, crearTecnico, editarTecnico, eliminarTecnico,
    getVendedores, crearVendedor, editarVendedor, eliminarVendedor
};
