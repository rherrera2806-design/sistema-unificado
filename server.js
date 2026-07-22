const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Pool } = require('pg');
const crypto = require('crypto');
const { Server } = require('socket.io');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/sistema_unificado';

// =====================================================
// CLOUDFLARE R2 CONFIGURATION
// =====================================================
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ordenes-venta';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-d70f793c9dc24a3fa46ef91fb4e0a45a.r2.dev';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function r2Sign(key, method, payloadHash) {
    const crypto = require('crypto');
    const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const canonicalUri = '/' + key.split('/').map(p => encodeURIComponent(p)).join('/');
    const canonicalRequest = `${method}\n${canonicalUri}\n\nhost:${host}\n\nhost\n${payloadHash}`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`;
    const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    return {
        url: `https://${host}${canonicalUri}`,
        host,
        authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=host, Signature=${signature}`,
        amzDate,
        payloadHash,
    };
}

function r2CurlUpload(key, fileBuffer) {
    return new Promise((resolve, reject) => {
        const crypto = require('crypto');
        const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const signed = r2Sign(key, 'PUT', payloadHash);
        const tmpFile = path.join('/tmp', `r2_${Date.now()}.pdf`);
        fs.writeFileSync(tmpFile, fileBuffer);
        const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 30 --max-time 120 -k -X PUT -H 'Host: ${signed.host}' -H 'Content-Type: application/pdf' -H 'x-amz-content-sha256: ${signed.payloadHash}' -H 'x-amz-date: ${signed.amzDate}' -H 'Authorization: ${signed.authorization}' --data-binary @'${tmpFile}' '${signed.url}'`;
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpFile); } catch(e) {}
            const status = parseInt((stdout || '').trim()) || 0;
            console.log('[R2] Curl exit:', err ? err.code : 'ok', 'status:', status, 'stderr:', (stderr || '').substring(0, 200));
            if (status >= 200 && status < 300) {
                resolve({ ok: true, status });
            } else if (err && status === 0) {
                reject(new Error('Curl fallo: ' + (stderr || err.message).substring(0, 100)));
            } else {
                reject(new Error('R2 respondio HTTP ' + status));
            }
        });
    });
}

function r2CurlDelete(key) {
    return new Promise((resolve) => {
        const crypto = require('crypto');
        const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const signed = r2Sign(key, 'DELETE', payloadHash);
        const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 30 -k -X DELETE -H 'Host: ${signed.host}' -H 'x-amz-content-sha256: ${signed.payloadHash}' -H 'x-amz-date: ${signed.amzDate}' -H 'Authorization: ${signed.authorization}' '${signed.url}'`;
        exec(cmd, { timeout: 30000 }, (err, stdout) => {
            try { resolve(parseInt((stdout || '').trim()) < 300); } catch(e) { resolve(false); }
        });
    });
}

async function r2Delete(key) {
    if (!R2_ACCESS_KEY_ID) return false;
    try { return await r2CurlDelete(key); }
    catch(e) { console.error('[R2] Delete error:', e.message); return false; }
}

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

const globalRequests = new Map();
const GLOBAL_RATE_MAX = 100;
const GLOBAL_RATE_WINDOW = 60 * 1000;

function checkGlobalRateLimit(ip) {
    const now = Date.now();
    const requests = globalRequests.get(ip) || [];
    const recent = requests.filter(t => now - t < GLOBAL_RATE_WINDOW);
    globalRequests.set(ip, recent);
    return recent.length < GLOBAL_RATE_MAX;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of globalRequests) {
        const recent = requests.filter(t => now - t < GLOBAL_RATE_WINDOW);
        if (recent.length === 0) globalRequests.delete(ip);
        else globalRequests.set(ip, recent);
    }
}, 5 * 60 * 1000);

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

const SIGMA_TABLES = ['machine_types', 'machines', 'components', 'component_type_links', 'spare_parts', 'preventive_maintenance', 'corrective_maintenance', 'machine_components', 'notas', 'pedidos'];

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

const bcrypt = require('bcryptjs');
const BCRYPT_ROUNDS = 12;

function hashPassword(password) {
    return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function verifyPassword(password, hash) {
    if (!hash) return false;
    if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
        const sha256 = crypto.createHash('sha256').update(password).digest('hex');
        if (sha256 === hash) {
            const newHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
            return { migrated: true, newHash };
        }
        return false;
    }
    return bcrypt.compareSync(password, hash);
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
        nombre VARCHAR(100) NOT NULL,
        espesor INTEGER NOT NULL DEFAULT 0,
        codigo_sap VARCHAR(50) DEFAULT '',
        stock_critico INTEGER DEFAULT 0,
        consumo_mensual_aprox INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Migracion: agregar columnas nuevas si no existen
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS espesor INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS codigo_sap VARCHAR(50) DEFAULT ''").catch(() => {});
    // Migracion: cambiar tipo de columna consumo_mensual_aprox a INTEGER
    await query("ALTER TABLE catalogo_tipos_cristal ALTER COLUMN consumo_mensual_aprox TYPE INTEGER USING consumo_mensual_aprox::INTEGER").catch(() => {});
    // Migracion: eliminar todos los constraints UNIQUE viejos
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_key"); } catch(e) { console.log('Drop constraint nombre_key:', e.message); }
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_espesor_key"); } catch(e) { console.log('Drop constraint nombre_espesor_key:', e.message); }
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_espesor_key, catalogo_tipos_cristal_nombre_key"); } catch(e) {}
    // Crear indice unico parcial: solo aplica a registros activos
    await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_cristal_nombre_espesor ON catalogo_tipos_cristal (nombre, espesor) WHERE activo = TRUE").catch(() => {});

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

    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_fecha ON preventive_maintenance(fecha_programada)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_estado ON preventive_maintenance(estado)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_maquina ON preventive_maintenance(maquina_id)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_fecha ON corrective_maintenance(fecha_falla)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_estado ON corrective_maintenance(estado)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_maquina ON corrective_maintenance(maquina_id)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_machines_codigo ON machines(codigo)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)'); } catch(e) {}

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
    try { await query("ALTER TABLE notas ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT FALSE"); } catch(e) { }
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

    await query(`CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY,
        numero_pedido TEXT NOT NULL,
        cliente TEXT NOT NULL,
        vendedor TEXT NOT NULL,
        archivo_url TEXT,
        archivo_pdf BYTEA,
        estado TEXT DEFAULT 'pendiente',
        motivo_rechazo TEXT,
        fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_revision TIMESTAMP,
        revisado_por TEXT
    )`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='archivo_pdf') THEN ALTER TABLE pedidos ADD COLUMN archivo_pdf BYTEA; END IF; END $$`);

    // =====================================================
    // TABLAS DE PRODUCCION
    // =====================================================
    await query(`CREATE TABLE IF NOT EXISTS produccion_maquinas (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(20) UNIQUE NOT NULL,
        estado VARCHAR(20) DEFAULT 'ACTIVA',
        capacidad_max_m2_dia DECIMAL(8,2) DEFAULT 0,
        tipo_proceso VARCHAR(50),
        num_operacion INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS tipo_proceso VARCHAR(50)`);
    await query(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS num_operacion INTEGER`);

    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(30) DEFAULT 'Normal'`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS pintado BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS perforaciones INTEGER DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cerrado_nota TEXT`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`);

    await query(`CREATE TABLE IF NOT EXISTS produccion_recetas_bom (
        id SERIAL PRIMARY KEY,
        codigo_sap_padre VARCHAR(30) NOT NULL,
        codigo_materia_prima VARCHAR(30) NOT NULL,
        descripcion TEXT,
        espesor INTEGER,
        cantidad INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS produccion_ordenes (
        id SERIAL PRIMARY KEY,
        pedido_sap_id VARCHAR(30),
        cliente TEXT,
        codigo_producto VARCHAR(30) NOT NULL,
        descripcion TEXT,
        ancho INTEGER NOT NULL,
        alto INTEGER NOT NULL,
        metros_cuadrados DECIMAL(10,4),
        es_compuesto BOOLEAN DEFAULT FALSE,
        bom_padre_id INTEGER,
        fecha_ingreso_sap TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega_pactada DATE,
        estado_programacion VARCHAR(20) DEFAULT 'PENDIENTE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_nombre VARCHAR(50) NOT NULL,
        orden_secuencia INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        hora_inicio TIMESTAMP,
        hora_fin TIMESTAMP,
        operario_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await query(`CREATE TABLE IF NOT EXISTS produccion_codigos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(30) UNIQUE NOT NULL,
        descripcion TEXT,
        grupo VARCHAR(100),
        familia VARCHAR(100),
        bloqueo_tela BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    try { await query(`ALTER TABLE produccion_codigos ADD COLUMN IF NOT EXISTS bloqueo_tela BOOLEAN DEFAULT FALSE`); } catch(e) {}
    try { await query(`ALTER TABLE produccion_codigos RENAME COLUMN bloque_tela TO bloqueo_tela`); } catch(e) {}
    try {
        await query(`DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_codigos' AND column_name='bloqueo_tela' AND data_type='character varying') THEN
                UPDATE produccion_codigos SET bloqueo_tela = CASE WHEN bloqueo_tela IN ('si','s','1','true','Si','SI') THEN 'true'::boolean ELSE 'false'::boolean END;
                ALTER TABLE produccion_codigos ALTER COLUMN bloqueo_tela TYPE BOOLEAN USING bloqueo_tela::text::boolean;
            END IF;
        END $$`);
    } catch(e) {}

    // =====================================================
    // MÓDULO DE PRODUCCIÓN - Nueva Arquitectura
    // Estaciones Maestras, Familias, Materias Primas, Recetas
    // =====================================================

    // TABLA MAESTRA 1: Estaciones de la planta (secuencia obligatoria)
    await query(`CREATE TABLE IF NOT EXISTS estaciones_maestras (
        id SERIAL PRIMARY KEY,
        nombre_estacion VARCHAR(50) UNIQUE NOT NULL,
        orden_secuencia_defecto INTEGER UNIQUE NOT NULL,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA MAESTRA 2: Familias de producto
    await query(`CREATE TABLE IF NOT EXISTS familias_producto (
        id SERIAL PRIMARY KEY,
        codigo_familia VARCHAR(30) UNIQUE NOT NULL,
        nombre_familia VARCHAR(100) NOT NULL,
        costo_hh DECIMAL(12,2) DEFAULT 0,
        costo_energia DECIMAL(12,2) DEFAULT 0,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA INTERMEDIA: Estaciones base por familia
    await query(`CREATE TABLE IF NOT EXISTS familia_estaciones_base (
        id SERIAL PRIMARY KEY,
        familia_id INTEGER NOT NULL REFERENCES familias_producto(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        UNIQUE(familia_id, estacion_id)
    )`);

    // TABLA MAESTRA 3: Materias primas (vidrios)
    await query(`CREATE TABLE IF NOT EXISTS materias_primas (
        id SERIAL PRIMARY KEY,
        codigo_mp VARCHAR(30) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL,
        espesor_mm DECIMAL(6,2) DEFAULT 0,
        costo_unitario_mp DECIMAL(12,2) DEFAULT 0,
        observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA DE RECETAS BOM: Explosión de materiales
    await query(`CREATE TABLE IF NOT EXISTS recetas_bom (
        id SERIAL PRIMARY KEY,
        codigo_sap_padre VARCHAR(30) NOT NULL,
        materia_prima_id INTEGER NOT NULL REFERENCES materias_primas(id) ON DELETE CASCADE,
        cantidad DECIMAL(10,4) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_recetas_bom_padre ON recetas_bom(codigo_sap_padre)`);

    // TABLA: Reglas de procesos extras (banderas del Excel)
    await query(`CREATE TABLE IF NOT EXISTS reglas_procesos_extras (
        id SERIAL PRIMARY KEY,
        nombre_flag VARCHAR(50) UNIQUE NOT NULL,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // TABLA: Cola de producción con enrutamiento dinámico
    await query(`CREATE TABLE IF NOT EXISTS cola_produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id),
        orden_secuencia INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'PENDIENTE',
        hora_inicio TIMESTAMP,
        hora_fin TIMESTAMP,
        operario_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cola_pasos_orden ON cola_produccion_pasos(orden_produccion_id)`);

    // Columnas nuevas en produccion_ordenes para costos
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_hh DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_energia DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_materia_prima DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_total_estimado DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS precio_unitario_sap DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS margen_estimado DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(50) DEFAULT 'Normal'`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER DEFAULT 1`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS codigo_padre VARCHAR(30)`);

    // SEMILLA: Estaciones maestras por defecto
    const estCount = await query('SELECT COUNT(*) as c FROM estaciones_maestras');
    if (Number(estCount.rows[0].c) === 0) {
        const estacionesDefault = [
            ['Corte', 1], ['Pulido', 2], ['Radio', 3], ['Mecanizado', 4],
            ['Ventana', 5], ['Pintado', 6], ['Templado', 7], ['Armado', 8]
        ];
        for (const [nombre, orden] of estacionesDefault) {
            await query('INSERT INTO estaciones_maestras (nombre_estacion, orden_secuencia_defecto) VALUES ($1, $2)', [nombre, orden]);
        }
        console.log('[PROD] Estaciones maestras creadas por defecto');
    }

    // SEMILLA: Reglas de procesos extras por defecto
    const regCount = await query('SELECT COUNT(*) as c FROM reglas_procesos_extras');
    if (Number(regCount.rows[0].c) === 0) {
        const reglasDefault = [
            ['radio', 'Radio'], ['pulido', 'Pulido'], ['mecanizado', 'Mecanizado'],
            ['ventana', 'Ventana'], ['pintado', 'Pintado']
        ];
        for (const [flag, estNombre] of reglasDefault) {
            const est = await query('SELECT id FROM estaciones_maestras WHERE nombre_estacion = $1', [estNombre]);
            if (est.rows.length > 0) {
                await query('INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2)', [flag, est.rows[0].id]);
            }
        }
        console.log('[PROD] Reglas de procesos extras creadas por defecto');
    }

    // SEMILLA: Familias de producto por defecto
    const famCount = await query('SELECT COUNT(*) as c FROM familias_producto');
    if (Number(famCount.rows[0].c) === 0) {
        const familiasDefault = [
            ['CRUDO_SP', 'Crudo sin pulir', 1500, 500],
            ['CRUDO_P', 'Crudo pulido', 2000, 600],
            ['TEMPLADO', 'Templado', 2500, 700],
            ['TERMO', 'Termopanel', 3000, 800],
            ['TERMO_TC1', 'Termopanel temp 1 cara', 3500, 850],
            ['TERMO_TC2', 'Termopanel temp 2 caras', 4000, 900],
            ['LAM_SP', 'Laminado sin pulir', 2200, 650],
            ['LAM_P', 'Laminado pulido', 2800, 750],
            ['CARROCERO', 'Carrocero', 3200, 800]
        ];
        for (const [codigo, nombre, hh, energia] of familiasDefault) {
            await query('INSERT INTO familias_producto (codigo_familia, nombre_familia, costo_hh, costo_energia) VALUES ($1, $2, $3, $4)', [codigo, nombre, hh, energia]);
        }
        console.log('[PROD] Familias de producto creadas por defecto');
    }

    // MIGRACIÓN: Copiar datos de produccion_recetas_bom (antigua) a recetas_bom (nueva)
    const rbCount = await query('SELECT COUNT(*) as c FROM recetas_bom');
    const prbCount = await query('SELECT COUNT(*) as c FROM produccion_recetas_bom');
    if (Number(rbCount.rows[0].c) === 0 && Number(prbCount.rows[0].c) > 0) {
        console.log('[PROD] Migrando recetas de produccion_recetas_bom a recetas_bom...');
        const oldRecetas = await query('SELECT DISTINCT codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad FROM produccion_recetas_bom');
        for (const r of oldRecetas.rows) {
            // Crear materia prima si no existe
            let mp = await query('SELECT id FROM materias_primas WHERE codigo_mp = $1', [r.codigo_materia_prima]);
            if (mp.rows.length === 0) {
                const mpResult = await query(
                    'INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm) VALUES ($1, $2, $3) RETURNING id',
                    [r.codigo_materia_prima, r.descripcion || r.codigo_materia_prima, r.espesor || 0]
                );
                mp = mpResult;
            }
            const mpId = mp.rows[0].id;
            await query(
                'INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
                [r.codigo_sap_padre, mpId, r.cantidad || 1]
            );
        }
        console.log('[PROD] Recetas migradas:', oldRecetas.rows.length);
    }

    // SEMILLA: Tabla de notas de produccion (personal por usuario)
    await query(`CREATE TABLE IF NOT EXISTS prod_notas (
        id SERIAL PRIMARY KEY,
        usuario_email VARCHAR(255) NOT NULL,
        nota TEXT NOT NULL,
        estado VARCHAR(20) DEFAULT 'pendiente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_completado TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // SEMILLA: Usuario admin — permisos jerárquicos completos
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vidrieria.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const ALL_PERMS = [
        'mantencion','dashboard','machineTypes','machines','components','preventive','corrective','calendar','notas','reports','history','bitacora',
        'inventario','inv_inventario','inv_movimientos','inv_historial','inv_catalogos',
        'atencion','turnos_recepcion','turnos_bodega','turnos_qr',
        'ventas','pedidos',
        'produccion','prod_ordenes','prod_maquinas','prod_recetas','prod_codigos','prod_notas','prod_config',
        'administracion','usuarios','pedidos.autorizar'
    ];
    const adminCheck = await query("SELECT id FROM usuarios WHERE email = $1", [adminEmail]);
    if (adminCheck.rows.length === 0) {
        await query(
            "INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5)",
            ['Administrador', adminEmail, hashPassword(adminPassword), 'admin', ALL_PERMS]
        );
    } else {
        // Backfill: asegurar que admin tenga todos los permisos jerárquicos
        try {
            for (const p of ALL_PERMS) {
                await query("UPDATE usuarios SET permisos = array_append(permisos, $1) WHERE rol = 'admin' AND NOT ($1 = ANY(permisos))", [p]);
            }
        } catch(e) {}
    }

    const mtCount = await query('SELECT COUNT(*) as c FROM machine_types');
    if (Number(mtCount.rows[0].c) === 0) await seedSigma();
    
    // Corregir secuencias de IDs
    await resetSequences();
}

async function resetSequences() {
    const tables = ['usuarios', 'machine_types', 'machines', 'components', 'component_type_links', 
                    'spare_parts', 'preventive_maintenance', 'corrective_maintenance', 
                    'machine_components', 'notas', 'turnos', 'entregas', 'movimientos', 'pedidos',
                    'catalogo_tipos_cristal', 'catalogo_espesores',
                    'produccion_maquinas', 'produccion_recetas_bom', 'produccion_ordenes', 'produccion_pasos', 'produccion_codigos', 'prod_notas'];
    for (const table of tables) {
        try {
            await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
        } catch(e) { /* tabla sin serial */ }
    }
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
    const result = await query('SELECT * FROM catalogo_tipos_cristal WHERE activo = TRUE ORDER BY espesor, nombre');
    return result.rows;
}

async function crearTipoCristal(data) {
    let nombre = sanitizeString(data.nombre || data);
    if (!nombre) throw new Error('Nombre requerido');
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    const espesor = parseInt(data.espesor) || 0;
    const exists = await query('SELECT id FROM catalogo_tipos_cristal WHERE nombre = $1 AND espesor = $2 AND activo = TRUE', [nombre, espesor]);
    if (exists.rows.length > 0) throw new Error('Ya existe este tipo de cristal con ese espesor');
    const codigoSap = sanitizeString(data.codigo_sap) || '';
    const stockCritico = parseInt(data.stock_critico) || 0;
    const consumoMensual = parseInt(data.consumo_mensual_aprox) || 0;
    const result = await query(
        'INSERT INTO catalogo_tipos_cristal (nombre, espesor, codigo_sap, stock_critico, consumo_mensual_aprox) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [nombre, espesor, codigoSap, stockCritico, consumoMensual]
    );
    return result.rows[0];
}

async function eliminarTipoCristal(id) {
    // Soft delete - marcar como inactivo
    const result = await query('UPDATE catalogo_tipos_cristal SET activo = FALSE WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
}

async function updateTipoCristal(id, data) {
    let nombre = sanitizeString(data.nombre || '');
    if (!nombre) throw new Error('Nombre requerido');
    nombre = nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
    const result = await query(
        'UPDATE catalogo_tipos_cristal SET nombre = $1, espesor = $2, codigo_sap = $3, stock_critico = $4, consumo_mensual_aprox = $5 WHERE id = $6 AND activo = TRUE RETURNING *',
        [data.nombre, parseInt(data.espesor) || 0, sanitizeString(data.codigo_sap) || '', parseInt(data.stock_critico) || 0, parseInt(data.consumo_mensual_aprox) || 0, id]
    );
    return result.rows[0] || null;
}

async function getStockPorTipo() {
    const result = await query(`
        SELECT tipo_cristal,
            SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad_planchas ELSE 0 END) -
            SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN cantidad_planchas ELSE 0 END) as stock_planca
        FROM movimientos
        GROUP BY tipo_cristal
        ORDER BY tipo_cristal
    `);
    return result.rows.map(r => ({ tipo: r.tipo_cristal, stock: Number(r.stock_planca) }));
}

async function getAutonomia() {
    const [stockResult, catalogoResult] = await Promise.all([
        query(`
            SELECT tipo_cristal, espesor,
                SUM(CASE WHEN tipo_movimiento = 'entrada' THEN cantidad_planchas ELSE 0 END) -
                SUM(CASE WHEN tipo_movimiento = 'salida' AND tipo_salida = 'plancha_completa' THEN cantidad_planchas ELSE 0 END) as stock_planca
            FROM movimientos
            GROUP BY tipo_cristal, espesor
        `),
        query("SELECT nombre, espesor, stock_critico, consumo_mensual_aprox FROM catalogo_tipos_cristal WHERE activo = TRUE")
    ]);

    const catalogoMap = {};
    catalogoResult.rows.forEach(c => { catalogoMap[`${c.nombre}_${c.espesor}`] = c; });

    const stockMap = {};
    stockResult.rows.forEach(s => { stockMap[`${s.tipo_cristal}_${s.espesor}`] = Number(s.stock_planca); });

    const allKeys = new Set([...Object.keys(stockMap), ...Object.keys(catalogoMap)]);

    return Array.from(allKeys).map(key => {
        const [nombre, espesor] = key.split('_');
        const stock = stockMap[key] || 0;
        const cat = catalogoMap[key] || {};
        const consumo = Number(cat.consumo_mensual_aprox) || 0;
        const critico = Number(cat.stock_critico) || 0;

        let autonomiaMeses = null;
        let autonomiaSemanas = null;
        let autonomiaDias = null;
        let estado = 'ok';

        if (stock <= 0) {
            estado = 'sin_stock';
        } else if (consumo <= 0) {
            estado = 'sin_datos';
        } else {
            autonomiaMeses = stock / consumo;
            autonomiaSemanas = Math.round(autonomiaMeses * 4.33 * 10) / 10;
            autonomiaDias = Math.round(autonomiaMeses * 30);
            if (stock <= critico) estado = 'critico';
            else if (autonomiaMeses <= 1) estado = 'advertencia';
        }

        return {
            tipo: nombre,
            espesor: Number(espesor),
            stock,
            consumoMensual: consumo,
            stockCritico: critico,
            autonomiaMeses: autonomiaMeses !== null ? Math.round(autonomiaMeses * 10) / 10 : null,
            autonomiaSemanas,
            autonomiaDias,
            estado
        };
    });
}

async function getAlertas() {
    const autonomia = await getAutonomia();
    return autonomia.filter(a => a.estado === 'critico' || a.estado === 'sin_stock');
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
    const verification = verifyPassword(password, user.password);
    if (!verification) return null;
    if (verification.migrated) {
        await query("UPDATE usuarios SET password = $1 WHERE id = $2", [verification.newHash, user.id]);
    }
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
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1', [hoy, 'atendiendo']);
    return result.rows[0] || null;
}

async function getCola() {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const result = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero ASC', [hoy, 'espera']);
    return result.rows;
}

async function getTurnosStats() {
    const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    const [totalR, atendidosR, enColaR, pendR] = await Promise.all([
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1', [hoy]),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado IN ($2, $3, $4)', [hoy, 'atendido', 'derivado', 'entregado']),
        query('SELECT COUNT(*) AS n FROM turnos WHERE fecha = $1 AND estado = $2', [hoy, 'espera']),
        query("SELECT COUNT(*) AS n FROM entregas WHERE fecha = $1 AND estado = 'pendiente'", [hoy])
    ]);
    return {
        total: Number(totalR.rows[0].n),
        atendidos: Number(atendidosR.rows[0].n),
        enCola: Number(enColaR.rows[0].n),
        pendientesBodega: Number(pendR.rows[0].n),
        actual: await getTurnoActual()
    };
}

// =====================================================
// SERVIDOR HTTP
// =====================================================
const MAX_BODY_SIZE = 10 * 1024 * 1024;

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch(e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
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

// Performance: Gzip compression helper
function compressAndSend(res, content, headers) {
    const acceptEncoding = res.req?.headers?.['accept-encoding'] || '';
    const textTypes = ['.html', '.css', '.js', '.json', '.svg'];
    const ext = headers['Content-Type'] ? '.' + headers['Content-Type'].split('/')[1]?.split(';')[0] : '';
    
    if (textTypes.some(t => headers['Content-Type']?.includes(t)) && acceptEncoding.includes('gzip')) {
        zlib.gzip(content, (err, compressed) => {
            if (!err && compressed.length < content.length) {
                headers['Content-Encoding'] = 'gzip';
                headers['Content-Length'] = compressed.length;
                res.writeHead(200, headers);
                res.end(compressed);
            } else {
                headers['Content-Length'] = content.length;
                res.writeHead(200, headers);
                res.end(content);
            }
        });
    } else {
        headers['Content-Length'] = content.length;
        res.writeHead(200, headers);
        res.end(content);
    }
}

function serveStatic(res, urlPath) {
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    
    // Performance: Cache headers based on file type
    const cacheHeaders = { 'Content-Type': contentType };
    if (ext === '.html') {
        cacheHeaders['Cache-Control'] = 'no-cache, must-revalidate';
    } else if (ext === '.css' || ext === '.js') {
        cacheHeaders['Cache-Control'] = 'public, max-age=86400, stale-while-revalidate=604800';
        cacheHeaders['ETag'] = `"${Date.now()}"`;
    } else if (['.png', '.jpg', '.svg', '.ico'].includes(ext)) {
        cacheHeaders['Cache-Control'] = 'public, max-age=31536000, immutable';
    }
    
    try {
        const content = fs.readFileSync(filePath);
        compressAndSend(res, content, cacheHeaders);
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

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://vitroflow.up.railway.app,https://sistema-unified-production.up.railway.app,http://localhost:3000').split(',').map(s => s.trim());

const server = http.createServer(async (req, res) => {
    setSecurityHeaders(res);
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Permisos, X-User-Email');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (req.url !== '/api/health' && req.url !== '/api/auth/login') {
        if (!checkGlobalRateLimit(clientIp)) {
            json(res, { error: 'Demasiadas peticiones. Espera 1 minuto.' }, 429);
            return;
        }
    }

    if (!dbReady && !dbError) { json(res, { error: 'Base de datos inicializando...' }, 503); return; }
    if (dbError) { json(res, { error: dbError }, 500); return; }

    const { path: urlPath, query: q } = parseQuery(req.url);

    // =====================================================
    // HEALTH
    // =====================================================
    if (urlPath === '/api/health') {
        json(res, { status: 'ok', version: '3.3.0', modules: ['sigma', 'inventario', 'turnos', 'pedidos'] });
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
            const item = await crearTipoCristal(body);
            json(res, item, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    const tipoCristalMatch = urlPath.match(/^\/api\/catalogos\/tipos-cristal\/(\d+)$/);
    if (tipoCristalMatch && req.method === 'PUT') {
        const id = Number(tipoCristalMatch[1]);
        const body = await parseBody(req);
        const item = await updateTipoCristal(id, body);
        if (!item) return json(res, { error: 'No encontrado' }, 404);
        json(res, item);
        return;
    }

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

    if (urlPath === '/api/inv/autonomia' && req.method === 'GET') {
        json(res, await getAutonomia());
        return;
    }

    if (urlPath === '/api/inv/alertas' && req.method === 'GET') {
        json(res, await getAlertas());
        return;
    }

    // SIGMA - Calendar data (single endpoint)
    if (urlPath === '/api/sigma/calendar-data' && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const month = parseInt(urlObj.searchParams.get('month')) || new Date().getMonth() + 1;
            const year = parseInt(urlObj.searchParams.get('year')) || new Date().getFullYear();
            const startDate = `${year}-${String(month).padStart(2,'0')}-01`;
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            const endDate = `${nextYear}-${String(nextMonth).padStart(2,'0')}-01`;

            const [preventivos, correctivos, maquinas, componentes] = await Promise.all([
                query(`SELECT id, maquina_id, componente_id, fecha_programada, fecha_ejecutada, estado FROM preventive_maintenance WHERE fecha_programada >= $1 AND fecha_programada < $2`, [startDate, endDate]),
                query(`SELECT id, maquina_id, componente_id, fecha_falla, estado FROM corrective_maintenance WHERE fecha_falla >= $1 AND fecha_falla < $2`, [startDate, endDate]),
                query('SELECT id, codigo, nombre FROM machines'),
                query('SELECT id, nombre FROM components')
            ]);
            json(res, {
                preventivos: preventivos.rows,
                correctivos: correctivos.rows,
                maquinas: maquinas.rows,
                componentes: componentes.rows
            });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // SIGMA - Dashboard data (single endpoint)
    if (urlPath === '/api/sigma/dashboard-data' && req.method === 'GET') {
        try {
            const [stats, preventivos, correctivos, maquinas, componentes] = await Promise.all([
                getSigmaStats(),
                query('SELECT * FROM preventive_maintenance ORDER BY id'),
                query('SELECT * FROM corrective_maintenance ORDER BY id'),
                query('SELECT * FROM machines ORDER BY id'),
                query('SELECT * FROM components ORDER BY id')
            ]);
            json(res, {
                stats,
                preventivos: preventivos.rows,
                correctivos: correctivos.rows,
                maquinas: maquinas.rows,
                componentes: componentes.rows
            });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // SIGMA - Preventive data (single endpoint for N+1 fix)
    if (urlPath === '/api/sigma/preventive-data' && req.method === 'GET') {
        try {
            const [preventivos, maquinas, componentes] = await Promise.all([
                query('SELECT * FROM preventive_maintenance ORDER BY id'),
                query('SELECT id, codigo, nombre, tipo_id FROM machines ORDER BY id'),
                query('SELECT id, nombre FROM components ORDER BY id')
            ]);
            json(res, {
                preventivos: preventivos.rows,
                maquinas: maquinas.rows,
                componentes: componentes.rows
            });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // SIGMA - Corrective data (single endpoint for N+1 fix)
    if (urlPath === '/api/sigma/corrective-data' && req.method === 'GET') {
        try {
            const [correctivos, maquinas, componentes] = await Promise.all([
                query('SELECT * FROM corrective_maintenance ORDER BY id'),
                query('SELECT id, codigo, nombre, tipo_id FROM machines ORDER BY id'),
                query('SELECT id, nombre FROM components ORDER BY id')
            ]);
            json(res, {
                correctivos: correctivos.rows,
                maquinas: maquinas.rows,
                componentes: componentes.rows
            });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // SIGMA - Machine types data (single endpoint for N+1 fix)
    if (urlPath === '/api/sigma/machine-types-data' && req.method === 'GET') {
        try {
            const [tipos, componentes, machineTypeLinks, maquinas] = await Promise.all([
                query('SELECT * FROM machine_types ORDER BY id'),
                query('SELECT id, nombre FROM components ORDER BY nombre'),
                query('SELECT * FROM component_type_links'),
                query('SELECT id, tipo_id FROM machines')
            ]);
            json(res, {
                tipos: tipos.rows,
                componentes: componentes.rows,
                links: machineTypeLinks.rows,
                maquinas: maquinas.rows
            });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // =====================================================
    // SIGMA - Stats
    // =====================================================
    if (urlPath === '/api/sigma/stats' && req.method === 'GET') {
        json(res, await getSigmaStats());
        return;
    }

    if (urlPath === '/api/sigma/stats/summary' && req.method === 'GET') {
        const [machines, completedPreventive, upcoming, overdue, failures, criticalParts, recentFailures] = await Promise.all([
            query('SELECT COUNT(*) as c FROM machines'),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE estado = 'Realizada'"),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada >= $1 AND fecha_programada <= $2 AND estado != 'Realizada'", [new Date().toISOString().split('T')[0], new Date(Date.now() + 15*24*60*60*1000).toISOString().split('T')[0]]),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada < $1 AND estado != 'Realizada'", [new Date().toISOString().split('T')[0]]),
            query('SELECT COUNT(*) as c FROM corrective_maintenance'),
            query('SELECT COUNT(*) as c FROM spare_parts WHERE stock_actual <= stock_minimo'),
            query('SELECT * FROM corrective_maintenance ORDER BY id DESC LIMIT 5')
        ]);
        const failuresReparadas = await query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado = 'Reparada' OR fecha_reparacion IS NOT NULL");
        const totalFailures = Number(failures.rows[0].c);
        const reparadas = Number(failuresReparadas.rows[0].c);
        json(res, {
            totalMachines: Number(machines.rows[0].c),
            completedMaintenance: Number(completedPreventive.rows[0].c),
            upcomingMaintenance: Number(upcoming.rows[0].c),
            overdueMaintenance: Number(overdue.rows[0].c),
            totalFailures: totalFailures,
            failuresReparadas: reparadas,
            failuresEnMantencion: totalFailures - reparadas,
            criticalSpareParts: Number(criticalParts.rows[0].c),
            recentFailures: recentFailures.rows
        });
        return;
    }

    // =====================================================
    // SIGMA - CRUD Generico para colecciones
    // =====================================================
    const sigmaCollectionMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)$/);
    if (sigmaCollectionMatch && req.method === 'GET') {
        const table = sigmaCollectionMatch[1];
        try {
            const data = await getAll(table);
            json(res, data);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    const sigmaByIdMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)\/(\d+)$/);
    if (sigmaByIdMatch && req.method === 'GET') {
        const table = sigmaByIdMatch[1];
        const id = Number(sigmaByIdMatch[2]);
        try {
            const item = await getById(table, id);
            if (!item) return json(res, { error: 'No encontrado' }, 404);
            json(res, item);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    if (sigmaCollectionMatch && req.method === 'POST') {
        const table = sigmaCollectionMatch[1];
        const body = await parseBody(req);
        try {
            const item = await insert(table, body);
            json(res, item, 201);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    if (sigmaByIdMatch && req.method === 'PUT') {
        const table = sigmaByIdMatch[1];
        const id = Number(sigmaByIdMatch[2]);
        const body = await parseBody(req);
        try {
            const item = await update(table, id, body);
            json(res, item);
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    if (sigmaByIdMatch && req.method === 'DELETE') {
        const table = sigmaByIdMatch[1];
        const id = Number(sigmaByIdMatch[2]);
        try {
            const ok = await del(table, id);
            if (!ok) return json(res, { error: 'No encontrado' }, 404);
            json(res, { ok: true });
        } catch(e) {
            json(res, { error: e.message }, 400);
        }
        return;
    }

    // =====================================================
    // SIGMA - Components by Type
    // =====================================================
    const compByTypeMatch = urlPath.match(/^\/api\/sigma\/components\/by-type\/(\d+)$/);
    if (compByTypeMatch && req.method === 'GET') {
        const tipoId = Number(compByTypeMatch[1]);
        const result = await query(
            `SELECT c.* FROM components c
             INNER JOIN component_type_links ctl ON c.id = ctl.componente_id
             WHERE ctl.tipo_id = $1 ORDER BY c.nombre`, [tipoId]
        );
        json(res, result.rows);
        return;
    }

    // =====================================================
    // SIGMA - Machine Details (with full history)
    // =====================================================
    const machineDetailsMatch = urlPath.match(/^\/api\/sigma\/machines\/(\d+)\/details$/);
    if (machineDetailsMatch && req.method === 'GET') {
        const id = Number(machineDetailsMatch[1]);
        const machineResult = await query('SELECT * FROM machines WHERE id = $1', [id]);
        if (machineResult.rows.length === 0) return json(res, { error: 'No encontrada' }, 404);
        const maquina = machineResult.rows[0];
        
        // Get machine type
        const tipoResult = maquina.tipo_id ? await query('SELECT * FROM machine_types WHERE id = $1', [maquina.tipo_id]) : { rows: [] };
        const tipo = tipoResult.rows[0] || null;
        
        // Get components
        const comps = await query(
            `SELECT c.* FROM components c
             INNER JOIN machine_components mc ON c.id = mc.componente_id
             WHERE mc.maquina_id = $1`, [id]
        );
        
        // Get preventive maintenance
        const preventivos = await query(
            `SELECT * FROM preventive_maintenance WHERE maquina_id = $1 ORDER BY fecha_programada DESC`, [id]
        );
        
        // Get corrective maintenance
        const correctivos = await query(
            `SELECT * FROM corrective_maintenance WHERE maquina_id = $1 ORDER BY fecha_falla DESC`, [id]
        );
        
        json(res, { 
            maquina, 
            tipo, 
            componentes: comps.rows, 
            preventivos: preventivos.rows, 
            correctivos: correctivos.rows 
        });
        return;
    }

    // =====================================================
    // SIGMA - Machine Components
    // =====================================================
    const machineCompsMatch = urlPath.match(/^\/api\/sigma\/machines\/(\d+)\/components$/);
    if (machineCompsMatch && req.method === 'GET') {
        const maquinaId = Number(machineCompsMatch[1]);
        const result = await query(
            `SELECT c.* FROM components c
             INNER JOIN machine_components mc ON c.id = mc.componente_id
             WHERE mc.maquina_id = $1 ORDER BY c.nombre`, [maquinaId]
        );
        json(res, result.rows);
        return;
    }

    if (machineCompsMatch && req.method === 'PUT') {
        const maquinaId = Number(machineCompsMatch[1]);
        const body = await parseBody(req);
        const componentes = body.componentes || [];
        await query('DELETE FROM machine_components WHERE maquina_id = $1', [maquinaId]);
        for (const compId of componentes) {
            await query('INSERT INTO machine_components (maquina_id, componente_id) VALUES ($1, $2)', [maquinaId, compId]);
        }
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // SIGMA - Reports
    // =====================================================
    if (urlPath === '/api/sigma/reports/overdue' && req.method === 'GET') {
        const result = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id
             WHERE pm.fecha_programada < $1 AND pm.estado != 'Realizada'
             ORDER BY pm.fecha_programada ASC`, [new Date().toISOString().split('T')[0]]
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/sigma/reports/upcoming' && req.method === 'GET') {
        const days = Number(q.days) || 15;
        const hoy = new Date().toISOString().split('T')[0];
        const futuro = new Date(Date.now() + days*24*60*60*1000).toISOString().split('T')[0];
        const result = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id
             WHERE pm.fecha_programada >= $1 AND pm.fecha_programada <= $2 AND pm.estado != 'Realizada'
             ORDER BY pm.fecha_programada ASC`, [hoy, futuro]
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/sigma/reports/completed' && req.method === 'GET') {
        const result = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id
             WHERE pm.estado = 'Realizada'
             ORDER BY pm.fecha_ejecutada DESC`
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/sigma/reports/recent-completed' && req.method === 'GET') {
        const result = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id
             WHERE pm.estado = 'Realizada' AND pm.fecha_ejecutada IS NOT NULL
             ORDER BY pm.fecha_ejecutada DESC LIMIT 5`
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/sigma/reports/by-period' && req.method === 'GET') {
        const start = q.start || '2000-01-01';
        const end = q.end || '2099-12-31';
        const result = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id
             WHERE pm.fecha_programada >= $1 AND pm.fecha_programada <= $2
             ORDER BY pm.fecha_programada ASC`, [start, end]
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/sigma/reports/bitacora' && req.method === 'GET') {
        // Combine preventive and corrective maintenance into unified bitacora
        const preventivos = await query(
            `SELECT pm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre,
                    'Preventiva' as tipo_mantencion,
                    pm.observaciones as detalle,
                    pm.tecnico,
                    pm.fecha_ejecutada,
                    pm.fecha_programada
             FROM preventive_maintenance pm
             LEFT JOIN machines m ON pm.maquina_id = m.id
             LEFT JOIN components c ON pm.componente_id = c.id`
        );
        
        const correctivos = await query(
            `SELECT cm.*, m.nombre as maquina_nombre, c.nombre as componente_nombre,
                    'Correctiva' as tipo_mantencion,
                    cm.descripcion_falla as detalle,
                    cm.responsable as tecnico,
                    cm.fecha_falla as fecha_ejecutada,
                    cm.fecha_falla as fecha_programada
             FROM corrective_maintenance cm
             LEFT JOIN machines m ON cm.maquina_id = m.id
             LEFT JOIN components c ON cm.componente_id = c.id`
        );
        
        // Combine and sort by date
        const all = [
            ...preventivos.rows.map(r => ({ ...r, tipo_mantencion: 'Preventiva' })),
            ...correctivos.rows.map(r => ({ ...r, tipo_mantencion: 'Correctiva' }))
        ].sort((a, b) => {
            const dateA = a.fecha_ejecutada || a.fecha_programada || '';
            const dateB = b.fecha_ejecutada || b.fecha_programada || '';
            return dateB.localeCompare(dateA);
        });
        
        json(res, all);
        return;
    }

    // =====================================================
    // SIGMA - Export / Import / Reset
    // =====================================================
    if (urlPath === '/api/sigma/export' && req.method === 'GET') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'Solo admin' }, 403); return;
        }
        json(res, await exportJSON());
        return;
    }

    if (urlPath === '/api/sigma/import' && req.method === 'POST') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'Solo admin' }, 403); return;
        }
        const body = await parseBody(req);
        await importJSON(body.data || body);
        json(res, { ok: true });
        return;
    }

    if (urlPath === '/api/sigma/clear' && req.method === 'POST') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'Solo admin' }, 403); return;
        }
        await clearAllSigma();
        json(res, { ok: true });
        return;
    }

    if (urlPath === '/api/sigma/reset' && req.method === 'POST') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'Solo admin' }, 403); return;
        }
        await clearAllSigma();
        json(res, { ok: true, message: 'Base de datos reiniciada' });
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
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
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
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
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
    // TURNOS - Historial del día
    // =====================================================
    if (urlPath === '/api/turnos/historial' && req.method === 'GET') {
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const result = await query(
            `SELECT t.*, e.estado as entrega_estado, e.pedidos, e.factura, e.tipo,
                    e.hora_registrada as bodega_recibido, e.hora_entregada as bodega_entregado
             FROM turnos t
             LEFT JOIN entregas e ON t.id = e.turno_id
             WHERE t.fecha = $1 AND t.estado != 'espera'
             ORDER BY t.numero DESC`, [hoy]
        );
        const turnos = result.rows.map(t => {
            let espera_segundos = null, recepcion_segundos = null, bodega_segundos = null, total_segundos = null;
            const pad = s => { const p = s.split(':').map(Number); return p[0]*3600 + p[1]*60 + (p[2]||0); };
            if (t.hora_creacion && t.hora_llamada) espera_segundos = pad(t.hora_llamada) - pad(t.hora_creacion);
            if (t.hora_fin && t.hora_llamada) recepcion_segundos = pad(t.hora_fin) - pad(t.hora_llamada);
            if (t.bodega_recibido && t.bodega_entregado) bodega_segundos = pad(t.bodega_entregado) - pad(t.bodega_recibido);
            if (t.hora_creacion && t.bodega_entregado) total_segundos = pad(t.bodega_entregado) - pad(t.hora_creacion);
            else if (t.hora_creacion && t.hora_fin) total_segundos = pad(t.hora_fin) - pad(t.hora_creacion);
            return { ...t, espera_segundos, recepcion_segundos, bodega_segundos, total_segundos,
                     fecha_fmt: new Date(t.fecha).toLocaleDateString('es-CL') };
        });
        json(res, turnos);
        return;
    }

    // =====================================================
    // TURNOS - Ticket individual
    // =====================================================
    const turnoByIdMatch = urlPath.match(/^\/api\/turnos\/(\d+)$/);
    if (turnoByIdMatch && req.method === 'GET') {
        const id = Number(turnoByIdMatch[1]);
        const result = await query('SELECT * FROM turnos WHERE id = $1', [id]);
        if (result.rows.length === 0) return json(res, { error: 'No encontrado' }, 404);
        const turno = result.rows[0];
        const hoy = turno.fecha;
        const antes = await query('SELECT COUNT(*) as c FROM turnos WHERE fecha = $1 AND numero < $2 AND estado IN ($3, $4)', [hoy, turno.numero, 'espera', 'atendiendo']);
        const posicion = Number(antes.rows[0].c);
        const actualRes = await query('SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1', [hoy, 'atendiendo']);
        const actualNumero = actualRes.rows.length > 0 ? actualRes.rows[0].numero : null;
        const esSuTurno = actualNumero === turno.numero;
        const estimado = posicion * 5;
        json(res, { turno, posicion, estimado, esSuTurno, actualNumero });
        return;
    }

    // =====================================================
    // TURNOS - Derivar a bodega
    // =====================================================
    if (urlPath === '/api/turnos/derivar-bodega' && req.method === 'POST') {
        const body = await parseBody(req);
        const { turno_id, pedidos, factura } = body;
        if (!turno_id) return json(res, { error: 'turno_id requerido' }, 400);
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
        const pad = n => String(n).padStart(2, '0');
        const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        await query('UPDATE turnos SET estado = $1, hora_fin = $2 WHERE id = $3', ['derivado', hora, turno_id]);
        const turnoRes = await query('SELECT numero FROM turnos WHERE id = $1', [turno_id]);
        const numero = turnoRes.rows.length > 0 ? turnoRes.rows[0].numero : 0;
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        await query(
            'INSERT INTO entregas (turno_id, cliente_nombre, pedidos, factura, tipo, estado, fecha, hora_registrada) VALUES ($1, (SELECT nombre FROM turnos WHERE id=$2), $3, $4, $5, $6, $7, $8)',
            [turno_id, turno_id, pedidos || null, factura || null, 'Retira', 'pendiente', hoy, hora]
        );
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // TURNOS - QR
    // =====================================================
    if (urlPath === '/api/turnos/qr' && req.method === 'GET') {
        const QRCode = require('qrcode');
        const url = req.headers.host ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/turnos/?view=registro` : 'http://localhost:3000/turnos/?view=registro';
        try {
            const qrDataUrl = await QRCode.toDataURL(url, { width: 250, margin: 2 });
            json(res, { qr: qrDataUrl, url });
        } catch(e) {
            console.error('QR generation error:', e.message);
            json(res, { qr: '', url, error: e.message });
        }
        return;
    }

    // =====================================================
    // TURNOS - Entregas (Bodega)
    // =====================================================
    if (urlPath === '/api/turnos/entregas' && req.method === 'GET') {
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const result = await query(
            `SELECT e.*, t.numero as turno_numero
             FROM entregas e
             LEFT JOIN turnos t ON e.turno_id = t.id
             WHERE e.fecha = $1
             ORDER BY e.id DESC`, [hoy]
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/turnos/entregas/pendientes' && req.method === 'GET') {
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const result = await query(
            `SELECT e.*, t.numero as turno_numero
             FROM entregas e
             LEFT JOIN turnos t ON e.turno_id = t.id
             WHERE e.fecha = $1 AND e.estado = 'pendiente'
             ORDER BY e.id ASC`, [hoy]
        );
        json(res, result.rows);
        return;
    }

    if (urlPath === '/api/turnos/entregas/registrar' && req.method === 'POST') {
        const body = await parseBody(req);
        const { cliente_nombre, descripcion, tipo, pedidos, factura } = body;
        if (!cliente_nombre) return json(res, { error: 'Nombre requerido' }, 400);
        const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
        const pad = n => String(n).padStart(2, '0');
        const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        const result = await query(
            'INSERT INTO entregas (cliente_nombre, descripcion, tipo, pedidos, factura, estado, fecha, hora_registrada) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [cliente_nombre, descripcion || null, tipo || 'Retira', pedidos || null, factura || null, 'pendiente', hoy, hora]
        );
        json(res, result.rows[0], 201);
        return;
    }

    const entregaEntregarMatch = urlPath.match(/^\/api\/turnos\/entregas\/(\d+)\/entregar$/);
    if (entregaEntregarMatch && req.method === 'POST') {
        const id = Number(entregaEntregarMatch[1]);
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
        const pad = n => String(n).padStart(2, '0');
        const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
        await query('UPDATE entregas SET estado = $1, hora_entregada = $2 WHERE id = $3', ['entregado', hora, id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // TURNOS - Eliminar
    // =====================================================
    const eliminarTurnoMatch = urlPath.match(/^\/api\/turnos\/eliminar-turno\/(\d+)$/);
    if (eliminarTurnoMatch && req.method === 'DELETE') {
        const id = Number(eliminarTurnoMatch[1]);
        await query('DELETE FROM entregas WHERE turno_id = $1', [id]);
        await query('DELETE FROM turnos WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    const eliminarEntregaMatch = urlPath.match(/^\/api\/turnos\/eliminar-entrega\/(\d+)$/);
    if (eliminarEntregaMatch && req.method === 'DELETE') {
        const id = Number(eliminarEntregaMatch[1]);
        await query('DELETE FROM entregas WHERE id = $1', [id]);
        json(res, { ok: true });
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

    // ADMIN - Update user
    const updateUserMatch = urlPath.match(/^\/api\/admin\/usuarios\/(\d+)$/);
    if (updateUserMatch && req.method === 'PUT') {
        const id = Number(updateUserMatch[1]);
        const body = await parseBody(req);
        const { nombre, email, password, rol, permisos } = body;
        try {
            if (password) {
                await query('UPDATE usuarios SET nombre=$1, email=$2, password=$3, rol=$4, permisos=$5 WHERE id=$6', [nombre, email, hashPassword(password), rol, permisos || [], id]);
            } else {
                await query('UPDATE usuarios SET nombre=$1, email=$2, rol=$3, permisos=$4 WHERE id=$5', [nombre, email, rol, permisos || [], id]);
            }
            json(res, { ok: true });
        } catch(e) { json(res, { error: 'Error al actualizar' }, 500); }
        return;
    }

    // ADMIN - Delete user
    const deleteUserMatch = urlPath.match(/^\/api\/admin\/usuarios\/(\d+)$/);
    if (deleteUserMatch && req.method === 'DELETE') {
        const id = Number(deleteUserMatch[1]);
        await query('DELETE FROM usuarios WHERE id=$1 AND rol != $2', [id, 'admin']);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // PEDIDOS
    // =====================================================
    
    // Obtener todos los pedidos (filtrado por vendedor si no es admin/supervisor)
    if (urlPath === '/api/pedidos' && req.method === 'GET') {
        const userPerm = req.headers['x-user-permisos'] || '';
        const userEmail = req.headers['x-user-email'] || '';
        const esAdminOsupervisor = userPerm.includes('pedidos.autorizar') || userPerm.includes('usuarios');
        
        const joinQuery = `SELECT p.*, v.nombre AS vendedor_nombre, r.nombre AS revisor_nombre
            FROM pedidos p
            LEFT JOIN usuarios u ON u.email = p.vendedor
            LEFT JOIN usuarios v ON v.email = p.vendedor
            LEFT JOIN usuarios r ON r.email = p.revisado_por`;
        
        let result;
        if (esAdminOsupervisor) {
            result = await query(joinQuery + ' ORDER BY p.fecha_subida DESC');
        } else {
            result = await query(joinQuery + ' WHERE p.vendedor = $1 ORDER BY p.fecha_subida DESC', [userEmail]);
        }
        json(res, result.rows);
        return;
    }

    // Obtener un pedido por ID
    const pedidoByIdMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (pedidoByIdMatch && req.method === 'GET') {
        const id = Number(pedidoByIdMatch[1]);
        const result = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return; }
        json(res, result.rows[0]);
        return;
    }

    // Crear nuevo pedido
    if (urlPath === '/api/pedidos' && req.method === 'POST') {
        const body = await parseBody(req);
        const { numero_pedido, cliente, vendedor, archivo_url, pdf_base64 } = body;
        if (!numero_pedido || !cliente) {
            json(res, { error: 'Número de pedido y cliente son requeridos' }, 400);
            return;
        }
        let pdfBuffer = null;
        if (pdf_base64) {
            const base64Data = pdf_base64.replace(/^data:application\/pdf;base64,/, '');
            pdfBuffer = Buffer.from(base64Data, 'base64');
        }
        const result = await query(
            'INSERT INTO pedidos (numero_pedido, cliente, vendedor, archivo_url, archivo_pdf, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, numero_pedido, cliente, vendedor, archivo_url, estado, motivo_rechazo, fecha_subida, fecha_revision, revisado_por',
            [numero_pedido, cliente, vendedor || '', archivo_url || '', pdfBuffer, 'pendiente']
        );
        json(res, result.rows[0], 201);
        return;
    }

    // Descargar PDF de un pedido (sirve directo desde PostgreSQL)
    const pedidoPdfMatch = urlPath.match(/^\/api\/pedidos\/(\d+)\/pdf$/);
    if (pedidoPdfMatch && req.method === 'GET') {
        const id = Number(pedidoPdfMatch[1]);
        const result = await query('SELECT archivo_pdf, archivo_url, numero_pedido FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return; }
        const row = result.rows[0];
        if (row.archivo_pdf) {
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${row.numero_pedido}.pdf"`,
                'Cache-Control': 'public, max-age=3600'
            });
            res.end(row.archivo_pdf);
        } else if (row.archivo_url) {
            res.writeHead(302, { 'Location': row.archivo_url });
            res.end();
        } else {
            json(res, { error: 'PDF no disponible' }, 404);
        }
        return;
    }

    // Actualizar estado del pedido (autorizar/rechazar)
    const updatePedidoMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (updatePedidoMatch && req.method === 'PUT') {
        const id = Number(updatePedidoMatch[1]);
        const body = await parseBody(req);
        const { estado, motivo_rechazo, revisado_por } = body;
        
        if (!estado || !['aprobado', 'rechazado'].includes(estado)) {
            json(res, { error: 'Estado debe ser "aprobado" o "rechazado"' }, 400);
            return;
        }
        
        const result = await query(
            'UPDATE pedidos SET estado = $1, motivo_rechazo = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [estado, motivo_rechazo || null, revisado_por || '', id]
        );
        
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return; }
        json(res, result.rows[0]);
        return;
    }

    // Descargar PDF y limpiar de DB (al aprobar/rechazar)
    const pedidoDownloadMatch = urlPath.match(/^\/api\/pedidos\/(\d+)\/download-pdf$/);
    if (pedidoDownloadMatch && req.method === 'GET') {
        const id = Number(pedidoDownloadMatch[1]);
        const result = await query('SELECT archivo_pdf, numero_pedido FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return; }
        const row = result.rows[0];
        if (!row.archivo_pdf) { json(res, { error: 'PDF no disponible' }, 404); return; }
        const pdfBuffer = row.archivo_pdf;
        await query('UPDATE pedidos SET archivo_pdf = NULL WHERE id = $1', [id]);
        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${row.numero_pedido}.pdf"`,
            'Content-Length': pdfBuffer.length
        });
        res.end(pdfBuffer);
        return;
    }

    // Eliminar pedido (solo admin)
    const deletePedidoMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (deletePedidoMatch && req.method === 'DELETE') {
        const userPerms = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);
        if (!userPerms.includes('usuarios')) { json(res, { error: 'Sin permisos' }, 403); return; }
        const id = Number(deletePedidoMatch[1]);
        await query('DELETE FROM pedidos WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // R2 - SUBIR ARCHIVO
    // =====================================================
    if (urlPath === '/api/r2/upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) {
            json(res, { error: 'R2 no esta configurado en el servidor. Contacta al administrador.' }, 500);
            return;
        }
        const body = await parseBody(req);
        const { fileName, contentType } = body;
        
        if (!fileName) {
            json(res, { error: 'fileName es requerido' }, 400);
            return;
        }
        
        const key = `pedidos/${fileName}`;
        json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        return;
    }

    // =====================================================
    // R2 - SUBIR ARCHIVO (via curl + firma manual)
    // =====================================================
    if (urlPath === '/api/r2/direct-upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) {
            json(res, { error: 'R2 no esta configurado en el servidor. Contacta al administrador.' }, 500);
            return;
        }
        const body = await parseBody(req);
        const { fileName, contentType, fileBase64 } = body;
        if (!fileName || !fileBase64) {
            json(res, { error: 'fileName y fileBase64 son requeridos' }, 400);
            return;
        }
        try {
            const key = `pedidos/${fileName}`;
            const buffer = Buffer.from(fileBase64, 'base64');
            console.log('[R2] Upload attempt:', key, buffer.length, 'bytes');
            const result = await r2CurlUpload(key, buffer);
            console.log(`[R2] Archivo subido: ${key}`);
            json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        } catch(e) {
            console.error('[R2] Upload error:', e.message);
            json(res, { error: 'Error al subir archivo a almacenamiento' }, 500);
        }
        return;
    }

    // =====================================================
    // R2 - TEST DE CONEXION
    // =====================================================
    if (urlPath === '/api/r2/test' && req.method === 'GET') {
        try {
            const key = 'test-ping.txt';
            const signed = r2Sign(key, 'HEAD', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
            const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 20 -k -I -H 'Host: ${signed.host}' -H 'x-amz-date: ${signed.amzDate}' -H 'Authorization: ${signed.authorization}' '${signed.url}'`;
            const result = await new Promise((resolve) => {
                exec(cmd, { timeout: 20000 }, (err, stdout) => {
                    const status = parseInt((stdout || '').trim()) || 0;
                    resolve({ ok: status > 0 && status < 500, status, curlOk: !err });
                });
            });
            json(res, { ok: result.ok, status: result.status, bucket: R2_BUCKET_NAME });
        } catch(e) {
            json(res, { error: e.message }, 500);
        }
        return;
    }

    // =====================================================
    // R2 - PRESIGN POST (form upload directo desde navegador)
    // =====================================================
    if (urlPath === '/api/r2/presign-post' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return; }
        const body = await parseBody(req);
        const { fileName } = body;
        if (!fileName) { json(res, { error: 'fileName requerido' }, 400); return; }
        try {
            const key = `pedidos/${fileName}`;
            const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
            const region = 'auto';
            const service = 's3';
            const now = new Date();
            const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
            const dateStamp = amzDate.substring(0, 8);
            const expires = 3600;
            const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request`;
            const policy = JSON.stringify({
                expiration: new Date(now.getTime() + expires * 1000).toISOString(),
                conditions: [
                    { bucket: R2_BUCKET_NAME },
                    ['eq', '$key', key],
                    { 'Content-Type': 'application/pdf' },
                    ['content-length-range', 1, 52428800]
                ]
            });
            const policyBase64 = Buffer.from(policy).toString('base64');
            const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
            const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
            const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
            const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
            const signature = crypto.createHmac('sha256', kSigning).update(policyBase64).digest('base64');
            const publicUrl = `${R2_PUBLIC_URL}/${key}`;
            console.log('[R2] Presign POST generated for:', key);
            json(res, {
                url: `https://${host}/`,
                key,
                publicUrl,
                AWSAccessKeyId: R2_ACCESS_KEY_ID,
                policy: policyBase64,
                signature,
                'Content-Type': 'application/pdf'
            });
        } catch(e) {
            console.error('[R2] Presign POST error:', e.message);
            json(res, { error: 'Error al generar presign' }, 500);
        }
        return;
    }

    // R2 - PRESIGN PUT (para subida directa desde browser)
    if (urlPath === '/api/r2/presign-put' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return; }
        const body = await parseBody(req);
        const { fileName } = body;
        if (!fileName) { json(res, { error: 'fileName requerido' }, 400); return; }
        try {
            const key = `pedidos/${fileName}`;
            const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
            const region = 'auto';
            const service = 's3';
            const now = new Date();
            const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
            const dateStamp = amzDate.substring(0, 8);
            const expires = 3600;
            const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request`;
            const signedHeaders = 'host';
            const canonicalUri = '/' + key.split('/').map(p => encodeURIComponent(p)).join('/');
            const canonicalRequest = `PUT\n${canonicalUri}\n\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
            const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
            const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`;
            const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
            const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
            const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
            const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
            const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
            const queryParams = [
                'X-Amz-Algorithm=AWS4-HMAC-SHA256',
                `X-Amz-Credential=${encodeURIComponent(credential)}`,
                `X-Amz-Date=${amzDate}`,
                `X-Amz-Expires=${expires}`,
                'X-Amz-SignedHeaders=host',
                `X-Amz-Signature=${signature}`
            ].join('&');
            const url = `https://${host}/${key}`;
            const publicUrl = `${R2_PUBLIC_URL}/${key}`;
            console.log('[R2] Presign PUT generated for:', key);
            json(res, { url, key, publicUrl, queryParams });
        } catch(e) {
            console.error('[R2] Presign PUT error:', e.message);
            json(res, { error: 'Error al generar presign PUT' }, 500);
        }
        return;
    }

    // =====================================================
    // =====================================================
    if (urlPath === '/api/r2/download' && req.method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const key = urlObj.searchParams.get('key');
        
        if (!key) {
            json(res, { error: 'key es requerida' }, 400);
            return;
        }
        
        try {
            const publicUrl = `${R2_PUBLIC_URL}/${key}`;
            json(res, { url: publicUrl });
        } catch(e) {
            console.error('Error getting R2 URL:', e);
            json(res, { error: 'Error al obtener URL' }, 500);
        }
        return;
    }

    // =====================================================
    // R2 - ELIMINAR ARCHIVO
    // =====================================================
    if (urlPath === '/api/r2/delete' && req.method === 'DELETE') {
        const body = await parseBody(req);
        const { key } = body;
        
        if (!key) {
            json(res, { error: 'key es requerida' }, 400);
            return;
        }
        
        try {
            await r2Delete(key);
            json(res, { ok: true });
        } catch(e) {
            console.error('Error deleting from R2:', e);
            json(res, { error: 'Error al eliminar archivo' }, 500);
        }
        return;
    }

    // =====================================================
    // PRODUCCION - ENDPOINTS
    // =====================================================

    // GET /api/produccion/ordenes - Listar órdenes de producción
    if (urlPath === '/api/produccion/ordenes' && req.method === 'GET') {
        const result = await query(`
            SELECT o.*, 
                (SELECT COUNT(*) FROM cola_produccion_pasos p WHERE p.orden_produccion_id = o.id) as total_pasos,
                (SELECT COUNT(*) FROM cola_produccion_pasos p WHERE p.orden_produccion_id = o.id AND p.estado = 'TERMINADO') as pasos_terminados,
                CASE WHEN o.codigo_padre IS NOT NULL THEN
                    COALESCE(
                        (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                        o.codigo_padre
                    )
                ELSE NULL END as nombre_codigo_padre,
                (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_producto) as nombre_mp
            FROM produccion_ordenes o ORDER BY o.created_at DESC
        `);
        json(res, result.rows);
        return;
    }

    // POST /api/produccion/ordenes - Crear orden manual (con explosión BOM)
    if (urlPath === '/api/produccion/ordenes' && req.method === 'POST') {
        const body = await parseBody(req);
        const { pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, perforaciones, pintado, tipo_venta, item_numero, cantidad, fecha_creacion } = body;
        if (!pedido_sap_id || !codigo_producto || !ancho || !alto) { json(res, { error: 'Pedido, codigo, ancho y alto requeridos' }, 400); return; }
        try {
            const cant = Number(cantidad) || 1;
            const m2 = ((Number(ancho) * Number(alto)) / 1000000) * cant;
            const codigo = String(codigo_producto).trim();

            // 1) Buscar familia desde produccion_codigos.familia → familias_producto
            let familia = null;
            const codInfo = await query('SELECT familia FROM produccion_codigos WHERE codigo = $1', [codigo]);
            if (codInfo.rows.length && codInfo.rows[0].familia) {
                const nombreFam = codInfo.rows[0].familia;
                const famRes = await query('SELECT * FROM familias_producto WHERE UPPER(nombre_familia) = UPPER($1) OR UPPER(codigo_familia) = UPPER($1)', [nombreFam]);
                if (famRes.rows.length > 0) familia = famRes.rows[0];
            }

            // 2) Buscar estaciones base de la familia
            let estacionesBaseIds = [];
            if (familia) {
                const febRes = await query(`
                    SELECT feb.estacion_id FROM familia_estaciones_base feb
                    JOIN estaciones_maestras e ON feb.estacion_id = e.id
                    WHERE feb.familia_id = $1 ORDER BY e.orden_secuencia_defecto
                `, [familia.id]);
                estacionesBaseIds = febRes.rows.map(r => r.estacion_id);
            }
            // Fallback: Corte→Pulido→Templado
            if (estacionesBaseIds.length === 0) {
                const defRes = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion IN ('Corte','Pulido','Templado') ORDER BY orden_secuencia_defecto");
                estacionesBaseIds = defRes.rows.map(r => r.id);
            }

            // 3) Agregar extras según banderas
            if (perforaciones) {
                const mec = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Mecanizado'");
                if (mec.rows.length && !estacionesBaseIds.includes(mec.rows[0].id)) {
                    const templadoIdx = estacionesBaseIds.findIndex(id => {
                        // find templado position
                        return estacionesBaseIds.indexOf(id) >= 0;
                    });
                    // Insertar Mecanizado antes de Templado (id 7)
                    const pos = estacionesBaseIds.findIndex(async id => {
                        const e = await query('SELECT orden_secuencia_defecto FROM estaciones_maestras WHERE id = $1', [id]);
                        return e.rows[0]?.orden_secuencia_defecto >= 7;
                    });
                    estacionesBaseIds.splice(Math.max(0, estacionesBaseIds.length - 1), 0, mec.rows[0].id);
                }
            }
            if (pintado) {
                const pint = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Pintado'");
                if (pint.rows.length && !estacionesBaseIds.includes(pint.rows[0].id)) {
                    estacionesBaseIds.splice(Math.max(0, estacionesBaseIds.length - 1), 0, pint.rows[0].id);
                }
            }

            // Re-ordenar por orden_secuencia_defecto
            if (estacionesBaseIds.length > 0) {
                const ordenRes = await query(`SELECT id, orden_secuencia_defecto FROM estaciones_maestras WHERE id = ANY($1) ORDER BY orden_secuencia_defecto`, [estacionesBaseIds]);
                estacionesBaseIds = ordenRes.rows.map(r => r.id);
            }

            // 4) Buscar receta BOM
            let recetas = [];
            const bomNew = await query(`
                SELECT rb.*, mp.codigo_mp, mp.nombre as mp_nombre
                FROM recetas_bom rb
                LEFT JOIN materias_primas mp ON rb.materia_prima_id = mp.id
                WHERE rb.codigo_sap_padre = $1
            `, [codigo]);
            if (bomNew.rows.length > 0) {
                recetas = bomNew.rows;
            } else {
                const bomOld = await query(`
                    SELECT *, codigo_materia_prima as codigo_mp, descripcion as mp_nombre
                    FROM produccion_recetas_bom WHERE codigo_sap_padre = $1
                `, [codigo]);
                recetas = bomOld.rows;
            }

            console.log('[PROD] Manual:', codigo, 'familia:', familia?.nombre_familia, 'BOM:', recetas.length, 'estaciones:', estacionesBaseIds.length);

            const ids = [];
            if (recetas.length > 0) {
                // Explosión BOM: crear una orden por componente
                for (const comp of recetas) {
                    const mpCodigo = comp.codigo_mp || codigo;
                    const mpNombre = comp.mp_nombre || descripcion || '';
                    const result = await query(
                        `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                         es_compuesto, tipo_venta, item_numero, cantidad, familia_id, codigo_padre, created_at)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12,$13) RETURNING id`,
                        [pedido_sap_id, cliente || null, mpCodigo, mpNombre, ancho, alto, m2,
                         tipo_venta || 'Normal', item_numero || 1, cant, familia?.id || null, codigo, fecha_creacion || new Date().toISOString()]
                    );
                    const ordenId = result.rows[0].id;
                    ids.push(ordenId);
                    for (let s = 0; s < estacionesBaseIds.length; s++) {
                        await query('INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,$4)', [ordenId, estacionesBaseIds[s], s + 1, 'PENDIENTE']);
                    }
                }
            } else {
                // Sin receta BOM: orden directa
                const result = await query(
                    `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                     tipo_venta, item_numero, cantidad, familia_id, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
                    [pedido_sap_id, cliente || null, codigo, descripcion || null, ancho, alto, m2,
                     tipo_venta || 'Normal', item_numero || 1, cant, familia?.id || null, fecha_creacion || new Date().toISOString()]
                );
                const orden = result.rows[0];
                ids.push(orden.id);
                for (let s = 0; s < estacionesBaseIds.length; s++) {
                    await query('INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1,$2,$3,$4)', [orden.id, estacionesBaseIds[s], s + 1, 'PENDIENTE']);
                }
            }
            json(res, { ok: true, ordenes_creadas: ids.length, ids }, 201);
        } catch(e) {
            console.error('[PROD] Error crear orden manual:', e.message);
            json(res, { error: 'Error al crear orden: ' + e.message }, 500);
        }
        return;
    }

    // PUT /api/produccion/ordenes/:id/cerrar - Cerrar orden con nota
    const cerrarOrdenMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)\/cerrar$/);
    if (cerrarOrdenMatch && req.method === 'PUT') {
        const id = Number(cerrarOrdenMatch[1]);
        const body = await parseBody(req);
        const { nota } = body;
        if (!nota) { json(res, { error: 'Motivo de cierre requerido' }, 400); return; }
        try {
            await query('UPDATE produccion_ordenes SET estado_programacion = $1, cerrado_nota = $2 WHERE id = $3', ['CERRADO', nota, id]);
            json(res, { ok: true });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // PUT /api/produccion/ordenes/:id - Editar orden (cantidad, etc.)
    const editOrdenMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)$/);
    if (editOrdenMatch && req.method === 'PUT') {
        const id = Number(editOrdenMatch[1]);
        const body = await parseBody(req);
        try {
            const fields = [];
            const values = [];
            let idx = 1;
            if (body.cantidad !== undefined) { fields.push(`cantidad = $${idx++}`); values.push(Number(body.cantidad) || 1); }
            if (body.metros_cuadrados !== undefined) { fields.push(`metros_cuadrados = $${idx++}`); values.push(Number(body.metros_cuadrados)); }
            if (fields.length === 0) { json(res, { error: 'Sin campos para actualizar' }, 400); return; }
            values.push(id);
            await query(`UPDATE produccion_ordenes SET ${fields.join(', ')} WHERE id = $${idx}`, values);
            const result = await query('SELECT * FROM produccion_ordenes WHERE id = $1', [id]);
            json(res, result.rows[0] || { ok: true });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // DELETE /api/produccion/ordenes/:id - Eliminar orden
    const deleteOrdenMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)$/);
    if (deleteOrdenMatch && req.method === 'DELETE') {
        const id = Number(deleteOrdenMatch[1]);
        try {
            await query('DELETE FROM produccion_ordenes WHERE id = $1', [id]);
            json(res, { ok: true });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // GET /api/produccion/ordenes/:id/pasos - Pasos de una orden
    const ordenPasosMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)\/pasos$/);
    if (ordenPasosMatch && req.method === 'GET') {
        const id = Number(ordenPasosMatch[1]);
        const result = await query(`
            SELECT p.*, e.nombre_estacion, e.orden_secuencia_defecto
            FROM cola_produccion_pasos p
            LEFT JOIN estaciones_maestras e ON p.estacion_id = e.id
            WHERE p.orden_produccion_id = $1
            ORDER BY p.orden_secuencia
        `, [id]);
        json(res, result.rows);
        return;
    }

    // GET /api/produccion/maquinas - Listar máquinas
    if (urlPath === '/api/produccion/maquinas' && req.method === 'GET') {
        const result = await query('SELECT * FROM produccion_maquinas ORDER BY num_operacion ASC NULLS LAST, nombre ASC');
        json(res, result.rows);
        return;
    }

    // POST /api/produccion/maquinas - Crear máquina
    if (urlPath === '/api/produccion/maquinas' && req.method === 'POST') {
        const body = await parseBody(req);
        const { nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion } = body;
        if (!nombre || !codigo) { json(res, { error: 'Nombre y código requeridos' }, 400); return; }
        try {
            const result = await query(
                'INSERT INTO produccion_maquinas (nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
                [nombre, codigo, capacidad_max_m2_dia || 0, estado || 'ACTIVA', tipo_proceso || null, num_operacion || null]
            );
            json(res, result.rows[0], 201);
        } catch(e) { json(res, { error: 'Error al crear máquina: ' + e.message }, 500); }
        return;
    }

    // POST /api/produccion/maquinas/import - Importar máquinas masivamente
    if (urlPath === '/api/produccion/maquinas/import' && req.method === 'POST') {
        const body = await parseBody(req);
        const { maquinas } = body;
        if (!Array.isArray(maquinas) || maquinas.length === 0) { json(res, { error: 'No hay máquinas para importar' }, 400); return; }
        let inserted = 0, skipped = 0, errors = [];
        for (const m of maquinas) {
            if (!m.codigo || !m.nombre) { skipped++; continue; }
            try {
                const existing = await query('SELECT id FROM produccion_maquinas WHERE codigo = $1', [m.codigo]);
                if (existing.rows.length > 0) { skipped++; continue; }
                await query(
                    'INSERT INTO produccion_maquinas (nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion) VALUES ($1, $2, $3, $4, $5, $6)',
                    [m.nombre, m.codigo, Number(m.capacidad_max_m2_dia) || 0, m.estado || 'ACTIVA', m.tipo_proceso || null, m.num_operacion || null]
                );
                inserted++;
            } catch(e) { errors.push(m.codigo + ': ' + e.message); }
        }
        json(res, { inserted, skipped, errors, total: maquinas.length });
        return;
    }

    // PUT /api/produccion/maquinas/:id - Editar máquina
    const editMaquinaMatch = urlPath.match(/^\/api\/produccion\/maquinas\/(\d+)$/);
    if (editMaquinaMatch && req.method === 'PUT') {
        const id = Number(editMaquinaMatch[1]);
        const body = await parseBody(req);
        const { nombre, codigo, capacidad_max_m2_dia, estado, tipo_proceso, num_operacion } = body;
        try {
            await query(
                'UPDATE produccion_maquinas SET nombre=$1, codigo=$2, capacidad_max_m2_dia=$3, estado=$4, tipo_proceso=$5, num_operacion=$6 WHERE id=$7',
                [nombre, codigo, capacidad_max_m2_dia || 0, estado || 'ACTIVA', tipo_proceso || null, num_operacion || null, id]
            );
            json(res, { ok: true });
        } catch(e) { json(res, { error: 'Error al actualizar: ' + e.message }, 500); }
        return;
    }

    // DELETE /api/produccion/maquinas/:id
    const deleteMaquinaMatch = urlPath.match(/^\/api\/produccion\/maquinas\/(\d+)$/);
    if (deleteMaquinaMatch && req.method === 'DELETE') {
        const id = Number(deleteMaquinaMatch[1]);
        await query('DELETE FROM produccion_maquinas WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // GET /api/produccion/recetas - Listar recetas BOM
    if (urlPath === '/api/produccion/recetas' && req.method === 'GET') {
        const result = await query('SELECT * FROM produccion_recetas_bom ORDER BY codigo_sap_padre, codigo_materia_prima');
        json(res, result.rows);
        return;
    }

    // POST /api/produccion/recetas - Crear receta BOM
    if (urlPath === '/api/produccion/recetas' && req.method === 'POST') {
        const body = await parseBody(req);
        const { codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad } = body;
        if (!codigo_sap_padre || !codigo_materia_prima) { json(res, { error: 'Código padre y materia prima requeridos' }, 400); return; }
        try {
            const result = await query(
                'INSERT INTO produccion_recetas_bom (codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [codigo_sap_padre, codigo_materia_prima, descripcion || '', espesor || 0, cantidad || 1]
            );
            json(res, result.rows[0], 201);
        } catch(e) { json(res, { error: 'Error al crear receta: ' + e.message }, 500); }
        return;
    }

    // DELETE /api/produccion/recetas/all - Eliminar todas las recetas (admin only)
    if (urlPath === '/api/produccion/recetas/all' && req.method === 'DELETE') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'No autorizado' }, 403); return;
        }
        const count = await query('SELECT COUNT(*) as total FROM produccion_recetas_bom');
        await query('DELETE FROM produccion_recetas_bom');
        json(res, { eliminados: Number(count.rows[0].total) });
        return;
    }

    // DELETE /api/produccion/recetas/:id
    const deleteRecetaMatch = urlPath.match(/^\/api\/produccion\/recetas\/(\d+)$/);
    if (deleteRecetaMatch && req.method === 'DELETE') {
        const id = Number(deleteRecetaMatch[1]);
        await query('DELETE FROM produccion_recetas_bom WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // POST /api/produccion/recetas/importar - Importar recetas BOM desde Excel
    if (urlPath === '/api/produccion/recetas/importar' && req.method === 'POST') {
        const body = await parseBody(req);
        const { rows, excel_data } = body;
        let parsedRows = rows;
        if (!parsedRows && excel_data) {
            try {
                const XLSX = require('xlsx');
                const buffer = Buffer.from(excel_data, 'base64');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            } catch(e) { json(res, { error: 'Error al parsear Excel: ' + e.message }, 400); return; }
        }
        if (!Array.isArray(parsedRows) || !parsedRows.length) { json(res, { error: 'No hay datos para importar' }, 400); return; }
        const resultados = { importadas: 0, errores: [] };
        for (let i = 0; i < parsedRows.length; i++) {
            try {
                const row = parsedRows[i];
                const codigo_padre = String(row['CodigoPadre'] || row['codigo_padre'] || row['codigopadre'] || row['Codigo'] || '').trim();
                const codigo_mp = String(row['CodigoMateriaPrima'] || row['codigo_materiaprima'] || row['codigomateriaprima'] || row['codigo_mp'] || row['MateriaPrima'] || '').trim();
                const desc = String(row['Descripcion'] || row['descripcion'] || '').trim();
                const espesor = Number(row['Espesor'] || row['espesor'] || 0);
                const cantidad = Number(row['Cantidad'] || row['cantidad'] || row['Cantdad'] || row['cantdad'] || 1);
                if (!codigo_padre || !codigo_mp) { resultados.errores.push({ fila: i + 1, error: 'Faltan codigos' }); continue; }
                await query(
                    'INSERT INTO produccion_recetas_bom (codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad) VALUES ($1, $2, $3, $4, $5)',
                    [codigo_padre, codigo_mp, desc, espesor, cantidad]
                );
                resultados.importadas++;
            } catch(eRow) { resultados.errores.push({ fila: i + 1, error: eRow.message }); }
        }
        json(res, resultados);
        return;
    }

    // =====================================================
    // PRODUCCION - CODIGOS SAP
    // =====================================================

    // GET /api/produccion/codigos
    if (urlPath === '/api/produccion/codigos' && req.method === 'GET') {
        const result = await query('SELECT * FROM produccion_codigos ORDER BY codigo');
        json(res, result.rows);
        return;
    }

    // DELETE /api/produccion/codigos/all - Eliminar todos los codigos (admin only)
    if (urlPath === '/api/produccion/codigos/all' && req.method === 'DELETE') {
        const userEmail = req.headers['x-user-email'];
        const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
        if (!userRes.rows.length || !userRes.rows[0].permisos.includes('usuarios')) {
            json(res, { error: 'Solo admin' }, 403); return;
        }
        const result = await query('DELETE FROM produccion_codigos');
        json(res, { ok: true, eliminados: result.rowCount });
        return;
    }

    // POST /api/produccion/codigos
    if (urlPath === '/api/produccion/codigos' && req.method === 'POST') {
        const body = await parseBody(req);
        const { codigo, descripcion, grupo, familia, bloqueo_tela } = body;
        if (!codigo) { json(res, { error: 'Codigo requerido' }, 400); return; }
        try {
            const result = await query(
                'INSERT INTO produccion_codigos (codigo, descripcion, grupo, familia, bloqueo_tela) VALUES ($1, $2, $3, $4, $5) RETURNING *',
                [codigo, descripcion || '', grupo || '', familia || '', bloqueo_tela === true || bloqueo_tela === 'si']
            );
            json(res, result.rows[0], 201);
        } catch(e) {
            if (e.code === '23505') { json(res, { error: 'El codigo ya existe' }, 400); return; }
            json(res, { error: 'Error al crear: ' + e.message }, 500);
        }
        return;
    }

    // DELETE /api/produccion/codigos/:id
    const deleteCodigoMatch = urlPath.match(/^\/api\/produccion\/codigos\/(\d+)$/);
    if (deleteCodigoMatch && req.method === 'DELETE') {
        const id = Number(deleteCodigoMatch[1]);
        await query('DELETE FROM produccion_codigos WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // POST /api/produccion/codigos/importar - Importar desde Excel
    if (urlPath === '/api/produccion/codigos/importar' && req.method === 'POST') {
        const body = await parseBody(req);
        const { excel_data } = body;
        if (!excel_data) { json(res, { error: 'Datos del archivo requeridos' }, 400); return; }
        try {
            const XLSX = require('xlsx');
            const buffer = Buffer.from(excel_data, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            if (!rows.length) { json(res, { error: 'Archivo vacio' }, 400); return; }
            const resultados = { importados: 0, errores: [] };
            for (let i = 0; i < rows.length; i++) {
                try {
                    const row = rows[i];
                    const codigo = String(row['Codigo'] || row['codigo'] || row['ItemCode'] || '').trim();
                    const descripcion = String(row['Descripcion'] || row['descripcion'] || row['ItemName'] || '').trim();
                    const grupo = String(row['Grupo'] || row['grupo'] || row['Group'] || '').trim();
                    const familia = String(row['Familia'] || row['familia'] || row['Family'] || '').trim();
                    // Buscar valor de bloqueo en cualquier columna que contenga "bloqueo" o "bloque" o "tela"
                    let bloqueoRaw = '';
                    for (const key of Object.keys(row)) {
                        const kl = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        if (kl.includes('bloqueo') || kl.includes('bloque') || kl.includes('tela')) {
                            bloqueoRaw = String(row[key] || '').trim();
                            break;
                        }
                    }
                    const bloqueo = bloqueoRaw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    const bloqueo_tela_val = bloqueo === 'si' || bloqueo === 's' || bloqueo === '1' || bloqueo === 'true' || bloqueo === 'x';
                    if (!codigo) { resultados.errores.push({ fila: i + 1, error: 'Sin codigo' }); continue; }
                    await query(
                        `INSERT INTO produccion_codigos (codigo, descripcion, grupo, familia, bloqueo_tela)
                         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (codigo) DO UPDATE SET
                         descripcion = EXCLUDED.descripcion, grupo = EXCLUDED.grupo,
                         familia = EXCLUDED.familia, bloqueo_tela = $5`,
                        [codigo, descripcion, grupo, familia, bloqueo_tela_val]
                    );
                    resultados.importados++;
                } catch(eRow) { resultados.errores.push({ fila: i + 1, error: eRow.message }); }
            }
            json(res, resultados);
        } catch(e) { json(res, { error: 'Error al procesar: ' + e.message }, 500); }
        return;
    }

    // =====================================================
    // CRUD: Estaciones Maestras
    // =====================================================
    if (urlPath === '/api/produccion/estaciones' && req.method === 'GET') {
        const result = await query('SELECT * FROM estaciones_maestras ORDER BY orden_secuencia_defecto');
        json(res, result.rows);
        return;
    }
    if (urlPath === '/api/produccion/estaciones' && req.method === 'POST') {
        const body = await parseBody(req);
        const { nombre_estacion, orden_secuencia_defecto, activa } = body;
        if (!nombre_estacion || !orden_secuencia_defecto) { json(res, { error: 'Nombre y orden requeridos' }, 400); return; }
        const result = await query(
            'INSERT INTO estaciones_maestras (nombre_estacion, orden_secuencia_defecto, activa) VALUES ($1, $2, $3) RETURNING *',
            [nombre_estacion.trim(), orden_secuencia_defecto, activa !== false]
        );
        json(res, result.rows[0]);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/estaciones\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        const { nombre_estacion, orden_secuencia_defecto, activa } = body;
        const result = await query(
            'UPDATE estaciones_maestras SET nombre_estacion=$1, orden_secuencia_defecto=$2, activa=$3 WHERE id=$4 RETURNING *',
            [nombre_estacion, orden_secuencia_defecto, activa, id]
        );
        json(res, result.rows[0] || { error: 'No encontrado' }, result.rows[0] ? 200 : 404);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/estaciones\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await query('DELETE FROM estaciones_maestras WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // CRUD: Familias de Producto
    // =====================================================
    if (urlPath === '/api/produccion/familias' && req.method === 'GET') {
        const result = await query(`
            SELECT f.*,
                COALESCE(json_agg(json_build_object('estacion_id', feb.estacion_id, 'nombre_estacion', em.nombre_estacion, 'orden', em.orden_secuencia_defecto)
                ORDER BY em.orden_secuencia_defecto) FILTER (WHERE feb.estacion_id IS NOT NULL), '[]') as estaciones_base
            FROM familias_producto f
            LEFT JOIN familia_estaciones_base feb ON f.id = feb.familia_id
            LEFT JOIN estaciones_maestras em ON feb.estacion_id = em.id
            GROUP BY f.id ORDER BY f.codigo_familia
        `);
        json(res, result.rows);
        return;
    }
    if (urlPath === '/api/produccion/familias' && req.method === 'POST') {
        const body = await parseBody(req);
        const { codigo_familia, nombre_familia, costo_hh, costo_energia, estacion_ids } = body;
        if (!codigo_familia || !nombre_familia) { json(res, { error: 'Código y nombre requeridos' }, 400); return; }
        const result = await query(
            'INSERT INTO familias_producto (codigo_familia, nombre_familia, costo_hh, costo_energia) VALUES ($1, $2, $3, $4) RETURNING *',
            [codigo_familia.trim(), nombre_familia.trim(), costo_hh || 0, costo_energia || 0]
        );
        const fam = result.rows[0];
        if (Array.isArray(estacion_ids)) {
            for (const eid of estacion_ids) {
                await query('INSERT INTO familia_estaciones_base (familia_id, estacion_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [fam.id, eid]);
            }
        }
        json(res, fam);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/familias\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        const { codigo_familia, nombre_familia, costo_hh, costo_energia, estacion_ids } = body;
        await query(
            'UPDATE familias_producto SET codigo_familia=$1, nombre_familia=$2, costo_hh=$3, costo_energia=$4 WHERE id=$5',
            [codigo_familia, nombre_familia, costo_hh, costo_energia, id]
        );
        if (Array.isArray(estacion_ids)) {
            await query('DELETE FROM familia_estaciones_base WHERE familia_id = $1', [id]);
            for (const eid of estacion_ids) {
                await query('INSERT INTO familia_estaciones_base (familia_id, estacion_id) VALUES ($1, $2)', [id, eid]);
            }
        }
        json(res, { ok: true });
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/familias\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await query('DELETE FROM familias_producto WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // CRUD: Materias Primas
    // =====================================================
    if (urlPath === '/api/produccion/materias-primas' && req.method === 'GET') {
        const result = await query('SELECT * FROM materias_primas ORDER BY codigo_mp');
        json(res, result.rows);
        return;
    }
    if (urlPath === '/api/produccion/materias-primas' && req.method === 'POST') {
        const body = await parseBody(req);
        const { codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion } = body;
        if (!codigo_mp || !nombre) { json(res, { error: 'Código y nombre requeridos' }, 400); return; }
        const result = await query(
            'INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [codigo_mp.trim(), nombre.trim(), espesor_mm || 0, costo_unitario_mp || 0, observacion || '']
        );
        json(res, result.rows[0]);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/materias-primas\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        const { codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion } = body;
        const result = await query(
            'UPDATE materias_primas SET codigo_mp=$1, nombre=$2, espesor_mm=$3, costo_unitario_mp=$4, observacion=$5 WHERE id=$6 RETURNING *',
            [codigo_mp, nombre, espesor_mm, costo_unitario_mp, observacion, id]
        );
        json(res, result.rows[0] || { error: 'No encontrado' }, result.rows[0] ? 200 : 404);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/materias-primas\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await query('DELETE FROM materias_primas WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // CRUD: Recetas BOM (nueva tabla)
    // =====================================================
    if (urlPath === '/api/produccion/recetas-bom' && req.method === 'GET') {
        const result = await query(`
            SELECT r.*, m.codigo_mp, m.nombre as mp_nombre, m.espesor_mm, m.costo_unitario_mp
            FROM recetas_bom r
            LEFT JOIN materias_primas m ON r.materia_prima_id = m.id
            ORDER BY r.codigo_sap_padre, m.codigo_mp
        `);
        json(res, result.rows);
        return;
    }
    if (urlPath === '/api/produccion/recetas-bom' && req.method === 'POST') {
        const body = await parseBody(req);
        const { codigo_sap_padre, materia_prima_id, cantidad } = body;
        if (!codigo_sap_padre || !materia_prima_id) { json(res, { error: 'Código SAP y materia prima requeridos' }, 400); return; }
        const result = await query(
            'INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad) VALUES ($1, $2, $3) RETURNING *',
            [codigo_sap_padre.trim(), materia_prima_id, cantidad || 1]
        );
        json(res, result.rows[0]);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/recetas-bom\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await query('DELETE FROM recetas_bom WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // =====================================================
    // CRUD: Reglas Procesos Extras
    // =====================================================
    if (urlPath === '/api/produccion/reglas-extras' && req.method === 'GET') {
        const result = await query(`
            SELECT r.*, e.nombre_estacion, e.orden_secuencia_defecto
            FROM reglas_procesos_extras r
            LEFT JOIN estaciones_maestras e ON r.estacion_id = e.id
            ORDER BY r.nombre_flag
        `);
        json(res, result.rows);
        return;
    }
    if (urlPath === '/api/produccion/reglas-extras' && req.method === 'POST') {
        const body = await parseBody(req);
        const { nombre_flag, estacion_id } = body;
        if (!nombre_flag || !estacion_id) { json(res, { error: 'Flag y estación requeridos' }, 400); return; }
        const result = await query(
            'INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2) RETURNING *',
            [nombre_flag.trim().toLowerCase(), estacion_id]
        );
        json(res, result.rows[0]);
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/reglas-extras\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        const { nombre_flag, estacion_id, activa } = body;
        await query(
            'UPDATE reglas_procesos_extras SET nombre_flag=$1, estacion_id=$2, activa=$3 WHERE id=$4',
            [nombre_flag, estacion_id, activa, id]
        );
        json(res, { ok: true });
        return;
    }
    if (urlPath.match(/^\/api\/produccion\/reglas-extras\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await query('DELETE FROM reglas_procesos_extras WHERE id = $1', [id]);
        json(res, { ok: true });
        return;
    }

    // POST /api/produccion/importar - Importar desde Excel (Nueva Arquitectura)
    if (urlPath === '/api/produccion/importar' && req.method === 'POST') {
        console.log('[PROD] >>> Endpoint /api/produccion/importar HIT');
        const body = await parseBody(req);
        console.log('[PROD] Body recibido, rows type:', typeof body.rows, 'isArray:', Array.isArray(body.rows), 'length:', body.rows?.length);
        const { rows: clientRows, excel_data, file_name } = body;

        let rows = clientRows;
        if (!rows && excel_data) {
            try {
                const XLSX = require('xlsx');
                const buffer = Buffer.from(excel_data, 'base64');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            } catch(e) { json(res, { error: 'Error al parsear Excel: ' + e.message }, 400); return; }
        }

        if (!Array.isArray(rows) || !rows.length) { json(res, { error: 'El archivo Excel esta vacio' }, 400); return; }

        console.log('[PROD] Importando', rows.length, 'filas desde', file_name || 'excel');

        // ── Cargar datos maestros en memoria ──
        const [estacionesRes, familiasRes, reglasRes, recetasBomRes, materiasRes, oldRecetasRes] = await Promise.all([
            query('SELECT * FROM estaciones_maestras WHERE activa = TRUE'),
            query('SELECT * FROM familias_producto WHERE activa = TRUE'),
            query('SELECT * FROM reglas_procesos_extras WHERE activa = TRUE'),
            query('SELECT * FROM recetas_bom'),
            query('SELECT * FROM materias_primas'),
            query('SELECT * FROM produccion_recetas_bom')
        ]);

        const estacionesMaestras = estacionesRes.rows;
        const familias = familiasRes.rows;
        const reglasExtras = reglasRes.rows;
        const recetasBom = recetasBomRes.rows;
        const materiasPrimas = materiasRes.rows;

        // Mapas de búsqueda
        const estacionMap = {};
        estacionesMaestras.forEach(e => { estacionMap[e.nombre_estacion] = e; });

        const familiaMap = {};
        familias.forEach(f => { familiaMap[f.codigo_familia] = f; });

        const reglaMap = {};
        reglasExtras.forEach(r => { reglaMap[r.nombre_flag] = r; });

        const recetaBomMap = {};
        recetasBom.forEach(r => {
            if (!recetaBomMap[r.codigo_sap_padre]) recetaBomMap[r.codigo_sap_padre] = [];
            recetaBomMap[r.codigo_sap_padre].push(r);
        });

        // Fallback: si recetas_bom está vacío, usar tabla antigua
        const oldRecetas = oldRecetasRes.rows;
        if (Object.keys(recetaBomMap).length === 0 && oldRecetas.length > 0) {
            console.log('[PROD] Usando recetas de produccion_recetas_bom (tabla antigua)');
            oldRecetas.forEach(r => {
                const codigo = r.codigo_sap_padre;
                if (!recetaBomMap[codigo]) recetaBomMap[codigo] = [];
                recetaBomMap[codigo].push({
                    codigo_sap_padre: codigo,
                    materia_prima_id: null,
                    cantidad: r.cantidad || 1,
                    old_codigo: r.codigo_materia_prima,
                    old_descripcion: r.descripcion,
                    old_espesor: r.espesor
                });
            });
        }

        const materiaPrimaMap = {};
        materiasPrimas.forEach(m => { materiaPrimaMap[m.id] = m; });

        // Familia estaciones base
        const famEstRes = await query(`
            SELECT feb.familia_id, array_agg(feb.estacion_id ORDER BY em.orden_secuencia_defecto) as estacion_ids
            FROM familia_estaciones_base feb
            JOIN estaciones_maestras em ON feb.estacion_id = em.id
            GROUP BY feb.familia_id
        `);
        const familiaEstacionesMap = {};
        famEstRes.rows.forEach(r => { familiaEstacionesMap[r.familia_id] = r.estacion_ids; });

        // ── Merge filas idénticas (pedido+item+codigo) ──
        const merged = {};
        const mergeOrder = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const codigo = String(row['codigo'] || row['Codigo'] || row['CODIGO'] || row['ItemCode'] || '').trim();
            const pedido = String(row['pedido'] || row['Pedido'] || row['PEDIDO'] || row['DocEntry'] || '').trim();
            const item = Number(row['item'] || row['Item'] || row['ITEM'] || i + 1);
            const key = `${pedido}|${item}|${codigo}`;
            const ancho = Number(row['anho'] || row['ancho'] || row['Ancho'] || row['ANHO'] || row['ANCHO'] || row['Width'] || 0);
            const alto = Number(row['alto'] || row['Alto'] || row['ALTO'] || row['Height'] || 0);
            if (!codigo || !ancho || !alto) continue;
            if (!merged[key]) {
                merged[key] = {
                    codigo, pedido, item,
                    cliente: String(row['cliente'] || row['Cliente'] || row['CLIENTE'] || row['CardName'] || '').trim(),
                    descripcion: String(row['descripcion'] || row['Descripcion'] || row['ItemName'] || '').trim(),
                    ancho, alto,
                    cantidad: Number(row['cantidad'] || row['Cantidad'] || row['CANTIDAD'] || row['cant'] || row['Cant'] || row['CANT'] || 1),
                    precio_unitario: Number(row['precio'] || row['Precio'] || row['precio_unitario'] || row['Price'] || 0),
                    // Banderas de procesos extras
                    radio: Number(row['radio'] || row['Radio'] || row['RADIO'] || 0) === 1,
                    pulido: Number(row['pulido'] || row['Pulido'] || row['PULIDO'] || 0) === 1,
                    mecanizado: Number(row['mecanizado'] || row['Mecanizado'] || row['MECANIZADO'] || row['perforaciones'] || row['Perforaciones'] || 0) > 0,
                    ventana: Number(row['ventana'] || row['Ventana'] || row['VENTANA'] || 0) === 1,
                    pintado: Number(row['pintado'] || row['Pintado'] || row['PINTADO'] || 0) === 1,
                    tipo_venta: String(row['tipo de venta'] || row['tipo_de_venta'] || row['TipoVenta'] || row['TIPO VENTA'] || row['TIPO_DE_VENTA'] || 'Normal').trim(),
                    familia_codigo: String(row['familia'] || row['Familia'] || row['FAMILIA'] || row['grupo'] || row['Grupo'] || '').trim(),
                    fecha_creacion: String(row['fecha_creacion'] || row['FechaCreacion'] || row['fecha'] || row['Fecha'] || '').trim() || null
                };
                mergeOrder.push(key);
            } else {
                merged[key].cantidad += Number(row['cantidad'] || row['Cantidad'] || row['CANTIDAD'] || 1);
            }
        }

        const resultados = { importadas: 0, errores: [], pasos_creados: 0, fusiones: rows.length - mergeOrder.length, costos_calculados: 0 };

        // ── Procesar cada fila mergeada ──
        for (const key of mergeOrder) {
            try {
                const r = merged[key];
                const m2 = ((r.ancho / 1000) * (r.alto / 1000)) * r.cantidad;

                // ── Buscar familia del producto ──
                let familia = null;
                if (r.familia_codigo) {
                    familia = familiaMap[r.familia_codigo] || null;
                    // Buscar por nombre también
                    if (!familia) {
                        familia = familias.find(f => f.nombre_familia.toLowerCase().includes(r.familia_codigo.toLowerCase()));
                    }
                }
                // Intentar mapear por código SAP si no se especificó familia
                if (!familia) {
                    for (const f of familias) {
                        if (r.descripcion && r.descripcion.toLowerCase().includes(f.nombre_familia.toLowerCase())) {
                            familia = f;
                            break;
                        }
                    }
                }
                // Fallback: buscar familia en produccion_codigos.familia
                if (!familia) {
                    const codFam = await query('SELECT familia FROM produccion_codigos WHERE codigo = $1', [r.codigo]);
                    if (codFam.rows.length && codFam.rows[0].familia) {
                        familia = familias.find(f => f.nombre_familia.toLowerCase() === codFam.rows[0].familia.toLowerCase()) || null;
                    }
                }

                // ── B) Enrutamiento Dinámico ──
                let estacionesFinales = [];

                if (familia && familiaEstacionesMap[familia.id]) {
                    // Usar estaciones base de la familia
                    estacionesFinales = [...familiaEstacionesMap[familia.id]];
                } else {
                    // Fallback: Corte → Pulido → Templado
                    estacionesFinales = [
                        estacionMap['Corte']?.id,
                        estacionMap['Pulido']?.id,
                        estacionMap['Templado']?.id
                    ].filter(Boolean);
                }

                // Agregar estaciones extras según banderas del Excel
                const flagsMap = { radio: 'radio', pulido: 'pulido', mecanizado: 'mecanizado', ventana: 'ventana', pintado: 'pintado' };
                for (const [flag, nombre] of Object.entries(flagsMap)) {
                    if (r[flag] && reglaMap[nombre]) {
                        const estId = reglaMap[nombre].estacion_id;
                        if (!estacionesFinales.includes(estId)) {
                            estacionesFinales.push(estId);
                        }
                    }
                }

                // Ordenar estrictamente por orden_secuencia_defecto
                estacionesFinales.sort((a, b) => {
                    const ea = estacionesMaestras.find(e => e.id === a);
                    const eb = estacionesMaestras.find(e => e.id === b);
                    return (ea?.orden_secuencia_defecto || 99) - (eb?.orden_secuencia_defecto || 99);
                });

                // ── A) Explosión de Materiales (BOM) ──
                const es_compuesto = recetaBomMap[r.codigo] && recetaBomMap[r.codigo].length > 0;

                if (es_compuesto) {
                    const componentes = recetaBomMap[r.codigo];
                    for (const comp of componentes) {
                        // Soportar formato nuevo (materia_prima_id) y antiguo (old_codigo)
                        let mp = comp.materia_prima_id ? materiaPrimaMap[comp.materia_prima_id] : null;
                        if (!mp && comp.old_codigo) {
                            mp = materiasPrimas.find(m => m.codigo_mp === comp.old_codigo);
                        }
                        if (!mp) continue;

                        // ── C) Costos ──
                        const costo_hh = familia ? Number(familia.costo_hh) : 0;
                        const costo_energia = familia ? Number(familia.costo_energia) : 0;
                        const costo_mp_unit = Number(mp.costo_unitario_mp) || 0;
                        const cantidad_mp = Number(comp.cantidad) || 1;
                        const costo_mp_total = costo_mp_unit * cantidad_mp * m2;
                        const costo_total = (costo_hh + costo_energia + costo_mp_total);
                        const precio_sap = r.precio_unitario * r.cantidad;
                        const margen = precio_sap - costo_total;

                        const result = await query(
                            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                             es_compuesto, bom_padre_id, tipo_venta, item_numero, cantidad, familia_id, codigo_padre,
                             costo_hh, costo_energia, costo_materia_prima, costo_total_estimado, precio_unitario_sap, margen_estimado, created_at)
                             VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21) RETURNING id`,
                            [r.pedido, r.cliente, mp.codigo_mp, mp.nombre || r.descripcion, r.ancho, r.alto, m2,
                             comp.id, r.tipo_venta, r.item, r.cantidad, familia?.id || null, r.codigo,
                             costo_hh, costo_energia, costo_mp_total, costo_total, r.precio_unitario, margen, r.fecha_creacion || new Date().toISOString()]
                        );
                        const ordenId = result.rows[0].id;

                        // Insertar pasos en cola_produccion_pasos
                        for (let s = 0; s < estacionesFinales.length; s++) {
                            await query(
                                'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, $4)',
                                [ordenId, estacionesFinales[s], s + 1, 'PENDIENTE']
                            );
                            resultados.pasos_creados++;
                        }
                        resultados.importadas++;
                        resultados.costos_calculados++;
                    }
                } else {
                    // Sin receta BOM → orden directa
                    const costo_hh = familia ? Number(familia.costo_hh) : 0;
                    const costo_energia = familia ? Number(familia.costo_energia) : 0;
                    const precio_sap = r.precio_unitario * r.cantidad;
                    const costo_total = costo_hh + costo_energia;
                    const margen = precio_sap - costo_total;

                    const result = await query(
                        `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                         es_compuesto, tipo_venta, item_numero, cantidad, familia_id,
                         costo_hh, costo_energia, costo_materia_prima, costo_total_estimado, precio_unitario_sap, margen_estimado, created_at)
                         VALUES ($1,$2,$3,$4,$5,$6,$7,FALSE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
                        [r.pedido, r.cliente, r.codigo, r.descripcion, r.ancho, r.alto, m2,
                         r.tipo_venta, r.item, r.cantidad, familia?.id || null,
                         costo_hh, costo_energia, 0, costo_total, r.precio_unitario, margen, r.fecha_creacion || new Date().toISOString()]
                    );
                    const ordenId = result.rows[0].id;

                    for (let s = 0; s < estacionesFinales.length; s++) {
                        await query(
                            'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, $4)',
                            [ordenId, estacionesFinales[s], s + 1, 'PENDIENTE']
                        );
                        resultados.pasos_creados++;
                    }
                    resultados.importadas++;
                    if (familia) resultados.costos_calculados++;
                }
            } catch(eRow) {
                console.error('[PROD] Error en fila', key, ':', eRow.message, eRow.stack);
                resultados.errores.push({ fila: key, error: eRow.message });
            }
        }

        console.log('[PROD] Importacion completada:', resultados);
        json(res, resultados);
        return;
    }

    // =====================================================
    // PRODUCCION - Notas personales por usuario
    // =====================================================

    // GET /api/produccion/notas - Obtener notas del usuario
    if (urlPath === '/api/produccion/notas' && req.method === 'GET') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return; }
        try {
            const result = await query(
                'SELECT * FROM prod_notas WHERE usuario_email = $1 ORDER BY fecha_creacion DESC',
                [userEmail]
            );
            json(res, result.rows);
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // POST /api/produccion/notas - Crear nota
    if (urlPath === '/api/produccion/notas' && req.method === 'POST') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return; }
        const body = await parseBody(req);
        const { nota } = body;
        if (!nota || !nota.trim()) { json(res, { error: 'Nota requerida' }, 400); return; }
        try {
            const result = await query(
                'INSERT INTO prod_notas (usuario_email, nota, estado) VALUES ($1, $2, $3) RETURNING *',
                [userEmail, nota.trim(), 'pendiente']
            );
            json(res, result.rows[0]);
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // PUT /api/produccion/notas/:id - Actualizar nota (cambiar estado)
    if (urlPath.match(/^\/api\/produccion\/notas\/\d+$/) && req.method === 'PUT') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return; }
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        const { estado } = body;
        try {
            let result;
            if (estado === 'realizado') {
                result = await query(
                    'UPDATE prod_notas SET estado = $1, fecha_completado = CURRENT_TIMESTAMP WHERE id = $2 AND usuario_email = $3 RETURNING *',
                    [estado, id, userEmail]
                );
            } else {
                result = await query(
                    'UPDATE prod_notas SET estado = $1, fecha_completado = NULL WHERE id = $2 AND usuario_email = $3 RETURNING *',
                    [estado, id, userEmail]
                );
            }
            if (result.rows.length === 0) { json(res, { error: 'Nota no encontrada' }, 404); return; }
            json(res, result.rows[0]);
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // DELETE /api/produccion/notas/:id - Eliminar nota
    if (urlPath.match(/^\/api\/produccion\/notas\/\d+$/) && req.method === 'DELETE') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return; }
        const id = parseInt(urlPath.split('/').pop());
        try {
            await query('DELETE FROM prod_notas WHERE id = $1 AND usuario_email = $2', [id, userEmail]);
            json(res, { ok: true });
        } catch(e) { json(res, { error: e.message }, 500); }
        return;
    }

    // =====================================================
    // ARCHIVOS ESTÁTICOS
    // =====================================================
    serveStatic(res, urlPath);
});

const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, methods: ['GET', 'POST'] }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
        console.log('Cliente desconectado:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
        console.log('R2: Configurado correctamente');
    } else {
        console.warn('R2: NO configurado. Variables faltantes:', [
            !R2_ACCOUNT_ID && 'R2_ACCOUNT_ID',
            !R2_ACCESS_KEY_ID && 'R2_ACCESS_KEY_ID',
            !R2_SECRET_ACCESS_KEY && 'R2_SECRET_ACCESS_KEY'
        ].filter(Boolean).join(', '));
    }
});
