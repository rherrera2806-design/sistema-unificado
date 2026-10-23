const express = require('express');
const path = require('path');

const { initDB } = require('./config/database');
const { setSecurityHeaders, checkGlobalRateLimit } = require('./middleware/security');
const { logger, requestLogger } = require('./config/logger');
const eventos = require('./services/eventos');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', '..', 'web', 'public');
// App de planta (mobile/app): se sirve también por web bajo /planta para poder
// probarla en el navegador del celular antes de instalar el APK.
const MOBILE_DIR = path.join(__dirname, '..', '..', 'mobile', 'app');

// https://localhost y capacitor://localhost = origen del WebView de la app
// móvil Capacitor (Android e iOS respectivamente). Se agregan SIEMPRE a la
// lista: si la variable ALLOWED_ORIGINS existe en Railway sobrescribe el valor
// por defecto y, sin estos orígenes, la app no puede hacer login.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://vitroflow.up.railway.app,https://sistema-unified-production.up.railway.app,http://localhost:3000').split(',').map(s => s.trim());
for (const origenApp of ['https://localhost', 'capacitor://localhost']) {
    if (!ALLOWED_ORIGINS.includes(origenApp)) ALLOWED_ORIGINS.push(origenApp);
}

let dbReady = false;
let dbError = null;
let dbInitPromise = null;
const startDbInit = () => {
    if (dbInitPromise) return dbInitPromise;
    dbInitPromise = initDB().then(() => {
        dbReady = true;
        logger.info('Base de datos: PostgreSQL conectada');
    }).catch(e => {
        dbError = e.message;
        logger.error('Error DB:', { message: e.message, stack: e.stack });
    });
    return dbInitPromise;
};
startDbInit();

const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(requestLogger);

app.use((req, res, next) => {
    setSecurityHeaders(res);
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // Se aceptan los headers que el cliente pida en el preflight (además de los
    // habituales). Sin esto, headers nuevos como X-Turno (app de planta) hacen
    // que el navegador corte la petición y la app muestre "error de red".
    res.setHeader('Access-Control-Allow-Headers',
        req.headers['access-control-request-headers'] || 'Content-Type, Authorization, X-User-Permisos, X-User-Email, X-Turno');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    next();
});

app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    if (req.path === '/api/auth/login') return next();
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (!checkGlobalRateLimit(clientIp)) {
        logger.warn('Rate limit exceeded', { ip: clientIp, path: req.path });
        return res.status(429).json({ error: 'Demasiadas peticiones. Espera 1 minuto.' });
    }
    next();
});

app.use(async (req, res, next) => {
    if (req.path === '/api/health') return next();
    try {
        await dbInitPromise;
        if (dbError) return res.status(503).json({ error: 'Base de datos no disponible: ' + dbError });
        next();
    } catch (e) {
        res.status(503).json({ error: 'Base de datos no disponible: ' + e.message });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: dbReady ? 'connected' : dbError ? 'error' : 'initializing', version: '5.0.0' });
});

app.use(require('./routes/router'));

// App de planta bajo /planta/ (la misma que se empaqueta en el APK de Android)
app.use('/planta', express.static(MOBILE_DIR, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));

// HTML sin caché (no-cache = revalida siempre): sin esto, el navegador guarda
// un app.html viejo que apunta a los módulos con ?v= antiguos y cada deploy se
// ve recién tras un Ctrl+F5. Los demás estáticos (js/css con ?v=) sí cachean.
app.use(express.static(PUBLIC_DIR, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
    }
}));
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
    // Los servicios pueden marcar errores de negocio con err.status (404, 409, etc.)
    const status = Number.isInteger(err.status) ? err.status : 500;
    if (status >= 500) {
        logger.error('Unhandled error:', { message: err.message, stack: err.stack, path: req.path });
    } else {
        logger.warn('Business error:', { message: err.message, status, path: req.path });
    }
    res.status(status).json({ error: err.message || 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto ${PORT}`);
    const { query } = require('./config/dbPool');
    query('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_subida DESC)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor)').catch(() => {});

    // Recordatorio de permisos para desarrolladores
    console.log('\n' + '='.repeat(70));
    console.log('⚠️  RECORDATORIO DE PERMISOS - VitroFlow');
    console.log('='.repeat(70));
    console.log('Si creaste un NUEVO módulo/submódulo/formulario:');
    console.log('  1. Agregar permisos en dbSchema.js (ALL_PERMS)');
    console.log('  2. Agregar middleware en routes/tu_archivo.js');
    console.log('  3. Verificar botones en frontend (canCreate/canEdit/canDelete)');
    console.log('  4. Agregar en sidebar (app-main.js SIDEBAR_SECTIONS)');
    console.log('');
    console.log('Tipos de permisos:');
    console.log('  - modulo          → Ver (GET)');
    console.log('  - modulo.agregar  → Crear (POST)');
    console.log('  - modulo.editar   → Editar (PUT)');
    console.log('  - modulo.eliminar → Eliminar (DELETE)');
    console.log('');
    console.log('Lee PERMISOS_CHECKLIST.md para más detalles');
    console.log('='.repeat(70) + '\n');
});

// ===== Socket.IO: eventos en vivo para el dashboard de planta =====
// El dashboard (web/public/dashboard) se conecta y refresca cuando llega
// 'dashboard:update' — emitido desde los endpoints que cambian producción.
const { Server } = require('socket.io');
const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGINS, credentials: true }
});
io.use((socket, next) => {
    // Misma identidad que la web: cookie 'session=' o Authorization Bearer.
    const { getSession, getTokenFromReq } = require('./middleware/security');
    const user = getSession(getTokenFromReq(socket.request));
    if (!user) return next(new Error('No autenticado'));
    socket.user = user;
    next();
});
eventos.setIo(io);
logger.info('Socket.IO listo para el dashboard de planta');

module.exports = { app, server, io };
