const { query } = require('../config/database');

// Catálogos de producción: materias primas, recetas BOM (nueva y antigua),
// reglas de procesos extras, técnicos y vendedores

// ============ MATERIAS PRIMAS ============

const getMateriasPrimas = async () => {
    const result = await query('SELECT * FROM materias_primas ORDER BY codigo_mp');
    return result.rows;
};

const crearMateriaPrima = async ({ codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion }) => {
    const result = await query(
        'INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [codigo_mp.trim(), nombre.trim(), espesor_mm || 0, costo_unitario_mp || 0, observacion || '']
    );
    return result.rows[0];
};

const editarMateriaPrima = async (id, { codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion }) => {
    const result = await query(
        'UPDATE materias_primas SET codigo_mp=$1, nombre=$2, espesor_mm=$3, costo_unitario_mp=$4, observacion=$5 WHERE id=$6 RETURNING *',
        [codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion, id]
    );
    return result.rows[0];
};

const eliminarMateriaPrima = async (id) => {
    await query('DELETE FROM materias_primas WHERE id = $1', [id]);
};

// ============ RECETAS BOM (NUEVA) ============

const getRecetasBom = async () => {
    const result = await query(`
        SELECT r.*, m.codigo_mp, m.nombre as mp_nombre, m.espesor_mm, m.costo_unitario_mp
        FROM recetas_bom r
        LEFT JOIN materias_primas m ON r.materia_prima_id = m.id
        ORDER BY r.codigo_sap_padre, m.codigo_mp
    `);
    return result.rows;
};

const crearRecetaBom = async ({ codigo_sap_padre, materia_prima_id, cantidad }) => {
    const result = await query(
        'INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad) VALUES ($1, $2, $3) RETURNING *',
        [codigo_sap_padre.trim(), materia_prima_id, cantidad || 1]
    );
    return result.rows[0];
};

const eliminarRecetaBom = async (id) => {
    await query('DELETE FROM recetas_bom WHERE id = $1', [id]);
};

// ============ RECETAS BOM (ANTIGUA) ============

const getRecetasAntiguas = async () => {
    const result = await query('SELECT * FROM produccion_recetas_bom ORDER BY codigo_sap_padre, codigo_materia_prima');
    return result.rows;
};

const crearRecetaAntigua = async ({ codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad }) => {
    const result = await query(
        'INSERT INTO produccion_recetas_bom (codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [codigo_sap_padre, codigo_materia_prima, descripcion || '', espesor || 0, cantidad || 1]
    );
    return result.rows[0];
};

const eliminarRecetaAntigua = async (id) => {
    await query('DELETE FROM produccion_recetas_bom WHERE id = $1', [id]);
};

const eliminarTodasRecetasAntiguas = async () => {
    const count = await query('SELECT COUNT(*) as total FROM produccion_recetas_bom');
    await query('DELETE FROM produccion_recetas_bom');
    return Number(count.rows[0].total);
};

const importarRecetasAntiguas = async (parsedRows) => {
    const resultados = { importadas: 0, errores: [] };
    for (let i = 0; i < parsedRows.length; i++) {
        try {
            const row = parsedRows[i];
            const codigo_padre = String(row['CodigoPadre'] || row['codigo_padre'] || row['codigopadre'] || row['Codigo'] || '').trim();
            const codigo_mp = String(row['CodigoMateriaPrima'] || row['codigo_materiaprima'] || row['codigomateriaprima'] || row['codigo_mp'] || row['MateriaPrima'] || '').trim();
            const desc = String(row['Descripcion'] || row['descripcion'] || '').trim();
            const espesor = Number(row['Espesor'] || row['espesor'] || 0);
            const cantidad = Number(row['Cantidad'] || row['cantidad'] || row['Cantdad'] || row['cantdad'] || 1);

            if (!codigo_padre || !codigo_mp) { resultados.errores.push({ fila: i + 1, error: 'Faltan codigos' }); continue; }
            await query(
                'INSERT INTO produccion_recetas_bom (codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad) VALUES ($1, $2, $3, $4, $5)',
                [codigo_padre, codigo_mp, desc, espesor, cantidad]
            );
            resultados.importadas++;
        } catch (e) { resultados.errores.push({ fila: i + 1, error: e.message }); }
    }
    return resultados;
};

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
    getMateriasPrimas, crearMateriaPrima, editarMateriaPrima, eliminarMateriaPrima,
    getRecetasBom, crearRecetaBom, eliminarRecetaBom,
    getRecetasAntiguas, crearRecetaAntigua, eliminarRecetaAntigua, eliminarTodasRecetasAntiguas, importarRecetasAntiguas,
    getReglasExtras, crearReglaExtra, editarReglaExtra, eliminarReglaExtra,
    getTecnicos, crearTecnico, editarTecnico, eliminarTecnico,
    getVendedores, crearVendedor, editarVendedor, eliminarVendedor
};
