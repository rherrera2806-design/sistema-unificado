const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sistema_unificado';

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const SIGMA_TABLES = ['machine_types', 'machines', 'components', 'component_type_links', 'spare_parts', 'preventive_maintenance', 'corrective_maintenance', 'machine_components', 'notas'];

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function query(text, params = []) {
    const result = await pool.query(text, params);
    return result;
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

// =====================================================
// DATABASE INIT
// =====================================================
async function initDB() {
    // --- Usuarios ---
    await query(`CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'usuario',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // --- SIGMA Tables ---
    await query(`CREATE TABLE IF NOT EXISTS machine_types (
        id SERIAL PRIMARY KEY, nombre TEXT NOT NULL
    )`);
    await query(`DELETE FROM machine_types WHERE id NOT IN (SELECT MIN(id) FROM machine_types GROUP BY nombre)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_types_nombre ON machine_types(nombre)');

    await query(`CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY, codigo TEXT, nombre TEXT NOT NULL,
        tipo_id INTEGER, marca TEXT, modelo TEXT, numero_serie TEXT,
        ubicacion TEXT, fecha_compra TEXT, estado_operativo TEXT DEFAULT 'Operativo',
        observaciones TEXT
    )`);

    await query(`CREATE TABLE IF NOT EXISTS components (
        id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT
    )`);
    await query(`DELETE FROM components WHERE id NOT IN (SELECT MIN(id) FROM components GROUP BY nombre)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)');

    await query(`CREATE TABLE IF NOT EXISTS component_type_links (
        id SERIAL PRIMARY KEY, tipo_id INTEGER, componente_id INTEGER
    )`);
    await query(`DELETE FROM component_type_links WHERE id NOT IN (SELECT MIN(id) FROM component_type_links GROUP BY tipo_id, componente_id)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_component_type_links_unique ON component_type_links(tipo_id, componente_id)');

    await query(`CREATE TABLE IF NOT EXISTS preventive_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        frecuencia_diaria INTEGER DEFAULT 0, frecuencia_semanal INTEGER DEFAULT 0,
        frecuencia_mensual INTEGER DEFAULT 0, frecuencia_trimestral INTEGER DEFAULT 0,
        frecuencia_semestral INTEGER DEFAULT 0, frecuencia_anual INTEGER DEFAULT 0,
        fecha_programada TEXT, fecha_ejecutada TEXT, tecnico TEXT DEFAULT 'Pendiente',
        estado TEXT DEFAULT 'Programada', observaciones TEXT
    )`);

    await query(`CREATE TABLE IF NOT EXISTS corrective_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        fecha_falla TEXT, descripcion_falla TEXT, diagnostico TEXT,
        accion_correctiva TEXT, repuestos_utilizados TEXT,
        horas_detencion REAL, responsable TEXT
    )`);

    // SIGMA ALTER TABLE migrations
    try { await query('ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0'); } catch(e) { }
    try { await query('ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS checklist TEXT'); } catch(e) { }
    try { await query('ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0'); } catch(e) { }
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'En Mantención'"); } catch(e) { }
    try { await query('ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS fecha_reparacion TEXT'); } catch(e) { }
    try { await query("ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'"); } catch(e) { }
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'"); } catch(e) { }
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS imagenes TEXT"); } catch(e) { }

    await query(`CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY, codigo TEXT, descripcion TEXT,
        componente_id INTEGER, stock_actual INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0, proveedor TEXT, ubicacion_bodega TEXT
    )`);

    await query(`CREATE TABLE IF NOT EXISTS machine_components (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        UNIQUE(maquina_id, componente_id)
    )`);

    await query(`CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY, tecnico TEXT, nota TEXT, fecha TEXT, hora TEXT
    )`);

    // --- Inventario Tables ---
    await query(`CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
        tipo_movimiento VARCHAR(20) NOT NULL,
        tipo_cristal VARCHAR(50) NOT NULL,
        espesor INTEGER NOT NULL,
        ancho DECIMAL(10,2) NOT NULL,
        alto DECIMAL(10,2) NOT NULL,
        cantidad_planchas INTEGER NOT NULL,
        metros_cuadrados DECIMAL(10,4) NOT NULL,
        proveedor VARCHAR(100),
        tipo_salida VARCHAR(20),
        observaciones TEXT,
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query('CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha_hora)');
    await query('CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo_movimiento)');
    await query('CREATE INDEX IF NOT EXISTS idx_movimientos_cristal ON movimientos(tipo_cristal)');

    // --- Seed admin user ---
    const adminCheck = await query("SELECT id FROM usuarios WHERE email = 'admin@vidrieria.com'");
    if (adminCheck.rows.length === 0) {
        await query(
            "INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, $4)",
            ['Administrador', 'admin@vidrieria.com', hashPassword('admin123'), 'admin']
        );
    }

    // --- Seed SIGMA data ---
    const mtCount = await query('SELECT COUNT(*) as c FROM machine_types');
    if (Number(mtCount.rows[0].c) === 0) await seedSigma();
}

async function seedSigma() {
    await query('BEGIN');
    try {
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [1, 'Compresor']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [2, 'Bomba']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [3, 'Generador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [4, 'Transportador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [5, 'Mezclador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [6, 'Turbina']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [7, 'Ventilador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [8, 'Prensa']);

        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [1, 'Rodamiento', 'Rodamiento de bolas o rodillos']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [2, 'Correa', 'Correa de transmisión']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [3, 'Polea', 'Polea para transmisión por correa']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [4, 'Motor Eléctrico', 'Motor de inducción trifásico']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [5, 'Filtro', 'Filtro de aire o aceite']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [6, 'Bomba Hidráulica', 'Bomba de engranajes o pistones']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [7, 'Cadena', 'Cadena de rodillos']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [8, 'Sensor', 'Sensor de proximidad o temperatura']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [9, 'Válvula', 'Válvula de control']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [10, 'Sello Mecánico', 'Sello de eje rotatorio']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [11, 'Engranaje', 'Engranaje recto o helicoidal']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [12, 'Rodillo', 'Rodillo transportador']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [13, 'Cojinete', 'Cojinete de fricción']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [14, 'Termostato', 'Control de temperatura']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [15, 'Interruptor', 'Interruptor de seguridad']);

        const links = [
            [1,1,4],[2,1,2],[3,1,5],[4,1,1],[5,2,4],[6,2,10],[7,2,1],[8,2,9],
            [9,3,4],[10,3,5],[11,3,14],[12,3,15],[13,4,4],[14,4,7],[15,4,12],[16,4,8],
            [17,5,4],[18,5,11],[19,5,1],[20,5,13],[21,6,1],[22,6,11],[23,6,10],[24,6,8],
            [25,7,4],[26,7,1],[27,7,2],[28,7,3],[29,8,6],[30,8,9],[31,8,8],[32,8,15]
        ];
        for (const [id, tipo_id, componente_id] of links) {
            await query(`INSERT INTO component_type_links (id, tipo_id, componente_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [id, tipo_id, componente_id]);
        }

        await query(`INSERT INTO machines (id, codigo, nombre, tipo_id, marca, modelo, numero_serie, ubicacion, fecha_compra, estado_operativo, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
            [1, 'COM-001','Compresor Principal',1,'Atlas Copco','GA-75','AC-2023-001','Sala de Compresores','2023-03-15','Operativo','Compresor de tornillo 75 kW']);
        await query(`INSERT INTO machines (id, codigo, nombre, tipo_id, marca, modelo, numero_serie, ubicacion, fecha_compra, estado_operativo, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
            [2, 'BOM-001','Bomba de Agua CW-01',2,'Grundfos','CR-32','GR-2022-045','Sala de Bombas','2022-06-20','Operativo','Bomba centrífuga multietapa']);
        await query(`INSERT INTO machines (id, codigo, nombre, tipo_id, marca, modelo, numero_serie, ubicacion, fecha_compra, estado_operativo, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
            [3, 'GEN-001','Generador de Emergencia',3,'Cummins','C550D5','CU-2021-112','Cuarto de Generadores','2021-11-08','En mantención','Generador diésel 550 kVA']);
        await query(`INSERT INTO machines (id, codigo, nombre, tipo_id, marca, modelo, numero_serie, ubicacion, fecha_compra, estado_operativo, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
            [4, 'TRA-001','Transportador Principal',4,'FlexLink','X85P','FL-2023-078','Línea 1','2023-01-10','Operativo','Transportador de banda modular']);
        await query(`INSERT INTO machines (id, codigo, nombre, tipo_id, marca, modelo, numero_serie, ubicacion, fecha_compra, estado_operativo, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
            [5, 'MEZ-001','Mezclador Industrial',5,'Sulzer','SMX-300','SU-2022-034','Área de Procesos','2022-09-05','Operativo','Mezclador estático']);

        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [1, 'ROD-001','Rodamiento SKF 6205-2Z',1,25,10,'SKF Chile','Estante A-12']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [2, 'COR-001','Correa trapezoidal B-85',2,8,5,'Gates','Estante B-03']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [3, 'FIL-001','Filtro de aceite P-5510',5,3,10,'Donaldson','Estante C-07']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [4, 'MOT-001','Motor trifásico 5 HP 1800 RPM',4,2,1,'WEG','Estante D-01']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [5, 'SEL-001','Sello mecánico 1.5"',10,0,3,'John Crane','Estante A-08']);

        await query(`INSERT INTO preventive_maintenance (id, maquina_id, componente_id, frecuencia_diaria, frecuencia_semanal, frecuencia_mensual, frecuencia_trimestral, frecuencia_semestral, frecuencia_anual, fecha_programada, fecha_ejecutada, tecnico, estado, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
            [1,1,5,0,0,1,0,1,1,'2025-07-15','2025-07-15','Carlos Muñoz','Realizada','Cambio de filtro de aceite']);
        await query(`INSERT INTO preventive_maintenance (id, maquina_id, componente_id, frecuencia_diaria, frecuencia_semanal, frecuencia_mensual, frecuencia_trimestral, frecuencia_semestral, frecuencia_anual, fecha_programada, fecha_ejecutada, tecnico, estado, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
            [2,1,1,0,0,0,0,0,1,'2025-08-01','','Pendiente','Programada','Lubricación de rodamientos']);
        await query(`INSERT INTO preventive_maintenance (id, maquina_id, componente_id, frecuencia_diaria, frecuencia_semanal, frecuencia_mensual, frecuencia_trimestral, frecuencia_semestral, frecuencia_anual, fecha_programada, fecha_ejecutada, tecnico, estado, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
            [3,3,5,0,0,1,0,0,1,'2025-06-01','','Pendiente','Vencida','Cambio de filtros']);
        await query(`INSERT INTO preventive_maintenance (id, maquina_id, componente_id, frecuencia_diaria, frecuencia_semanal, frecuencia_mensual, frecuencia_trimestral, frecuencia_semestral, frecuencia_anual, fecha_programada, fecha_ejecutada, tecnico, estado, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
            [4,2,10,0,0,0,1,0,1,'2025-07-20','','María López','Programada','Revisión de sello']);

        await query(`INSERT INTO corrective_maintenance (id, maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, accion_correctiva, repuestos_utilizados, horas_detencion, responsable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
            [1,3,4,'2025-06-28','Motor no arranca, ruido anormal','Bobinado quemado por sobrecarga','Rebobinado del motor y cambio de rodamientos','Rodamiento 6205-2Z (2 uds)',48,'Pedro Soto']);
        await query(`INSERT INTO corrective_maintenance (id, maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, accion_correctiva, repuestos_utilizados, horas_detencion, responsable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
            [2,5,1,'2025-07-01','Vibración excesiva en el mezclador','Rodamiento del eje desgastado','Cambio de rodamiento y alineación','Rodamiento SKF 6310 (1 ud)',12,'Carlos Muñoz']);
        await query(`INSERT INTO corrective_maintenance (id, maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, accion_correctiva, repuestos_utilizados, horas_detencion, responsable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
            [3,2,10,'2025-07-05','Fuga de agua por el eje','Sello mecánico dañado','Reemplazo de sello mecánico','Sello mecánico 1.5" (1 ud)',6,'Ana González']);

        await query('COMMIT');
    } catch(e) { await query('ROLLBACK'); throw e; }
}

// =====================================================
// SIGMA CRUD FUNCTIONS
// =====================================================
function validateSigmaTable(table) {
    if (!SIGMA_TABLES.includes(table)) throw new Error('Invalid table: ' + table);
}

async function getAll(table) {
    validateSigmaTable(table);
    const result = await query(`SELECT * FROM ${table} ORDER BY id`);
    return result.rows;
}

async function getById(table, id) {
    validateSigmaTable(table);
    const result = await query(`SELECT * FROM ${table} WHERE id = $1`, [id]);
    return result.rows[0] || null;
}

async function insert(table, body) {
    validateSigmaTable(table);
    const keys = Object.keys(body);
    const cols = keys.join(', ');
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
    const result = await query(
        `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`,
        keys.map(k => body[k])
    );
    return result.rows[0];
}

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

async function del(table, id) {
    validateSigmaTable(table);
    const result = await query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    return result.rowCount > 0;
}

// =====================================================
// SIGMA QUERY FUNCTIONS
// =====================================================
async function getComponentsByType(tipoId) {
    const result = await query('SELECT DISTINCT componente_id FROM component_type_links WHERE tipo_id = $1', [tipoId]);
    const items = [];
    for (const row of result.rows) {
        const item = await getById('components', row.componente_id);
        if (item) items.push(item);
    }
    return items;
}

async function getMachineWithDetails(maquinaId) {
    const maquina = await getById('machines', maquinaId);
    if (!maquina) return null;
    const [tipo, machineComps, preventivos, correctivos] = await Promise.all([
        getById('machine_types', maquina.tipo_id),
        query(`SELECT c.* FROM components c INNER JOIN machine_components mc ON c.id = mc.componente_id WHERE mc.maquina_id = $1`, [maquinaId]),
        query('SELECT * FROM preventive_maintenance WHERE maquina_id = $1 ORDER BY id', [maquinaId]),
        query('SELECT * FROM corrective_maintenance WHERE maquina_id = $1 ORDER BY id', [maquinaId])
    ]);
    return {
        maquina, tipo, componentes: machineComps.rows,
        preventivos: preventivos.rows,
        correctivos: correctivos.rows
    };
}

async function getOverdue() {
    const today = new Date().toISOString().split('T')[0];
    const result = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.estado != 'Realizada' AND p.fecha_programada < $1
        ORDER BY p.fecha_programada`, [today]);
    return result.rows;
}

async function getUpcoming(days = 15) {
    const today = new Date().toISOString().split('T')[0];
    const future = new Date(Date.now() + days * 86400000).toISOString().split('T')[0];
    const result = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.estado != 'Realizada' AND p.fecha_programada >= $1 AND p.fecha_programada <= $2
        ORDER BY p.fecha_programada`, [today, future]);
    return result.rows;
}

async function getCompleted() {
    const result = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.estado = 'Realizada'
        ORDER BY p.fecha_ejecutada`);
    return result.rows;
}

async function getRecentCompleted() {
    const result = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.estado = 'Realizada'
        ORDER BY p.fecha_ejecutada DESC LIMIT 5`);
    return result.rows;
}

async function getBitacora() {
    const preventivos = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre,
        'Preventiva' as tipo_mantencion, p.observaciones as detalle
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.estado = 'Realizada'`);
    const correctivos = await query(`SELECT c.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(co.nombre,'') as componente_nombre,
        'Correctiva' as tipo_mantencion, c.descripcion_falla as detalle
        FROM corrective_maintenance c
        LEFT JOIN machines m ON m.id = c.maquina_id
        LEFT JOIN components co ON co.id = c.componente_id
        WHERE c.estado = 'Reparada'`);
    const all = [...preventivos.rows, ...correctivos.rows];
    all.sort((a, b) => {
        const dateA = a.fecha_ejecutada || a.fecha_falla || '';
        const dateB = b.fecha_ejecutada || b.fecha_falla || '';
        return dateB.localeCompare(dateA);
    });
    return all;
}

async function getByPeriod(start, end) {
    const result = await query(`SELECT p.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(c.nombre,'') as componente_nombre
        FROM preventive_maintenance p
        LEFT JOIN machines m ON m.id = p.maquina_id
        LEFT JOIN components c ON c.id = p.componente_id
        WHERE p.fecha_programada >= $1 AND p.fecha_programada <= $2
        ORDER BY p.fecha_programada`, [start, end]);
    return result.rows;
}

async function getSigmaStats() {
    const [machines, preventivos, correctivos, spareParts, critical, recent, reparadas, enMantencion] = await Promise.all([
        query('SELECT COUNT(*) as c FROM machines'),
        query('SELECT COUNT(*) as c FROM preventive_maintenance'),
        query('SELECT COUNT(*) as c FROM corrective_maintenance'),
        query('SELECT COUNT(*) as c FROM spare_parts'),
        query('SELECT COUNT(*) as c FROM spare_parts WHERE stock_actual <= stock_minimo'),
        query(`SELECT c.*, COALESCE(m.nombre,'') as maquina_nombre, COALESCE(co.nombre,'') as componente_nombre
            FROM corrective_maintenance c
            LEFT JOIN machines m ON m.id = c.maquina_id
            LEFT JOIN components co ON co.id = c.componente_id
            ORDER BY c.id DESC LIMIT 5`),
        query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado = 'Reparada'"),
        query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado != 'Reparada'")
    ]);
    const [overdue, upcoming, completed] = await Promise.all([
        getOverdue(), getUpcoming(15), getCompleted()
    ]);
    return {
        totalMachines: Number(machines.rows[0].c),
        completedMaintenance: completed.length,
        upcomingMaintenance: upcoming.length,
        overdueMaintenance: overdue.length,
        totalFailures: Number(correctivos.rows[0].c),
        failuresReparadas: Number(reparadas.rows[0].c),
        failuresEnMantencion: Number(enMantencion.rows[0].c),
        criticalSpareParts: Number(critical.rows[0].c),
        totalSpareParts: Number(spareParts.rows[0].c),
        recentFailures: recent.rows
    };
}

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

// =====================================================
// AUTH FUNCTIONS
// =====================================================
async function login(email, password) {
    const result = await query("SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    if (user.password !== hashPassword(password)) return null;
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol };
}

async function register(nombre, email, password) {
    const exists = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (exists.rows.length > 0) throw new Error('El email ya esta registrado');
    const result = await query(
        "INSERT INTO usuarios (nombre, email, password, rol) VALUES ($1, $2, $3, 'usuario') RETURNING id, nombre, email, rol",
        [nombre, email, hashPassword(password)]
    );
    return result.rows[0];
}

// =====================================================
// INVENTARIO FUNCTIONS
// =====================================================
async function getMovimientos(filtros = {}) {
    let sql = 'SELECT m.*, u.nombre as usuario_nombre FROM movimientos m LEFT JOIN usuarios u ON m.usuario_id = u.id';
    const conditions = [];
    const params = [];
    let idx = 1;

    if (filtros.tipo) {
        conditions.push(`m.tipo_movimiento = $${idx++}`);
        params.push(filtros.tipo);
    }
    if (filtros.cristal) {
        conditions.push(`m.tipo_cristal = $${idx++}`);
        params.push(filtros.cristal);
    }
    if (filtros.fechaInicio) {
        conditions.push(`m.fecha_hora >= $${idx++}`);
        params.push(filtros.fechaInicio);
    }
    if (filtros.fechaFin) {
        conditions.push(`m.fecha_hora <= $${idx++}`);
        params.push(filtros.fechaFin + ' 23:59:59');
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' ORDER BY m.fecha_hora DESC';

    const result = await query(sql, params);
    return result.rows;
}

async function crearMovimiento(data) {
    const { usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, proveedor, tipo_salida, observaciones, fecha_hora } = data;
    const metros_cuadrados = (ancho * alto * cantidad_planchas) / 1000000;
    const result = await query(
        `INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, tipo_salida, observaciones, fecha_hora)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [usuario_id || null, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados.toFixed(4), proveedor || null, tipo_salida || null, observaciones || null, fecha_hora || new Date().toISOString()]
    );
    return result.rows[0];
}

async function eliminarMovimiento(id) {
    const result = await query('DELETE FROM movimientos WHERE id = $1', [id]);
    return result.rowCount > 0;
}

async function getInventario(filtros = {}) {
    let sql = `
        SELECT
            tipo_cristal,
            espesor,
            ancho,
            alto,
            SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad_planchas ELSE 0 END) as entradas,
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN cantidad_planchas ELSE 0 END) as salidas_plancha,
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'trozo' THEN cantidad_planchas ELSE 0 END) as trozos,
            SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END) as m2_entradas,
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END) as m2_salidas
        FROM movimientos
    `;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (filtros.cristal) {
        conditions.push(`tipo_cristal = $${idx++}`);
        params.push(filtros.cristal);
    }
    if (filtros.espesor) {
        conditions.push(`espesor = $${idx++}`);
        params.push(filtros.espesor);
    }

    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    sql += ' GROUP BY tipo_cristal, espesor, ancho, alto ORDER BY tipo_cristal, espesor';

    const result = await query(sql, params);
    return result.rows.map(r => ({
        ...r,
        stock: Number(r.entradas) - Number(r.salidas_plancha),
        entradas: Number(r.entradas),
        salidas_plancha: Number(r.salidas_plancha),
        trozos: Number(r.trozos),
        m2_entradas: Number(r.m2_entradas),
        m2_salidas: Number(r.m2_salidas)
    }));
}

async function getEstadisticas() {
    const [total, entradas, salidas, tipos, stock] = await Promise.all([
        query('SELECT COUNT(*) as c FROM movimientos'),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'entrada'"),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'salida'"),
        query('SELECT DISTINCT tipo_cristal FROM movimientos ORDER BY tipo_cristal'),
        query(`SELECT
            COALESCE(SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END), 0) as stock_m2
            FROM movimientos`)
    ]);

    return {
        totalMovimientos: Number(total.rows[0].c),
        totalEntradas: Number(entradas.rows[0].c),
        totalSalidas: Number(salidas.rows[0].c),
        tiposCristal: tipos.rows.map(r => r.tipo_cristal),
        stockM2: Number(stock.rows[0].stock_m2)
    };
}

async function getTiposCristal() {
    const result = await query('SELECT DISTINCT tipo_cristal FROM movimientos ORDER BY tipo_cristal');
    return result.rows.map(r => r.tipo_cristal);
}

async function getEstadisticasPorTipo() {
    const result = await query(`
        SELECT tipo_cristal,
            SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END) as entradas_m2,
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN metros_cuadrados ELSE 0 END) as salidas_m2
        FROM movimientos GROUP BY tipo_cristal ORDER BY tipo_cristal
    `);
    return result.rows.map(r => ({
        tipo: r.tipo_cristal,
        entradas: Number(r.entradas_m2),
        salidas: Number(r.salidas_m2),
        stock: Number(r.entradas_m2) - Number(r.salidas_m2)
    }));
}

// =====================================================
// HTTP SERVER
// =====================================================
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch(e) { resolve({}); }
        });
    });
}

function json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function parseQuery(url) {
    const idx = url.indexOf('?');
    if (idx === -1) return { path: url, query: {} };
    const qs = url.substring(idx + 1);
    const query = {};
    qs.split('&').forEach(p => {
        const [k, v] = p.split('=').map(decodeURIComponent);
        query[k] = v;
    });
    return { path: url.substring(0, idx), query };
}

function serveStatic(res, urlPath) {
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch(e) {
        res.writeHead(404);
        res.end('Not found');
    }
}

let dbReady = false;
let dbError = null;

initDB().then(() => {
    dbReady = true;
    console.log('Base de datos: PostgreSQL conectada');
}).catch(e => {
    dbError = e.message;
    console.error('DB Error:', e.message);
});

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (!dbReady && !dbError) { json(res, { error: 'Base de datos inicializando...' }, 503); return; }
    if (dbError) { json(res, { error: dbError }, 500); return; }

    const { path: urlPath, query: q } = parseQuery(req.url);

    // =====================================================
    // HEALTH
    // =====================================================
    if (urlPath === '/api/health') {
        json(res, { status: 'ok', version: '2.0.0-unificado', modules: ['sigma', 'inventario'] });
        return;
    }

    // =====================================================
    // AUTH (shared)
    // =====================================================
    if (urlPath === '/api/auth/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const user = await login(body.email, body.password);
        if (!user) return json(res, { error: 'Credenciales invalidas' }, 401);
        json(res, user);
        return;
    }
    if (urlPath === '/api/auth/registro' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
            const user = await register(body.nombre, body.email, body.password);
            json(res, user, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    // =====================================================
    // SIGMA ENDPOINTS (prefix /api/sigma/)
    // =====================================================
    if (urlPath.startsWith('/api/sigma/')) {
        const sigmaPath = urlPath.substring('/api/sigma/'.length);

        // Stats
        if (sigmaPath === 'stats/summary') {
            json(res, await getSigmaStats());
            return;
        }

        // Export / Import / Reset / Clear
        if (sigmaPath === 'export') {
            json(res, await exportJSON());
            return;
        }
        if (sigmaPath === 'reset' && req.method === 'POST') {
            await seedSigma();
            json(res, { success: true });
            return;
        }
        if (sigmaPath === 'clear' && req.method === 'POST') {
            await clearAllSigma();
            json(res, { success: true });
            return;
        }
        if (sigmaPath === 'import' && req.method === 'POST') {
            const body = await parseBody(req);
            await importJSON(body);
            json(res, { success: true });
            return;
        }

        // Components by type
        const compByTypeMatch = sigmaPath.match(/^components\/by-type\/(\d+)$/);
        if (compByTypeMatch) {
            json(res, await getComponentsByType(Number(compByTypeMatch[1])));
            return;
        }

        // Machine details
        const machineDetailMatch = sigmaPath.match(/^machines\/(\d+)\/details$/);
        if (machineDetailMatch) {
            const d = await getMachineWithDetails(Number(machineDetailMatch[1]));
            if (!d) return json(res, { error: 'Not found' }, 404);
            json(res, d);
            return;
        }

        // Machine components (GET + PUT)
        const machineCompsMatch = sigmaPath.match(/^machines\/(\d+)\/components$/);
        if (machineCompsMatch) {
            const maquinaId = Number(machineCompsMatch[1]);
            if (req.method === 'GET') {
                try {
                    const result = await query('SELECT componente_id FROM machine_components WHERE maquina_id = $1', [maquinaId]);
                    json(res, result.rows.map(r => r.componente_id));
                } catch(e) {
                    json(res, []);
                }
                return;
            }
            if (req.method === 'PUT') {
                const body = await parseBody(req);
                const componentes = body.componentes || [];
                await query('DELETE FROM machine_components WHERE maquina_id = $1', [maquinaId]);
                for (const compId of componentes) {
                    await query('INSERT INTO machine_components (maquina_id, componente_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [maquinaId, compId]);
                }
                json(res, { success: true });
                return;
            }
        }

        // Reports
        const reportMatch = sigmaPath.match(/^reports\/(overdue|upcoming|completed|recent-completed|bitacora|by-period)$/);
        if (reportMatch) {
            const type = reportMatch[1];
            if (type === 'overdue') { json(res, await getOverdue()); return; }
            if (type === 'upcoming') { json(res, await getUpcoming(Number(q.days) || 15)); return; }
            if (type === 'completed') { json(res, await getCompleted()); return; }
            if (type === 'recent-completed') { json(res, await getRecentCompleted()); return; }
            if (type === 'bitacora') { json(res, await getBitacora()); return; }
            if (type === 'by-period') {
                if (!q.start || !q.end) return json(res, { error: 'start and end required' }, 400);
                json(res, await getByPeriod(q.start, q.end));
                return;
            }
        }

        // Generic CRUD for sigma tables
        const sigmaCrudMatch = sigmaPath.match(/^(\w+)(?:\/(\d+))?$/);
        if (sigmaCrudMatch && SIGMA_TABLES.includes(sigmaCrudMatch[1])) {
            const table = sigmaCrudMatch[1];
            const id = sigmaCrudMatch[2] ? Number(sigmaCrudMatch[2]) : null;
            try {
                if (req.method === 'GET' && !id) { json(res, await getAll(table)); return; }
                if (req.method === 'GET' && id) { const item = await getById(table, id); if (!item) return json(res, { error: 'Not found' }, 404); json(res, item); return; }
                if (req.method === 'POST' && !id) { const body = await parseBody(req); json(res, await insert(table, body), 201); return; }
                if (req.method === 'PUT' && id) { const body = await parseBody(req); const item = await update(table, id, body); if (!item) return json(res, { error: 'Not found' }, 404); json(res, item); return; }
                if (req.method === 'DELETE' && id) { const ok = await del(table, id); if (!ok) return json(res, { error: 'Not found' }, 404); json(res, { success: true }); return; }
            } catch(e) {
                if (e.code === '23505') {
                    const field = e.constraint?.includes('nombre') ? 'nombre' : 'campo';
                    json(res, { error: `Ya existe un registro con ese ${field}` }, 409);
                } else {
                    json(res, { error: e.message }, 500);
                }
                return;
            }
        }
    }

    // =====================================================
    // INVENTARIO ENDPOINTS (prefix /api/inv/)
    // =====================================================
    if (urlPath.startsWith('/api/inv/')) {
        const invPath = urlPath.substring('/api/inv/'.length);

        // Estadisticas
        if (invPath === 'estadisticas') {
            json(res, await getEstadisticas());
            return;
        }

        // Estadisticas por tipo
        if (invPath === 'estadisticas-por-tipo') {
            json(res, await getEstadisticasPorTipo());
            return;
        }

        // Tipos cristal
        if (invPath === 'tipos-cristal') {
            json(res, await getTiposCristal());
            return;
        }

        // Inventario (stock agrupado)
        if (invPath === 'inventario') {
            json(res, await getInventario(q));
            return;
        }

        // Movimientos
        if (invPath === 'movimientos') {
            if (req.method === 'GET') {
                json(res, await getMovimientos(q));
                return;
            }
            if (req.method === 'POST') {
                const body = await parseBody(req);
                try {
                    const mov = await crearMovimiento(body);
                    json(res, mov, 201);
                } catch(e) {
                    json(res, { error: e.message }, 400);
                }
                return;
            }
        }

        // Delete movimiento
        const movDeleteMatch = invPath.match(/^movimientos\/(\d+)$/);
        if (movDeleteMatch && req.method === 'DELETE') {
            const ok = await eliminarMovimiento(Number(movDeleteMatch[1]));
            if (!ok) return json(res, { error: 'No encontrado' }, 404);
            json(res, { success: true });
            return;
        }
    }

    // =====================================================
    // STATIC FILES
    // =====================================================
    serveStatic(res, urlPath);
});

    server.listen(PORT, '0.0.0.0', () => {
    console.log('========================================');
    console.log('  SISTEMA UNIFICADO');
    console.log(`  Servidor: http://localhost:${PORT}`);
    console.log('  Módulos: SIGMA + Control Inventario');
    console.log('  Base: PostgreSQL');
    console.log('  Admin: admin@vidrieria.com / admin123');
    console.log('========================================');
});
