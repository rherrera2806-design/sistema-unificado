const { query } = require('../config/database');

/**
 * Service para gestión de recetas BOM (nueva y antigua).
 * Extraído de produccionCatalogos.js para mejor mantenibilidad.
 */

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

const resolverFamilia = async (codigo) => {
    const codInfo = await query('SELECT familia FROM produccion_codigos WHERE codigo = $1', [codigo]);
    if (!codInfo.rows.length || !codInfo.rows[0].familia) return null;
    const nombreFam = codInfo.rows[0].familia;
    const famRes = await query(
        'SELECT id FROM familias_producto WHERE UPPER(nombre_familia) = UPPER($1) OR UPPER(codigo_familia) = UPPER($1)',
        [nombreFam]
    );
    return famRes.rows.length > 0 ? famRes.rows[0].id : null;
};

const crearRecetaBom = async ({ codigo_sap_padre, materia_prima_id, cantidad, procesos_especificos_json, ancho, alto }) => {
    const procsJson = (procesos_especificos_json !== undefined && procesos_especificos_json !== null)
        ? JSON.stringify(Array.isArray(procesos_especificos_json) ? procesos_especificos_json : [])
        : null;
    const famId = await resolverFamilia(codigo_sap_padre);
    const result = await query(
        `INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, familia_id, cantidad, procesos_especificos_json, ancho, alto)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7) RETURNING *`,
        [codigo_sap_padre.trim(), materia_prima_id, famId, cantidad || 1, procsJson, ancho || null, alto || null]
    );
    return result.rows[0];
};

const actualizarRecetaBom = async (id, { codigo_sap_padre, materia_prima_id, cantidad, procesos_especificos_json, ancho, alto }) => {
    const procsJson = (procesos_especificos_json !== undefined)
        ? (procesos_especificos_json === null || procesos_especificos_json === '' || (Array.isArray(procesos_especificos_json) && procesos_especificos_json.length === 0)
            ? null
            : JSON.stringify(procesos_especificos_json))
        : undefined;
    const famId = codigo_sap_padre ? await resolverFamilia(codigo_sap_padre) : undefined;
    const result = await query(
        `UPDATE recetas_bom SET
            codigo_sap_padre = COALESCE($1, codigo_sap_padre),
            materia_prima_id = COALESCE($2, materia_prima_id),
            familia_id = COALESCE($3, familia_id),
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

const eliminarTodasRecetasBom = async () => {
    const count = await query('SELECT COUNT(*) as total FROM recetas_bom');
    await query('DELETE FROM recetas_bom');
    return Number(count.rows[0].total);
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
    const normalized = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\u00a0\u200b\u200c\u200d\ufeff\r\n\t]/g, '').trim();
    for (const c of candidates) {
        const nc = normalized(c);
        for (const key of Object.keys(row)) {
            if (normalized(key) === nc) return key;
        }
    }
    for (const c of candidates) {
        const nc = normalized(c);
        for (const key of Object.keys(row)) {
            const nk = normalized(key);
            if (nk.includes(nc) || nc.includes(nk)) return key;
        }
    }
    return null;
};

const findEstacionesCol = (rows) => {
    if (!rows.length) return null;
    const keys = Object.keys(rows[0]);
    for (const key of keys) {
        let commaCount = 0;
        let numericCount = 0;
        for (let i = 0; i < Math.min(rows.length, 20); i++) {
            const val = String(rows[i][key] || '').trim();
            if (val.includes(',')) {
                commaCount++;
                const parts = val.split(',').map(s => parseInt(s.trim(), 10));
                if (parts.every(n => Number.isFinite(n) && n > 0)) numericCount++;
            }
        }
        if (commaCount >= 3 && numericCount >= 3) {
            console.log('[FIND] Estaciones column detected by content:', key, '(', commaCount, 'comma rows,', numericCount, 'numeric)');
            return key;
        }
    }
    console.log('[FIND] No Estaciones column found by content. Checking all columns...');
    for (const key of keys) {
        const samples = rows.slice(0, 5).map(r => String(r[key] || ''));
        console.log('[FIND] Column "' + key + '":', samples.join(' | '));
    }
    return null;
};

const previewRecetasBom = async (rows) => {
    const headers = Object.keys(rows[0] || {});
    const normalized = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s\u00a0\u200b\u200c\u200d\ufeff\r\n\t]/g, '').trim();
    const normHeaders = headers.map(h => ({ raw: h, norm: normalized(h), charCodes: [...h].map(c => c.charCodeAt(0)) }));
    console.log('[PREVIEW] Raw headers:', headers);
    console.log('[PREVIEW] Normalized headers:', JSON.stringify(normHeaders));
    for (let i = 0; i < Math.min(3, rows.length); i++) {
        const row = rows[i];
        const sample = {};
        headers.forEach(h => { sample[h] = { val: row[h], type: typeof row[h], str: String(row[h]).substring(0, 50) }; });
        console.log('[PREVIEW] Fila ' + (i+1) + ':', JSON.stringify(sample));
    }
    const colCodigo = findCol(rows[0], ['Codigo SAP', 'CodigoSap', 'Codigo_Padre', 'Codigo Padre', 'codigo_sap_padre', 'SAP', 'CODIGO_SAP', 'codigo sap']);
    const colMP = findCol(rows[0], ['Codigo MP', 'CodigoMP', 'Codigo_Materia_Prima', 'Codigo Materia Prima', 'codigo_materia_prima', 'MateriaPrima', 'CODIGO_MP', 'Codigo', 'codigo MP']);
    const colCant = findCol(rows[0], ['Cantidad', 'cantidad', 'Cantdad', 'CANTIDAD']);
    let colEst = findCol(rows[0], ['Estaciones', 'estaciones', 'Estaciones IDs', 'Ruta', 'procesos_especificos_json', 'ESTACIONES', 'Procesos', 'procesos', 'RUTA']);
    if (!colEst) colEst = findEstacionesCol(rows);
    let colAncho = findCol(rows[0], ['Ancho', 'ancho', 'Width', 'ANCHO']);
    let colAlto = findCol(rows[0], ['Alto', 'alto', 'Height', 'ALTO']);
    if (!colEst || !colAncho || !colAlto) {
        const allKeys = Object.keys(rows[0] || {});
        if (!colEst && allKeys[3]) { colEst = allKeys[3]; console.log('[PREVIEW] Estaciones detectado por posicion (col 4):', colEst); }
        if (!colAncho && allKeys[4]) { colAncho = allKeys[4]; console.log('[PREVIEW] Ancho detectado por posicion (col 5):', colAncho); }
        if (!colAlto && allKeys[5]) { colAlto = allKeys[5]; console.log('[PREVIEW] Alto detectado por posicion (col 6):', colAlto); }
    }
    console.log('[PREVIEW] Columnas:', { colCodigo, colMP, colCant, colEst, colAncho, colAlto });

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

        const routeKey = estacionesArray ? JSON.stringify(estacionesArray) : (colEst ? 'none' : 'unknown');
        const key = sap + '|' + mp + '|' + routeKey;
        if (routeKey !== 'unknown' && seen.has(key)) { errores.push({ fila: i + 1, error: 'Duplicado: ' + sap + ' + ' + mp + (estacionesArray ? ' con ruta ' + estacionesArray.join(',') : '') }); continue; }
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

    return { total: rows.length, validas, errores, sample, _debug: { colCodigo, colMP, colCant, colEst, colAncho, colAlto, headers: Object.keys(rows[0] || {}), normHeaders: Object.keys(rows[0] || {}).map(h => normalized(h)) } };
};

const importarRecetasBom = async (rows) => {
    const resultados = { importadas: 0, saltadas: 0, errores: [] };

    const materias = await query('SELECT id, codigo_mp FROM materias_primas');
    const mpMap = {};
    materias.rows.forEach(m => { mpMap[m.codigo_mp] = m.id; });

    const colCodigo = findCol(rows[0], ['Codigo SAP', 'CodigoSap', 'Codigo_Padre', 'Codigo Padre', 'codigo_sap_padre', 'SAP', 'CODIGO_SAP']);
    const colMP = findCol(rows[0], ['Codigo MP', 'CodigoMP', 'Codigo_Materia_Prima', 'Codigo Materia Prima', 'codigo_materia_prima', 'MateriaPrima', 'CODIGO_MP', 'Codigo']);
    const colCant = findCol(rows[0], ['Cantidad', 'cantidad', 'Cantdad', 'CANTIDAD']);
    let colEst = findCol(rows[0], ['Estaciones', 'estaciones', 'Estaciones IDs', 'Ruta', 'procesos_especificos_json', 'ESTACIONES', 'Procesos', 'procesos', 'RUTA']);
    if (!colEst) colEst = findEstacionesCol(rows);
    let colAncho = findCol(rows[0], ['Ancho', 'ancho', 'Width', 'ANCHO']);
    let colAlto = findCol(rows[0], ['Alto', 'alto', 'Height', 'ALTO']);
    if (!colEst || !colAncho || !colAlto) {
        const allKeys = Object.keys(rows[0] || {});
        if (!colEst && allKeys[3]) { colEst = allKeys[3]; console.log('[IMPORT] Estaciones detectado por posicion (col 4):', colEst); }
        if (!colAncho && allKeys[4]) { colAncho = allKeys[4]; console.log('[IMPORT] Ancho detectado por posicion (col 5):', colAncho); }
        if (!colAlto && allKeys[5]) { colAlto = allKeys[5]; console.log('[IMPORT] Alto detectado por posicion (col 6):', colAlto); }
    }
    console.log('[IMPORT] Headers:', Object.keys(rows[0] || {}));
    console.log('[IMPORT] Columnas:', { colCodigo, colMP, colCant, colEst, colAncho, colAlto });

    const toInsert = [];
    for (let i = 0; i < rows.length; i++) {
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
        const cantidad = colCant ? (Number(row[colCant]) || 1) : 1;
        const procsJson = estacionesArray ? JSON.stringify(estacionesArray) : null;
        const ancho = colAncho ? Number(row[colAncho]) || null : null;
        const alto = colAlto ? Number(row[colAlto]) || null : null;
        toInsert.push({ sap, mpId, cantidad, procsJson, ancho, alto, fila: i + 1 });
    }

    if (toInsert.length === 0) return resultados;

    const existentes = await query(
        `SELECT codigo_sap_padre, materia_prima_id, procesos_especificos_json::text as ruta_text FROM recetas_bom`
    );
    const existentesSet = new Set();
    existentes.rows.forEach(r => {
        existentesSet.add(r.codigo_sap_padre + '|' + r.materia_prima_id + '|' + (r.ruta_text || 'null'));
    });

    const batch = [];
    const dupesEnExcel = [];
    for (const item of toInsert) {
        const rutaKey = item.procsJson || 'null';
        const dedupeKey = item.sap + '|' + item.mpId + '|' + rutaKey;
        if (existentesSet.has(dedupeKey)) {
            resultados.saltadas++;
            dupesEnExcel.push({ fila: item.fila, sap: item.sap, mp: item.mpId, ruta: item.procsJson || 'sin ruta' });
            continue;
        }
        existentesSet.add(dedupeKey);
        batch.push(item);
    }
    if (dupesEnExcel.length > 0) {
        console.log('[IMPORT] Duplicados saltados:', JSON.stringify(dupesEnExcel.slice(0, 20)));
    }

    const CHUNK = 200;
    for (let i = 0; i < batch.length; i += CHUNK) {
        const chunk = batch.slice(i, i + CHUNK);
        const values = [];
        const params = [];
        let idx = 1;
        chunk.forEach(item => {
            values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}::jsonb, $${idx++}, $${idx++})`);
            params.push(item.sap, item.mpId, item.cantidad, item.procsJson, item.ancho, item.alto);
        });
        try {
            await query(
                `INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad, procesos_especificos_json, ancho, alto) VALUES ${values.join(', ')}`,
                params
            );
            resultados.importadas += chunk.length;
        } catch (e) {
            console.error('[IMPORT] Batch error:', e.message);
            resultados.errores.push({ fila: i + 1, error: 'Error batch: ' + e.message });
        }
    }

    if (dupesEnExcel.length > 0) {
        resultados.errores.push({ fila: 0, error: dupesEnExcel.length + ' duplicados en Excel (misma SAP+MP+Ruta): ' + dupesEnExcel.slice(0, 10).map(d => 'Fila ' + d.fila + ': ' + d.sap + '+' + d.mp).join(', ') + (dupesEnExcel.length > 10 ? ' ...+' + (dupesEnExcel.length - 10) + ' mas' : '') });
    }

    return resultados;
};

module.exports = {
    getRecetasBom, crearRecetaBom, actualizarRecetaBom, eliminarRecetaBom, eliminarTodasRecetasBom,
    previewRecetasBom, importarRecetasBom,
    getRecetasAntiguas, crearRecetaAntigua, eliminarRecetaAntigua, eliminarTodasRecetasAntiguas, importarRecetasAntiguas
};
