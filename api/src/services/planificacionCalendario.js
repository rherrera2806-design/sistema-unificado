const { query } = require('../config/database');

const getCalendario = async () => {
    const result = await query('SELECT * FROM calendario_produccion ORDER BY fecha ASC');
    return result.rows;
};

const marcarDia = async ({ fecha, es_laboral, motivo }) => {
    const existing = await query('SELECT id FROM calendario_produccion WHERE fecha = $1', [fecha]);
    if (existing.rows.length > 0) {
        await query('UPDATE calendario_produccion SET es_laboral = $1, motivo = $2 WHERE fecha = $3', [es_laboral !== false, motivo || '', fecha]);
    } else {
        await query('INSERT INTO calendario_produccion (fecha, es_laboral, motivo) VALUES ($1, $2, $3)', [fecha, es_laboral !== false, motivo || '']);
    }
};

const eliminarDia = async (id) => {
    await query('DELETE FROM calendario_produccion WHERE id = $1', [id]);
};

const getCalendarioMap = async (inicio, fin) => {
    const calMap = {};
    try {
        const sql = inicio && fin
            ? query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral, motivo FROM calendario_produccion WHERE fecha >= $1::date AND fecha <= $2::date`, [inicio, fin])
            : query(`SELECT to_char(fecha, 'YYYY-MM-DD') as fs, es_laboral, motivo FROM calendario_produccion`);
        const calRes = await sql;
        for (const c of calRes.rows) calMap[c.fs] = { es_laboral: c.es_laboral, motivo: c.motivo };
    } catch (e) { /* calendario opcional */ }
    return calMap;
};

const esLaboral = (calMap, fStr) => {
    if (calMap.hasOwnProperty(fStr)) return calMap[fStr].es_laboral;
    const d = new Date(fStr + 'T12:00:00');
    return d.getDay() !== 0 && d.getDay() !== 6;
};

module.exports = { getCalendario, marcarDia, eliminarDia, getCalendarioMap, esLaboral };
