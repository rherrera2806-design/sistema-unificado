const { query, pool } = require('../config/database');

const getAll = async () => {
    const r = await query(`SELECT id, codigo_sap, estaciones_json, descripcion, created_at, updated_at
        FROM procesos_carroceria_sap ORDER BY codigo_sap`);
    return r.rows.map(row => ({
        id: row.id,
        codigo_sap: row.codigo_sap,
        estaciones_json: row.estaciones_json,
        descripcion: row.descripcion,
        created_at: row.created_at,
        updated_at: row.updated_at
    }));
};

const getByCodigoSap = async (codigoSap) => {
    const r = await query(
        'SELECT id, codigo_sap, estaciones_json, descripcion FROM procesos_carroceria_sap WHERE codigo_sap = $1',
        [String(codigoSap).trim()]
    );
    return r.rows.length > 0 ? r.rows[0] : null;
};

const upsert = async ({ codigo_sap, estaciones_json, descripcion }) => {
    const code = String(codigo_sap || '').trim();
    if (!code) throw new Error('codigo_sap requerido');
    const estaciones = Array.isArray(estaciones_json) ? estaciones_json : [];
    const estacionesJson = JSON.stringify(estaciones);

    const r = await query(
        `INSERT INTO procesos_carroceria_sap (codigo_sap, estaciones_json, descripcion, updated_at)
         VALUES ($1, $2::jsonb, $3, NOW())
         ON CONFLICT (codigo_sap) DO UPDATE SET
           estaciones_json = EXCLUDED.estaciones_json,
           descripcion = EXCLUDED.descripcion,
           updated_at = NOW()
         RETURNING *`,
        [code, estacionesJson, descripcion || null]
    );
    return r.rows[0];
};

const remove = async (id) => {
    const r = await query('DELETE FROM procesos_carroceria_sap WHERE id = $1 RETURNING codigo_sap', [id]);
    return r.rows.length > 0;
};

const removeByCodigo = async (codigoSap) => {
    const r = await query('DELETE FROM procesos_carroceria_sap WHERE codigo_sap = $1 RETURNING id', [String(codigoSap).trim()]);
    return r.rows.length > 0;
};

const removeAll = async () => {
    const r = await query('DELETE FROM procesos_carroceria_sap');
    return r.rowCount;
};

const importarMasivo = async (filas) => {
    const client = await pool.connect();
    let insertados = 0, actualizados = 0, errores = 0;
    const erroresDetalle = [];
    try {
        await client.query('BEGIN');
        for (let i = 0; i < filas.length; i++) {
            const f = filas[i];
            try {
                const code = String(f.codigo_sap || '').trim();
                if (!code) { errores++; erroresDetalle.push({ fila: i + 1, error: 'codigo_sap vacío' }); continue; }
                const estIds = (Array.isArray(f.estaciones) ? f.estaciones : []).map(Number).filter(n => Number.isFinite(n) && n > 0);
                const r = await client.query(
                    `INSERT INTO procesos_carroceria_sap (codigo_sap, estaciones_json, descripcion, updated_at)
                     VALUES ($1, $2::jsonb, $3, NOW())
                     ON CONFLICT (codigo_sap) DO UPDATE SET
                       estaciones_json = EXCLUDED.estaciones_json,
                       descripcion = EXCLUDED.descripcion,
                       updated_at = NOW()
                     RETURNING (xmax = 0) AS inserted`,
                    [code, JSON.stringify(estIds), f.descripcion || null]
                );
                if (r.rows[0] && r.rows[0].inserted) insertados++;
                else actualizados++;
            } catch (e) {
                errores++;
                erroresDetalle.push({ fila: i + 1, codigo: f.codigo_sap, error: e.message });
            }
        }
        await client.query('COMMIT');
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
    return { insertados, actualizados, errores, total: filas.length, erroresDetalle: erroresDetalle.slice(0, 20) };
};

const count = async () => {
    const r = await query('SELECT COUNT(*) as c FROM procesos_carroceria_sap');
    return Number(r.rows[0].c);
};

module.exports = {
    getAll,
    getByCodigoSap,
    upsert,
    remove,
    removeByCodigo,
    removeAll,
    importarMasivo,
    count
};
