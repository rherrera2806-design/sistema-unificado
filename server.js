const http = require('http');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sistema_unificado';

// =====================================================
// SEGURIDAD: Rate limiting en memoria
// =====================================================
const loginAttempts = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    loginAttempts.set(ip, recentAttempts);
    return recentAttempts.length < RATE_LIMIT_MAX;
}

function recordLoginAttempt(ip) {
    const attempts = loginAttempts.get(ip) || [];
    attempts.push(Date.now());
    loginAttempts.set(ip, attempts);
}

// =====================================================
// SEGURIDAD: Headers de seguridad
// =====================================================
function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:");
}

// =====================================================
// SEGURIDAD: Validación y sanitización de inputs
// =====================================================
function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>]/g, '').trim();
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

// =====================================================
// CONFIGURACIÓN
// =====================================================
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
    ssl: DATABASE_URL.includes('railway') || DATABASE_URL.includes('render') ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

async function query(text, params = []) {
    const result = await pool.query(text, params);
    return result;
}

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function logEvent(type, details) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${JSON.stringify(details)}`);
}

// =====================================================
// INICIALIZACIÓN DE BASE DE DATOS
// =====================================================
async function initDB() {
    // --- Usuarios ---
    await query(`CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'usuario',
        permisos TEXT[] DEFAULT '{}',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`DO $$ BEGIN ALTER TABLE usuarios ADD COLUMN permisos TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN null; END $$`);

    // --- CATÁLOGOS: Tipos de Cristal y Espesores ---
    await query(`CREATE TABLE IF NOT EXISTS catalogo_tipos_cristal (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS catalogo_espesores (
        id SERIAL PRIMARY KEY,
        valor INTEGER UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insertar valores por defecto si las tablas están vacías
    const tiposCount = await query('SELECT COUNT(*) as c FROM catalogo_tipos_cristal');
    if (Number(tiposCount.rows[0].c) === 0) {
        const tiposDefault = ['Clear', 'Bronce', 'Gris', 'Azul', 'Verde', 'Espejo', 'Templado', 'Laminado', 'Otros'];
        for (const tipo of tiposDefault) {
            await query('INSERT INTO catalogo_tipos_cristal (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [tipo]);
        }
    }

    const espesoresCount = await query('SELECT COUNT(*) as c FROM catalogo_espesores');
    if (Number(espesoresCount.rows[0].c) === 0) {
        const espesoresDefault = [3, 4, 5, 6, 8, 10, 12, 15, 19, 25];
        for (const esp of espesoresDefault) {
            await query('INSERT INTO catalogo_espesores (valor) VALUES ($1) ON CONFLICT DO NOTHING', [esp]);
        }
    }

    // --- SIGMA Tables ---
    await query(`CREATE TABLE IF NOT EXISTS machine_types (
        id SERIAL PRIMARY KEY, nombre TEXT NOT NULL
    )`);
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
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)');

    await query(`CREATE TABLE IF NOT EXISTS component_type_links (
        id SERIAL PRIMARY KEY, tipo_id INTEGER, componente_id INTEGER
    )`);
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

    await query(`CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        numero INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'espera',
        fecha DATE DEFAULT CURRENT_DATE,
        hora_creacion TIME DEFAULT CURRENT_TIME,
        hora_llamada TIME,
        hora_fin TIME
    )`);

    await query(`CREATE TABLE IF NOT EXISTS entregas (
        id SERIAL PRIMARY KEY,
        turno_id INTEGER REFERENCES turnos(id),
        cliente_nombre VARCHAR(100) NOT NULL,
        descripcion TEXT,
        pedidos TEXT,
        factura VARCHAR(50),
        tipo VARCHAR(30) DEFAULT 'Retira',
        estado VARCHAR(20) DEFAULT 'pendiente',
        fecha DATE DEFAULT CURRENT_DATE,
        hora_registrada TIME DEFAULT CURRENT_TIME,
        hora_entregada TIME
    )`);

    await query(`CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY,
        usuario_id INTEGER REFERENCES usuarios(id),
        tipo_movimiento VARCHAR(20) NOT NULL,
        tipo_cristal VARCHAR(50) NOT NULL,
        espesor INTEGER NOT NULL,
        ancho INTEGER NOT NULL,
        alto INTEGER NOT NULL,
        cantidad_planchas INTEGER NOT NULL,
        metros_cuadrados DECIMAL(10,4) NOT NULL,
        proveedor VARCHAR(100),
        tipo_salida VARCHAR(20),
        observaciones TEXT,
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // SEMILLA: Usuario admin
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vidrieria.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminCheck = await query("SELECT id FROM usuarios WHERE email = $1", [adminEmail]);
    if (adminCheck.rows.length === 0) {
        await query(
            "INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5)",
            ['Administrador', adminEmail, hashPassword(adminPassword), 'admin', ['sigma','inventario','turnos','usuarios']]
        );
    }

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

        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [1, 'Rodamiento', 'Rodamiento de bolas o rodillos']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [2, 'Correa', 'Correa de transmisión']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [3, 'Polea', 'Polea para transmisión por correa']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [4, 'Motor Eléctrico', 'Motor de inducción trifásico']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [5, 'Filtro', 'Filtro de aire o aceite']);

        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [1, 'ROD-001','Rodamiento SKF 6205-2Z',1,25,10,'SKF Chile','Estante A-12']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [2, 'COR-001','Correa trapezoidal B-85',2,8,5,'Gates','Estante B-03']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [3, 'FIL-001','Filtro de aceite P-5510',5,3,10,'Donaldson','Estante C-07']);

        await query('COMMIT');
    } catch(e) { await query('ROLLBACK'); throw e; }
}

// =====================================================
// FUNCIONES CRUD GENÉRICAS
// =====================================================
function validateSigmaTable(table) {
    if (!SIGMA_TABLES.includes(table)) throw new Error('Tabla inválida: ' + table);
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
// FUNCIONES DE CATÁLOGOS (TIPOS CRISTAL Y ESPESORES)
// =====================================================
async function getTiposCristal() {
    const result = await query('SELECT * FROM catalogo_tipos_cristal WHERE activo = TRUE ORDER BY nombre');
    return result.rows;
}

async function crearTipoCristal(nombre) {
    const sanitized = sanitizeString(nombre);
    if (!sanitized) throw new Error('Nombre requerido');
    const exists = await query('SELECT id FROM catalogo_tipos_cristal WHERE nombre = $1', [sanitized]);
    if (exists.rows.length > 0) throw new Error('El tipo de cristal ya existe');
    const result = await query('INSERT INTO catalogo_tipos_cristal (nombre) VALUES ($1) RETURNING *', [sanitized]);
    return result.rows[0];
}

async function eliminarTipoCristal(id) {
    // Soft delete - marcar como inactivo
    const result = await query('UPDATE catalogo_tipos_cristal SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
}

async function getEspesores() {
    const result = await query('SELECT * FROM catalogo_espesores WHERE activo = TRUE ORDER BY valor');
    return result.rows;
}

async function crearEspesor(valor) {
    const val = parseInt(valor);
    if (isNaN(val) || val <= 0) throw new Error('Valor de espesor inválido');
    const exists = await query('SELECT id FROM catalogo_espesores WHERE valor = $1', [val]);
    if (exists.rows.length > 0) throw new Error('El espesor ya existe');
    const result = await query('INSERT INTO catalogo_espesores (valor) VALUES ($1) RETURNING *', [val]);
    return result.rows[0];
}

async function eliminarEspesor(id) {
    const result = await query('UPDATE catalogo_espesores SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
}

// =====================================================
// FUNCIONES DE INVENTARIO
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
    
    // Validar que dimensiones sean enteros
    const anchoInt = parseInt(ancho);
    const altoInt = parseInt(alto);
    
    if (isNaN(anchoInt) || anchoInt <= 0) throw new Error('Ancho debe ser un número entero positivo');
    if (isNaN(altoInt) || altoInt <= 0) throw new Error('Alto debe ser un número entero positivo');
    
    const metros_cuadrados = (anchoInt * altoInt * cantidad_planchas) / 1000000;
    const result = await query(
        `INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, tipo_salida, observaciones, fecha_hora)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [usuario_id || null, tipo_movimiento, tipo_cristal, espesor, anchoInt, altoInt, cantidad_planchas, metros_cuadrados.toFixed(4), proveedor || null, tipo_salida || null, observaciones || null, fecha_hora || new Date().toISOString()]
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
// FUNCIONES DE AUTENTICACIÓN
// =====================================================
async function login(email, password) {
    const result = await query("SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    if (user.password !== hashPassword(password)) return null;
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, permisos: Array.isArray(user.permisos) ? user.permisos : [] };
}

// =====================================================
// FUNCIONES SIGMA
// =====================================================
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

// =====================================================
// FUNCIONES TURNOS
// =====================================================
async function getTurnoActual() {
    const hoy = new Date().toISOString().split('T')[0];
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1', [hoy, 'atendiendo']);
    return result.rows[0] || null;
}

async function getCola() {
    const hoy = new Date().toISOString().split('T')[0];
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero ASC', [hoy, 'espera']);
    return result.rows;
}

async function getTurnosStats() {
    const hoy = new Date().toISOString().split('T')[0];
    const [totalR, atendidosR, enColaR] = await Promise.all([
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1', [hoy]),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado IN ($2, $3, $4)', [hoy, 'atendido', 'derivado', 'entregado']),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado = $2', [hoy, 'espera'])
    ]);
    return {
        total: Number(totalR.rows[0].n),
        atendidos: Number(atendidosR.rows[0].n),
        enCola: Number(enColaR.rows[0].n),
        actual: await getTurnoActual()
    };
}

// =====================================================
// SERVIDOR HTTP
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
        res.end('No encontrado');
    }
}

let dbReady = false;
let dbError = null;

initDB().then(() => {
    dbReady = true;
    console.log('Base de datos: PostgreSQL conectada');
}).catch(e => {
    dbError = e.message;
    console.error('Error DB:', e.message);
});

const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
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
        json(res, { status: 'ok', version: '3.2.0', modules: ['sigma', 'inventario', 'turnos'] });
        return;
    }

    // =====================================================
    // AUTH
    // =====================================================
    if (urlPath === '/api/auth/login' && req.method === 'POST') {
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (!checkRateLimit(clientIp)) {
            json(res, { error: 'Demasiados intentos. Intenta en 15 minutos.' }, 429);
            return;
        }
        const body = await parseBody(req);
        const email = sanitizeString(body.email);
        const password = body.password;
        if (!email || !password) { json(res, { error: 'Email y contraseña requeridos' }, 400); return; }
        recordLoginAttempt(clientIp);
        const user = await login(email, password);
        if (!user) { json(res, { error: 'Credenciales inválidas' }, 401); return; }
        json(res, user);
        return;
    }

    // =====================================================
    // CATÁLOGOS: TIPOS DE CRISTAL
    // =====================================================
    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'GET') {
        json(res, await getTiposCristal());
        return;
    }

    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
            const item = await crearTipoCristal(body.nombre);
            json(res, item, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    const tipoCristalMatch = urlPath.match(/^\/api\/catalogos\/tipos-cristal\/(\d+)$/);
    if (tipoCristalMatch && req.method === 'DELETE') {
        const id = Number(tipoCristalMatch[1]);
        const item = await eliminarTipoCristal(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404);
        json(res, { ok: true, item });
        return;
    }

    // =====================================================
    // CATÁLOGOS: ESPESORES
    // =====================================================
    if (urlPath === '/api/catalogos/espesores' && req.method === 'GET') {
        json(res, await getEspesores());
        return;
    }

    if (urlPath === '/api/catalogos/espesores' && req.method === 'POST') {
        const body = await parseBody(req);
        try {
            const item = await crearEspesor(body.valor);
            json(res, item, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    const espesorMatch = urlPath.match(/^\/api\/catalogos\/espesores\/(\d+)$/);
    if (espesorMatch && req.method === 'DELETE') {
        const id = Number(espesorMatch[1]);
        const item = await eliminarEspesor(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404);
        json(res, { ok: true, item });
        return;
    }

    // =====================================================
    // INVENTARIO
    // =====================================================
    if (urlPath === '/api/inv/movimientos' && req.method === 'GET') {
        json(res, await getMovimientos(q));
        return;
    }

    if (urlPath === '/api/inv/movimientos' && req.method === 'POST') {
        const body = await parseBody(req);
        const sanitized = sanitizeObject(body);
        try {
            const created = await crearMovimiento(sanitized);
            json(res, created, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    const movMatch = urlPath.match(/^\/api\/inv\/movimientos\/(\d+)$/);
    if (movMatch && req.method === 'DELETE') {
        const id = Number(movMatch[1]);
        await eliminarMovimiento(id);
        json(res, { ok: true });
        return;
    }

    if (urlPath === '/api/inv/inventario' && req.method === 'GET') {
        json(res, await getInventario(q));
        return;
    }

    if (urlPath === '/api/inv/estadisticas' && req.method === 'GET') {
        json(res, await getEstadisticas());
        return;
    }

    if (urlPath === '/api/inv/estadisticas-por-tipo' && req.method === 'GET') {
        json(res, await getEstadisticasPorTipo());
        return;
    }

    // =====================================================
    // SIGMA
    // =====================================================
    if (urlPath === '/api/sigma/stats' && req.method === 'GET') {
        json(res, await getSigmaStats());
        return;
    }

    if (urlPath === '/api/sigma/export' && req.method === 'GET') {
        json(res, await exportJSON());
        return;
    }

    if (urlPath === '/api/sigma/import' && req.method === 'POST') {
        const body = await parseBody(req);
        await importJSON(body.data || body);
        json(res, { ok: true });
        return;
    }

    if (urlPath === '/api/sigma/clear' && req.method === 'POST') {
        await clearAllSigma();
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // TURNOS
    // =====================================================
    if (urlPath === '/api/turnos/estado' && req.method === 'GET') {
        json(res, await getTurnosStats());
        return;
    }

    if (urlPath === '/api/turnos/crear' && req.method === 'POST') {
        const body = await parseBody(req);
        const nombre = sanitizeString(body.nombre);
        if (!nombre) return json(res, { error: 'Nombre requerido' }, 400);
        const hoy = new Date().toISOString().split('T')[0];
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const numRow = await query('SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM turnos WHERE fecha = $1', [hoy]);
        const numero = numRow.rows[0].next;
        const result = await query(
            'INSERT INTO turnos (nombre, numero, fecha, hora_creacion) VALUES ($1, $2, $3, $4) RETURNING *',
            [nombre, numero, hoy, hora]
        );
        json(res, result.rows[0], 201);
        return;
    }

    if (urlPath === '/api/turnos/siguiente' && req.method === 'POST') {
        const hoy = new Date().toISOString().split('T')[0];
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const actual = (await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1', [hoy, 'atendiendo'])).rows[0];
        if (actual) {
            await query('UPDATE turnos SET estado = $1, hora_fin = $2 WHERE id = $3', ['atendido', hora, actual.id]);
        }
        const siguiente = (await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero ASC LIMIT 1', [hoy, 'espera'])).rows[0];
        if (!siguiente) return json(res, { error: 'No hay turnos en espera' }, 400);
        await query('UPDATE turnos SET estado = $1, hora_llamada = $2 WHERE id = $3', ['atendiendo', hora, siguiente.id]);
        json(res, { llamado: siguiente, ...await getTurnosStats() });
        return;
    }

    if (urlPath === '/api/turnos/cola' && req.method === 'GET') {
        json(res, await getCola());
        return;
    }

    // =====================================================
    // ADMIN
    // =====================================================
    if (urlPath === '/api/admin/usuarios' && req.method === 'GET') {
        const result = await query("SELECT id, nombre, email, rol, permisos, activo FROM usuarios ORDER BY id");
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/admin/usuarios' && req.method === 'POST') {
        const body = await parseBody(req);
        const { nombre, email, password, rol, permisos } = body;
        if (!nombre || !email || !password) {
            json(res, { error: 'Nombre, email y contraseña requeridos' }, 400);
            return;
        }
        try {
            const exists = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
            if (exists.rows.length > 0) {
                json(res, { error: 'El email ya está registrado' }, 400);
                return;
            }
            const result = await query(
                "INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol, permisos",
                [nombre, email, hashPassword(password), rol || 'usuario', permisos || []]
            );
            json(res, result.rows[0], 201);
        } catch(e) {
            json(res, { error: 'Error al crear usuario' }, 500);
        }
        return;
    }

    // =====================================================
    // ARCHIVOS ESTÁTICOS
    // =====================================================
    serveStatic(res, urlPath);
});

const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
