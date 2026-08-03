const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS horas_extras (
            id SERIAL PRIMARY KEY,
            trabajador_id INTEGER REFERENCES trabajadores(id),
            fecha DATE NOT NULL,
            horas DECIMAL(4,2) NOT NULL,
            motivo TEXT,
            estado VARCHAR(20) DEFAULT 'pendiente',
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);
    console.log('Table horas_extras created');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_horas_extras_trabajador ON horas_extras(trabajador_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_horas_extras_fecha ON horas_extras(fecha)');
    console.log('Indexes created');
    await pool.end();
    console.log('Done');
}

migrate().catch(e => { console.error(e); process.exit(1); });
