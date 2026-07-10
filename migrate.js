const { Pool } = require('pg');

const RENDER_URL = 'postgresql://sigma_db_xvaa_user:pyADEAFcrLynuAl6aXU5fQdYfAjdupCz@dpg-d96hl0l8nd3s73bhb5n0-a.oregon-postgres.render.com/sigma_db_xvaa';
const RAILWAY_URL = 'postgresql://postgres:GzvRAsyjkPLLyVhEUAwzWQjQgvKWpxaA@postgres.railway.internal:5432/railway';

const TABLES = [
    'machine_types',
    'components',
    'component_type_links',
    'machines',
    'spare_parts',
    'preventive_maintenance',
    'corrective_maintenance',
    'machine_components',
    'notas'
];

const COLUMNS = {
    machine_types: ['id', 'nombre'],
    components: ['id', 'nombre', 'descripcion'],
    component_type_links: ['componente_id', 'tipo_id'],
    machines: ['id', 'codigo', 'nombre', 'tipo_id', 'marca', 'modelo', 'numero_serie', 'ubicacion', 'fecha_compra', 'estado_operativo', 'observaciones'],
    spare_parts: ['id', 'codigo', 'descripcion', 'componente_id', 'stock_actual', 'stock_minimo', 'proveedor', 'ubicacion_bodega'],
    preventive_maintenance: ['id', 'maquina_id', 'componente_id', 'frecuencia_diaria', 'frecuencia_semanal', 'frecuencia_mensual', 'frecuencia_trimestral', 'frecuencia_semestral', 'frecuencia_anual', 'fecha_programada', 'fecha_ejecutada', 'estado', 'tecnico', 'turno', 'observaciones'],
    corrective_maintenance: ['id', 'maquina_id', 'componente_id', 'fecha_falla', 'descripcion_falla', 'diagnostico', 'accion_correctiva', 'responsable', 'horas_detencion', 'estado', 'fecha_reparacion'],
    machine_components: ['maquina_id', 'componente_id'],
    notas: ['id', 'maquina_id', 'texto', 'autor', 'created_at']
};

async function migrate() {
    const src = new Pool({ connectionString: RENDER_URL, ssl: { rejectUnauthorized: false } });
    const dst = new Pool({ connectionString: RAILWAY_URL, ssl: { rejectUnauthorized: false } });

    try {
        await dst.query('BEGIN');
        
        for (const table of TABLES) {
            const cols = COLUMNS[table];
            console.log(`Migrating ${table}...`);
            
            const result = await src.query(`SELECT * FROM ${table}`);
            console.log(`  Found ${result.rows.length} rows`);
            
            if (result.rows.length === 0) continue;
            
            // Delete existing data in Railway
            await dst.query(`DELETE FROM ${table}`);
            
            for (const row of result.rows) {
                const validCols = cols.filter(c => row[c] !== undefined);
                const values = validCols.map(c => row[c]);
                const placeholders = validCols.map((_, i) => `$${i + 1}`);
                
                await dst.query(
                    `INSERT INTO ${table} (${validCols.join(',')}) VALUES (${placeholders.join(',')})`,
                    values
                );
            }
            
            console.log(`  Migrated ${result.rows.length} rows to ${table}`);
        }
        
        await dst.query('COMMIT');
        console.log('\nMigration COMPLETE!');
        
        // Verify
        console.log('\nVerification:');
        for (const table of TABLES) {
            const r = await dst.query(`SELECT COUNT(*) as c FROM ${table}`);
            console.log(`  ${table}: ${r.rows[0].c} rows`);
        }
        
    } catch(e) {
        await dst.query('ROLLBACK');
        console.error('ERROR:', e.message);
    }
    
    await src.end();
    await dst.end();
}

migrate();
