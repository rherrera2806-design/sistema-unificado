const express = require('express');
const path = require('path');

const { initDB } = require('./config/database');
const { setSecurityHeaders, checkGlobalRateLimit } = require('./middleware/security');
const { logger, requestLogger } = require('./config/logger');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', '..', 'web', 'public');

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://vitroflow.up.railway.app,https://sistema-unified-production.up.railway.app,http://localhost:3000').split(',').map(s => s.trim());

let dbReady = false;
let dbError = null;

initDB().then(() => {
    dbReady = true;
    logger.info('Base de datos: PostgreSQL conectada');
}).catch(e => {
    dbError = e.message;
    logger.error('Error DB:', { message: e.message, stack: e.stack });
});

const app = express();
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(requestLogger);

app.use((req, res, next) => {
    setSecurityHeaders(res);
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-User-Permisos, X-User-Email');
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

app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    if (!dbReady && !dbError) return res.status(503).json({ error: 'Base de datos inicializando...' });
    if (dbError) return res.status(500).json({ error: dbError });
    next();
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', db: dbReady ? 'connected' : dbError ? 'error' : 'initializing', version: '5.0.0' });
});

app.use(require('./routes/router'));

app.use(express.static(PUBLIC_DIR));
app.get('/{*path}', (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { message: err.message, stack: err.stack, path: req.path });
    res.status(500).json({ error: 'Error interno del servidor' });
});

const server = app.listen(PORT, () => {
    logger.info(`Servidor corriendo en puerto ${PORT}`);
    const { query } = require('./config/dbPool');
    query('CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_fecha ON pedidos(fecha_subida DESC)').catch(() => {});
    query('CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor)').catch(() => {});
});

module.exports = { app, server };
