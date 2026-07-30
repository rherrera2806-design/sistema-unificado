const { query } = require('../config/database');

/**
 * Get the currently active turno (being attended).
 * @returns {Promise<Object|null>} Active turno or null
 */
async function getTurnoActual() {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1', [hoy, 'atendiendo']);
    return result.rows[0] || null;
}

/**
 * Get the queue of waiting turnos for today.
 * @returns {Promise<Array>} Array of turnos in 'espera' state
 */
async function getCola() {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero ASC', [hoy, 'espera']);
    return result.rows;
}

/**
 * Get turno statistics for today.
 * @returns {Promise<Object>} Stats: { total, atendidos, enCola, pendientesBodega, actual }
 */
async function getTurnosStats() {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const [totalR, atendidosR, enColaR, pendR] = await Promise.all([
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1', [hoy]),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado IN ($2, $3, $4)', [hoy, 'atendido', 'derivado', 'entregado']),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado = $2', [hoy, 'espera']),
        query("SELECT COUNT(*) AS n FROM entregas WHERE fecha = $1 AND estado = 'pendiente'", [hoy])
    ]);
    return {
        total: Number(totalR.rows[0].n), atendidos: Number(atendidosR.rows[0].n),
        enCola: Number(enColaR.rows[0].n), pendientesBodega: Number(pendR.rows[0].n),
        actual: await getTurnoActual()
    };
}

/**
 * Create a new turno in the queue.
 * @param {Object} data - Turno data
 * @param {string} data.nombre - Client name
 * @param {string} [data.patente] - Vehicle plate
 * @param {string} [data.rut] - Client RUT
 * @param {string} [data.rut_empresa] - Company RUT
 * @param {string} [data.motivo] - Visit reason
 * @returns {Promise<Object>} Created turno
 */
async function crearTurno(data) {
    const { nombre, patente, rut, rut_empresa, motivo } = data;
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const lastTurno = await query('SELECT MAX(numero) as max_n FROM turnos WHERE fecha = $1', [hoy]);
    const nextNum = (Number(lastTurno.rows[0].max_n) || 0) + 1;
    const result = await query(
        'INSERT INTO turnos (nombre, numero, estado, fecha, rut, patente, motivo, rut_empresa) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [nombre || 'Cliente', nextNum, 'espera', hoy, rut || '', patente || '', motivo || 'Retirar', rut_empresa || '']
    );
    return result.rows[0];
}

/**
 * Call the next turno in the queue.
 * @param {number} id - Turno ID
 */
async function llamarTurno(id) {
    const now = new Date().toLocaleTimeString('sv-SE', { timeZone: 'America/Santiago' });
    await query("UPDATE turnos SET estado = 'atendiendo', hora_llamada = $1 WHERE id = $2", [now, id]);
}

/**
 * Mark a turno as completed.
 * @param {number} id - Turno ID
 */
async function finalizarTurno(id) {
    const now = new Date().toLocaleTimeString('sv-SE', { timeZone: 'America/Santiago' });
    await query("UPDATE turnos SET estado = 'atendido', hora_fin = $1 WHERE id = $2", [now, id]);
}

async function eliminarTurno(id) {
    await query('DELETE FROM turnos WHERE id = $1', [id]);
}

module.exports = { getTurnoActual, getCola, getTurnosStats, crearTurno, llamarTurno, finalizarTurno, eliminarTurno };
