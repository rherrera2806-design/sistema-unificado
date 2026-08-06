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
        SELECT r.*, m.codigo_mp, m.nombre as mp_nombre, m.espesor_mm, m.costo_unitario_mp,
               f.nombre_familia
        FROM recetas_bom r
        LEFT JOIN materias_primas m ON r.materia_prima_id = m.id
        LEFT JOIN familias_producto f ON r.familia_id = f.id
        ORDER BY r.codigo_sap_padre, m.codigo_mp
    `);
    return result.rows;
};

const crearRecetaBom = async ({ codigo_sap_padre, materia_prima_id, familia_id, cantidad, procesos_especificos_json, ancho, alto }) => {
    const procsJson = (procesos_especificos_json !== undefined && procesos_especificos_json !== null)
        ? JSON.stringify(Array.isArray(procesos_especificos_json) ? procesos_especificos_json : [])
        : null;
    const famId = (familia_id !== undefined && familia_id !== null && familia_id !== '') ? Number(familia_id) : null;
    const result = await query(
        `INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, familia_id, cantidad, procesos_especificos_json, ancho, alto)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING *`,
        [codigo_sap_padre.trim(), materia_prima_id, famId, cantidad || 1, procsJson, ancho || null, alto || null]
    );
    return result.rows[0];
};

const actualizarRecetaBom = async (id, { codigo_sap_padre, materia_prima_id, familia_id, cantidad, procesos_especificos_json, ancho, alto }) => {
    const procsJson = (procesos_especificos_json !== undefined)
        ? (procesos_especificos_json === null || procesos_especificos_json === '' || (Array.isArray(procesos_especificos_json) && procesos_especificos_json.length === 0)
            ? null
            : JSON.stringify(procesos_especificos_json))
        : undefined;
    const famId = (familia_id !== undefined)
        ? ((familia_id === null || familia_id === '') ? null : Number(familia_id))
        : undefined;
    const result = await query(
        `UPDATE recetas_bom SET
            codigo_sap_padre = COALESCE($1, codigo_sap_padre),
            materia_prima_id = COALESCE($2, materia_prima_id),
            familia_id = $3,
            cantidad = COALESCE($4, cantidad),
            procesos_especificos_json = $5::jsonb,
            ancho = $7,
            alto = $8
         WHERE id = $6 RETURNING *`,
        [codigo_sap_padre?.trim() || null, materia_prima_id || null, famId, cantidad || null, procsJson, id, ancho !== undefined ? (ancho || null) : undefined, alto !== undefined ? (alto || null) : undefined]
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

// ============ RECETAS BOM - IMPORTAR ============

const findCol = (row, candidates) => {
    const normalized = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    for (const c of candidates) {
        for (const key of Object.keys(row)) {
            if (normalized(key) === normalized(c)) return key;
        }
    }
    return null;
};

const previewRecetasBom = async (rows) => {
    const colCodigo = findCol(rows[0], ['Codigo SAP', 'CodigoSap', 'Codigo_Padre', 'Codigo Padre', 'codigo_sap_padre', 'SAP']);
    const colMP = findCol(rows[0], ['Codigo MP', 'CodigoMP', 'Codigo_Materia_Prima', 'Codigo Materia Prima', 'codigo_materia_prima', 'MateriaPrima']);
    const colCant = findCol(rows[0], ['Cantidad', 'cantidad', 'Cantdad']);
    const colEst = findCol(rows[0], ['Estaciones', 'estaciones', 'Estaciones IDs', 'Ruta', 'procesos_especificos_json']);
    const colAncho = findCol(rows[0], ['Ancho', 'ancho', 'Width']);
    const colAlto = findCol(rows[0], ['Alto', 'alto', 'Height']);

    const missing = [];
    if (!colCodigo) missing.push('Codigo SAP');
    if (!colMP) missing.push('Codigo MP');
    if (missing.length) return { total: rows.length, validas: 0, errores: [{ fila: 1, error: 'Faltan columnas requeridas: ' + missing.join(', ') + '. Columnas detectadas: ' + Object.keys(rows[0]).join(', ') }], sample: [] };

    const materias = await query('SELECT id, codigo_mp FROM materias_primas');
    const mpMap = {};
    materias.rows.forEach(m => { mpMap[m.codigo_mp] = m.id; });

    const estaciones = await query('SELECT id, nombre_estacion FROM estaciones_maestras');
    const estMap = {};
    estaciones.rows.forEach(e => { estMap[e.nombre_estacion.toLowerCase()] = e.id; estMap[e.id] = e.id; });

    const errores = [];
    let validas = 0;
    const seen = new Set();

    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const sap = String(row[colCodigo] || '').trim();
        const mp = String(row[colMP] || '').trim();
        if (!sap || !mp) { errores.push({ fila: i + 1, error: 'Codigo SAP o MP vacio' }); continue; }
        if (!mpMap[mp]) { errores.push({ fila: i + 1, error: 'Materia prima "' + mp + '" no existe' }); continue; }

        let estacionesArray = null;
        if (colEst && row[colEst]) {
            const raw = String(row[colEst]).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
            if (raw.length > 0) estacionesArray = raw;
        }

        const key = sap + '|' + mp;
        if (seen.has(key)) { errores.push({ fila: i + 1, error: 'Duplicado: ' + sap + ' + ' + mp }); continue; }
        seen.add(key);
        validas++;
    }

    const sample = rows.slice(0, 5).map(row => ({
        codigo_sap: String(row[colCodigo] || '').trim(),
        codigo_mp: String(row[colMP] || '').trim(),
        cantidad: colCant ? Number(row[colCant]) || 1 : 1,
        estaciones: colEst ? String(row[colEst] || '').trim() : '',
        ancho: colAncho ? Number(row[colAncho]) || null : null,
        alto: colAlto ? Number(row[colAlto]) || null : null
    }));

    return { total: rows.length, validas, errores, sample };
};

const importarRecetasBom = async (rows) => {
    const resultados = { importadas: 0, saltadas: 0, errores: [] };

    const materias = await query('SELECT id, codigo_mp FROM materias_primas');
    const mpMap = {};
    materias.rows.forEach(m => { mpMap[m.codigo_mp] = m.id; });

    const colCodigo = findCol(rows[0], ['Codigo SAP', 'CodigoSap', 'Codigo_Padre', 'Codigo Padre', 'codigo_sap_padre', 'SAP']);
    const colMP = findCol(rows[0], ['Codigo MP', 'CodigoMP', 'Codigo_Materia_Prima', 'Codigo Materia Prima', 'codigo_materia_prima', 'MateriaPrima']);
    const colCant = findCol(rows[0], ['Cantidad', 'cantidad', 'Cantdad']);
    const colEst = findCol(rows[0], ['Estaciones', 'estaciones', 'Estaciones IDs', 'Ruta', 'procesos_especificos_json']);
    const colAncho = findCol(rows[0], ['Ancho', 'ancho', 'Width']);
    const colAlto = findCol(rows[0], ['Alto', 'alto', 'Height']);

    for (let i = 0; i < rows.length; i++) {
        try {
            const row = rows[i];
            const sap = String(row[colCodigo] || '').trim();
            const mp = String(row[colMP] || '').trim();
            if (!sap || !mp) { resultados.errores.push({ fila: i + 1, error: 'Codigo SAP o MP vacio' }); continue; }

            const mpId = mpMap[mp];
            if (!mpId) { resultados.errores.push({ fila: i + 1, error: 'Materia prima "' + mp + '" no encontrada' }); continue; }

            let estacionesArray = null;
            if (colEst && row[colEst]) {
                const raw = String(row[colEst]).split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
                if (raw.length > 0) estacionesArray = raw;
            }

            const existe = await query('SELECT id FROM recetas_bom WHERE codigo_sap_padre = $1 AND materia_prima_id = $2', [sap, mpId]);
            if (existe.rows.length > 0) { resultados.saltadas++; continue; }

            const cantidad = colCant ? (Number(row[colCant]) || 1) : 1;
            const procsJson = estacionesArray ? JSON.stringify(estacionesArray) : null;
            const ancho = colAncho ? Number(row[colAncho]) || null : null;
            const alto = colAlto ? Number(row[colAlto]) || null : null;

            await query(
                'INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad, procesos_especificos_json, ancho, alto) VALUES ($1, $2, $3, $4::jsonb, $5, $6)',
                [sap, mpId, cantidad, procsJson, ancho, alto]
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
    getRecetasBom, crearRecetaBom, actualizarRecetaBom, eliminarRecetaBom,
    previewRecetasBom, importarRecetasBom,
    getRecetasAntiguas, crearRecetaAntigua, eliminarRecetaAntigua, eliminarTodasRecetasAntiguas, importarRecetasAntiguas,
    getReglasExtras, crearReglaExtra, editarReglaExtra, eliminarReglaExtra,
    getTecnicos, crearTecnico, editarTecnico, eliminarTecnico,
    getVendedores, crearVendedor, editarVendedor, eliminarVendedor
};
