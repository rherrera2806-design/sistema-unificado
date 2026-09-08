const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sistema_unificado';

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false,
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

const query = async (text, params = []) => pool.query(text, params);

/**
 * Ejecuta múltiples queries en una transacción.
 * Si alguna falla, hace rollback de todas.
 * @param {Function} callback - Función que recibe { query } y ejecuta las queries
 * @returns {*} Resultado de la última query
 */
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const txQuery = (text, params = []) => client.query(text, params);
        const result = await callback({ query: txQuery });
        await client.query('COMMIT');
        return result;
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

module.exports = { pool, query, transaction };
