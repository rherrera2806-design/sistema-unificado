const { query } = require('../config/database');
const { SIGMA_TABLES } = require('../config/constants');

/**
 * Validates that a table name is in the allowed SIGMA_TABLES list.
 * Prevents SQL injection by whitelist validation.
 * @param {string} table - Table name to validate
 * @throws {Error} If table is not in SIGMA_TABLES
 */
function validateSigmaTable(table) {
    if (!SIGMA_TABLES.includes(table)) throw new Error('Tabla invalida: ' + table);
}

/**
 * Get all rows from a SIGMA table.
 * @param {string} table - Table name (must be in SIGMA_TABLES)
 * @returns {Promise<Array>} Array of rows
 */
async function getAll(table) {
    validateSigmaTable(table);
    const result = await query(`SELECT * FROM ${table} ORDER BY id`);
    return result.rows;
}

/**
 * Get a single row by ID from a SIGMA table.
 * @param {string} table - Table name
 * @param {number} id - Row ID
 * @returns {Promise<Object|null>} Row object or null
 */
async function getById(table, id) {
    validateSigmaTable(table);
    const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

/**
 * Insert a new row into a SIGMA table.
 * @param {string} table - Table name
 * @param {Object} body - Key-value pairs to insert
 * @returns {Promise<Object>} Inserted row
 */
async function insert(table, body) {
    validateSigmaTable(table);
    const keys = Object.keys(body);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(`INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`, keys.map(k => body[k]));
    return result.rows[0];
}

/**
 * Update an existing row in a SIGMA table.
 * @param {string} table - Table name
 * @param {number} id - Row ID
 * @param {Object} body - Key-value pairs to update
 * @returns {Promise<Object>} Updated row
 */
async function update(table, id, body) {
    validateSigmaTable(table);
    const keys = Object.keys(body);
    if (keys.length === 0) return await getById(table, id);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
    const values = keys.map(k => body[k]);
    values.push(id);
    await query(`UPDATE ${table} SET ${setClause} WHERE id = $${keys.length + 1}`, values);
    return await getById(table, id);
}

/**
 * Delete a row from a SIGMA table.
 * @param {string} table - Table name
 * @param {number} id - Row ID
 * @returns {Promise<boolean>} true if deleted, false if not found
 */
async function del(table, id) {
    validateSigmaTable(table);
    const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return result.rowCount > 0;
}

/**
 * Export all SIGMA tables as a JSON object.
 * @returns {Promise<Object>} Object with table names as keys and row arrays as values
 */
async function exportJSON() {
    const data = {};
    for (const t of SIGMA_TABLES) data[t] = await getAll(t);
    return data;
}

async function importJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    await query('BEGIN');
    try {
        for (const t of SIGMA_TABLES) await query(`DELETE FROM ${t}`);
        for (const t of SIGMA_TABLES) {
            const items = d[t] || [];
            for (const item of items) {
                const keys = Object.keys(item);
                const cols = keys.join(', ');
                const ph = keys.map((_, i) => `$${i + 1}`).join(', ');
                await query(`INSERT INTO ${t} (${cols}) VALUES (${ph})`, keys.map(k => item[k]));
            }
        }
        await query('COMMIT');
    } catch(e) { await query('ROLLBACK'); throw e; }
}

async function clearAllSigma() {
    await query('BEGIN');
    try {
        for (const t of SIGMA_TABLES) await query(`DELETE FROM ${t}`);
        await query('COMMIT');
    } catch(e) { await query('ROLLBACK'); throw e; }
}

async function getSigmaStats() {
    const [machines, preventivos, correctivos, spareParts, critical] = await Promise.all([
        query('SELECT COUNT(*) as c FROM machines'),
        query('SELECT COUNT(*) as c FROM preventive_maintenance'),
        query('SELECT COUNT(*) as c FROM corrective_maintenance'),
        query('SELECT COUNT(*) as c FROM spare_parts'),
        query('SELECT COUNT(*) as c FROM spare_parts WHERE stock_actual <= stock_minimo')
    ]);
    return {
        totalMachines: Number(machines.rows[0].c),
        totalMaintenance: Number(preventivos.rows[0].c) + Number(correctivos.rows[0].c),
        totalFailures: Number(correctivos.rows[0].c),
        totalSpareParts: Number(spareParts.rows[0].c),
        criticalSpareParts: Number(critical.rows[0].c)
    };
}

module.exports = { getAll, getById, insert, update, del, exportJSON, importJSON, clearAllSigma, getSigmaStats };
