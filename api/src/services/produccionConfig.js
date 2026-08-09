const { query } = require('../config/database');

// Configuración de producción: máquinas, códigos SAP, estaciones,
// familias, materias primas, recetas BOM y reglas de procesos extras

// ============ MÁQUINAS ============

const getMaquinas = async () => {
    const result = await query('SELECT * FROM produccion_maquinas ORDER BY num_operacion ASC NULLS LAST, nombre ASC');
    return result.rows;
};

const crearMaquina = async ({ nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion }) => {
    const result = await query(
        'INSERT INTO produccion_maquinas (nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [nombre, codigo, capacidad_max_m2_dia || 0, estado || 'ACTIVA', tipo_proceso || null, num_operacion || null]
    );
    return result.rows[0];
};

const importarMaquinas = async (maquinas) => {
    let inserted = 0, skipped = 0;
    const errors = [];
    for (const m of maquinas) {
        if (!m.codigo || !m.nombre) { skipped++; continue; }
        try {
            const existing = await query('SELECT id FROM produccion_maquinas WHERE codigo = $1', [m.codigo]);
            if (existing.rows.length > 0) { skipped++; continue; }
            await query(
                'INSERT INTO produccion_maquinas (nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion) VALUES ($1, $2, $3, $4, $5, $6)',
                [m.nombre, m.codigo, Number(m.capacidad_max_m2_dia) || 0, m.estado || 'ACTIVA', m.tipo_proceso || null, m.num_operacion || null]
            );
            inserted++;
        } catch (e) { errors.push(m.codigo + ': ' + e.message); }
    }
    return { inserted, skipped, errors, total: maquinas.length };
};

const editarMaquina = async (id, { nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion }) => {
    await query(
        'UPDATE produccion_maquinas SET nombre=$1, codigo=$2, capacidad_max_m2_dia=$3, estado=$4, tipo_proceso=$5, num_operacion=$6 WHERE id=$7',
        [nombre, codigo, capacidad_max_m2_dia || 0, estado || 'ACTIVA', tipo_proceso || null, num_operacion || null, id]
    );
};

const eliminarMaquina = async (id) => {
    await query('DELETE FROM produccion_maquinas WHERE id = $1', [id]);
};

// ============ CÓDIGOS SAP ============

const getCodigos = async (search, limit) => {
    let sql = `SELECT c.*, 
        (SELECT COUNT(*) FROM recetas_bom rb WHERE rb.codigo_sap_padre = c.codigo) as recetas_count
        FROM produccion_codigos c`;
    const params = [];
    if (search) {
        sql += ' WHERE c.codigo ILIKE $1 OR c.descripcion ILIKE $1 OR c.grupo ILIKE $1 OR c.familia ILIKE $1';
        params.push('%' + search + '%');
    }
    sql += ' ORDER BY c.codigo';
    if (limit > 0) {
        sql += ' LIMIT $' + (params.length + 1);
        params.push(limit);
    }
    const result = await query(sql, params);
    return result.rows;
};

const crearCodigo = async ({ codigo, descripcion, grupo, familia, bloqueo_tela }) => {
    const result = await query(
        'INSERT INTO produccion_codigos (codigo, descripcion, grupo, familia, bloqueo_tela) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [codigo, descripcion || '', grupo || '', familia || '', bloqueo_tela === true || bloqueo_tela === 'si']
    );
    return result.rows[0];
};

const eliminarCodigo = async (id) => {
    await query('DELETE FROM produccion_codigos WHERE id = $1', [id]);
};

const editarCodigo = async (id, { descripcion, grupo, familia }) => {
    const result = await query(
        'UPDATE produccion_codigos SET descripcion = $1, grupo = $2, familia = $3 WHERE id = $4 RETURNING *',
        [descripcion || '', grupo || '', familia || '', id]
    );
    return result.rows[0];
};

const eliminarTodosCodigos = async () => {
    const result = await query('DELETE FROM produccion_codigos');
    return result.rowCount;
};
const previewCodigos = (rows) => {
    const findCol = (row, candidates) => {
        for (const c of candidates) { if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') return String(row[c]).trim(); }
        const keys = Object.keys(row);
        for (const c of candidates) {
            const found = keys.find(k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            if (found && row[found]) return String(row[found]).trim();
        }
        return '';
    };

    const columnasDetectadas = rows.length > 0 ? Object.keys(rows[0]) : [];
    let conCodigo = 0, sinCodigo = 0, duplicados = 0;
    const seen = new Set();
    const muestra = [];
    for (let i = 0; i < rows.length; i++) {
        const codigo = findCol(rows[i], ['Codigo', 'ItemCode', 'Cod']);
        if (codigo) {
            if (seen.has(codigo)) { duplicados++; continue; }
            seen.add(codigo);
            conCodigo++;
            if (muestra.length < 5) {
                muestra.push({
                    codigo,
                    descripcion: findCol(rows[i], ['Descripcion', 'ItemName', 'Nombre', 'Detalle', 'Desc', 'Description']),
                    grupo: findCol(rows[i], ['Grupo', 'Group', 'Categoria', 'Category']),
                    familia: findCol(rows[i], ['Familia', 'Family', 'Tipo', 'Type'])
                });
            }
        } else { sinCodigo++; }
    }
    return { total: rows.length, con_codigo: conCodigo, sin_codigo: sinCodigo, duplicados, columnas_detectadas: columnasDetectadas, muestra };
};

const importarCodigos = async (rows) => {
    const resultados = { importados: 0, errores: [] };

    const findCol = (row, candidates) => {
        for (const c of candidates) { if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') return String(row[c]).trim(); }
        const keys = Object.keys(row);
        for (const c of candidates) {
            const found = keys.find(k => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === c.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
            if (found && row[found]) return String(row[found]).trim();
        }
        return '';
    };

    const BATCH = 200;
    const bulk = [];
    const seen = new Set();

    for (let i = 0; i < rows.length; i++) {
        try {
            const row = rows[i];
            if (i === 0) console.log('[CODIGOS] Columnas Excel:', Object.keys(row).join(', '));
            const codigo = findCol(row, ['Codigo', 'ItemCode', 'Cod']);
            const descripcion = findCol(row, ['Descripcion', 'ItemName', 'Nombre', 'Detalle', 'Desc', 'Description']);
            const grupo = findCol(row, ['Grupo', 'Group', 'Categoria', 'Category']);
            const familia = findCol(row, ['Familia', 'Family', 'Tipo', 'Type']);

            let bloqueoRaw = '';
            for (const key of Object.keys(row)) {
                const kl = key.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
                if (kl.includes('bloqueo') || kl.includes('bloque') || kl.includes('tela')) {
                    bloqueoRaw = String(row[key] || '').trim();
                    break;
                }
            }
            const bloqueo = bloqueoRaw.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
            const bloqueo_tela_val = ['si', 's', '1', 'true', 'x'].includes(bloqueo);

            if (!codigo) { resultados.errores.push({ fila: i + 1, error: 'Sin codigo' }); continue; }
            if (seen.has(codigo)) continue;
            seen.add(codigo);
            bulk.push([codigo, descripcion, grupo, familia, bloqueo_tela_val]);
        } catch (e) { resultados.errores.push({ fila: i + 1, error: e.message }); }
    }

    console.log(`[CODIGOS] Total filas Excel: ${rows.length}, con codigo: ${bulk.length}, duplicados omitidos: ${rows.length - bulk.length - resultados.errores.length}`);

    for (let b = 0; b < bulk.length; b += BATCH) {
        const chunk = bulk.slice(b, b + BATCH);
        const values = [];
        const params = [];
        let idx = 1;
        for (const [codigo, desc, grupo, fam, bloqueo] of chunk) {
            values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
            params.push(codigo, desc, grupo, fam, bloqueo);
        }
        try {
            await query(
                `INSERT INTO produccion_codigos (codigo, descripcion, grupo, familia, bloqueo_tela)
                 VALUES ${values.join(', ')} ON CONFLICT (codigo) DO UPDATE SET
                 descripcion = EXCLUDED.descripcion, grupo = EXCLUDED.grupo,
                 familia = EXCLUDED.familia, bloqueo_tela = EXCLUDED.bloqueo_tela`,
                params
            );
            resultados.importados += chunk.length;
            console.log(`[CODIGOS] Lote ${Math.floor(b/BATCH)+1}: ${chunk.length} registros OK (${resultados.importados}/${bulk.length})`);
        } catch (e) {
            console.error(`[CODIGOS] Error lote ${Math.floor(b/BATCH)+1}:`, e.message);
            resultados.errores.push({ fila: b + 1, error: 'Error lote: ' + e.message });
        }
    }

    return resultados;
};

// ============ ESTACIONES MAESTRAS ============

const getEstaciones = async () => {
    const result = await query('SELECT * FROM estaciones_maestras ORDER BY orden_secuencia_defecto');
    return result.rows;
};

const crearEstacion = async ({ nombre_estacion, orden_secuencia_defecto, activa, cap_max, cuello_botella }) => {
    const result = await query(
        'INSERT INTO estaciones_maestras (nombre_estacion, orden_secuencia_defecto, activa, cap_max, cuello_botella) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [nombre_estacion.trim(), orden_secuencia_defecto, activa !== false, cap_max || 100, cuello_botella || false]
    );
    return result.rows[0];
};

const editarEstacion = async (id, { nombre_estacion, orden_secuencia_defecto, activa, cap_max, cuello_botella }) => {
    const result = await query(
        'UPDATE estaciones_maestras SET nombre_estacion=$1, orden_secuencia_defecto=$2, activa=$3, cap_max=$4, cuello_botella=$5 WHERE id=$6 RETURNING *',
        [nombre_estacion, orden_secuencia_defecto, activa, cap_max || 100, cuello_botella || false, id]
    );
    return result.rows[0];
};

const eliminarEstacion = async (id) => {
    await query('DELETE FROM estaciones_maestras WHERE id = $1', [id]);
};

// ============ FAMILIAS DE PRODUCTO ============

const getFamilias = async () => {
    const result = await query(`
        SELECT f.*,
            COALESCE(json_agg(json_build_object('estacion_id', feb.estacion_id, 'nombre_estacion', em.nombre_estacion, 'orden', em.orden_secuencia_defecto)
            ORDER BY em.orden_secuencia_defecto) FILTER (WHERE feb.estacion_id IS NOT NULL), '[]') as estaciones_base
        FROM familias_producto f
        LEFT JOIN familia_estaciones_base feb ON f.id = feb.familia_id
        LEFT JOIN estaciones_maestras em ON feb.estacion_id = em.id
        GROUP BY f.id ORDER BY f.codigo_familia
    `);
    return result.rows;
};

const crearFamilia = async ({ codigo_familia, nombre_familia, costo_hh, costo_energia, estacion_ids }) => {
    const result = await query(
        'INSERT INTO familias_producto (codigo_familia, nombre_familia, costo_hh, costo_energia) VALUES ($1, $2, $3, $4) RETURNING *',
        [codigo_familia.trim(), nombre_familia.trim(), costo_hh || 0, costo_energia || 0]
    );
    const fam = result.rows[0];
    if (Array.isArray(estacion_ids)) {
        for (const eid of estacion_ids) {
            await query('INSERT INTO familia_estaciones_base (familia_id, estacion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fam.id, eid]);
        }
    }
    return fam;
};

const editarFamilia = async (id, { codigo_familia, nombre_familia, costo_hh, costo_energia, estacion_ids }) => {
    await query(
        'UPDATE familias_producto SET codigo_familia=$1, nombre_familia=$2, costo_hh=$3, costo_energia=$4 WHERE id=$5',
        [codigo_familia, nombre_familia, costo_hh, costo_energia, id]
    );
    if (Array.isArray(estacion_ids)) {
        await query('DELETE FROM familia_estaciones_base WHERE familia_id = $1', [id]);
        for (const eid of estacion_ids) {
            await query('INSERT INTO familia_estaciones_base (familia_id, estacion_id) VALUES ($1, $2)', [id, eid]);
        }
    }
};

const eliminarFamilia = async (id) => {
    await query('DELETE FROM familias_producto WHERE id = $1', [id]);
};

module.exports = {
    getMaquinas, crearMaquina, importarMaquinas, editarMaquina, eliminarMaquina,
    getCodigos, crearCodigo, editarCodigo, eliminarCodigo, eliminarTodosCodigos, importarCodigos, previewCodigos,
    getEstaciones, crearEstacion, editarEstacion, eliminarEstacion,
    getFamilias, crearFamilia, editarFamilia, eliminarFamilia
};
