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
    // Actualización parcial: solo se modifican los campos presentes en el body
    const fields = [];
    const params = [];
    let idx = 1;
    if (nombre_flag !== undefined) { fields.push(`nombre_flag = $${idx++}`); params.push(nombre_flag); }
    if (estacion_id !== undefined) { fields.push(`estacion_id = $${idx++}`); params.push(estacion_id); }
    if (activa !== undefined) { fields.push(`activa = $${idx++}`); params.push(activa !== false); }
    if (fields.length === 0) throw new Error('Sin campos para actualizar');
    params.push(id);
    await query(`UPDATE reglas_procesos_extras SET ${fields.join(', ')} WHERE id = $${idx}`, params);
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
    // Actualización parcial: solo se modifican los campos presentes en el body
    const fields = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); params.push(nombre); }
    if (activo !== undefined) { fields.push(`activo = $${idx++}`); params.push(activo !== false); }
    if (fields.length === 0) throw new Error('Sin campos para actualizar');
    params.push(id);
    await query(`UPDATE tecnicos SET ${fields.join(', ')} WHERE id = $${idx}`, params);
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
    // Actualización parcial: solo se modifican los campos presentes en el body
    const fields = [];
    const params = [];
    let idx = 1;
    if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); params.push(nombre); }
    if (activo !== undefined) { fields.push(`activo = $${idx++}`); params.push(activo !== false); }
    if (fields.length === 0) throw new Error('Sin campos para actualizar');
    params.push(id);
    await query(`UPDATE vendedores SET ${fields.join(', ')} WHERE id = $${idx}`, params);
};

const eliminarVendedor = async (id) => {
    await query('DELETE FROM vendedores WHERE id = $1', [id]);
};

module.exports = {
    getReglasExtras, crearReglaExtra, editarReglaExtra, eliminarReglaExtra,
    getTecnicos, crearTecnico, editarTecnico, eliminarTecnico,
    getVendedores, crearVendedor, editarVendedor, eliminarVendedor
};
