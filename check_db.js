const { Pool } = require('pg');

async function check() {
    // Try Render external hostname
    const urls = [
        'postgresql://sigma_db_xvaa_user:pyADEAFcrLynuAl6aXU5fQdYfAjdupCz@dpg-d96hl0l8nd3s73bhb5n0-a.oregon-postgres.render.com/sigma_db_xvaa',
        'postgresql://sigma_db_xvaa_user:pyADEAFcrLynuAl6aXU5fQdYfAjdupCz@dpg-d96hl0l8nd3s73bhb5n0-a:5432/sigma_db_xvaa'
    ];

    for (const url of urls) {
        const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
        try {
            const r = await pool.query("SELECT (SELECT COUNT(*) FROM machines) as machines, (SELECT COUNT(*) FROM machine_types) as types, (SELECT COUNT(*) FROM components) as comps");
            console.log('OK:', url.substring(0, 80) + '...', JSON.stringify(r.rows[0]));
            await pool.end();
            return url;
        } catch(e) {
            console.log('FAIL:', url.substring(0, 80) + '...', e.message);
        }
        await pool.end();
    }
    return null;
}
check();
