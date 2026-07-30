const http = require('http');
const fs = require('fs');
const path = require('path');
const { Server } = require('socket.io');

const { initDB } = require('./config/database');
const { MIME } = require('./config/constants');
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', '..', 'web', 'public');

const { setSecurityHeaders, checkGlobalRateLimit } = require('./middleware/security');
const { json, parseQuery, compressAndSend } = require('./middleware/parser');
const { handleRoute } = require('./routes/router');

const PORT = process.env.PORT || 3000;

function serveStatic(res, urlPath) {
    let filePath = path.join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
    }
    if (!fs.existsSync(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');
    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
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
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

    const { path: urlPath, query: q } = parseQuery(req.url);

    if (urlPath === '/api/health') {
        json(res, { status: 'ok', db: dbReady ? 'connected' : dbError ? 'error' : 'initializing', version: '4.0.0' });
        return;
    }

    if (req.url !== '/api/auth/login') {
        if (!checkGlobalRateLimit(clientIp)) {
            json(res, { error: 'Demasiadas peticiones. Espera 1 minuto.' }, 429);
            return;
        }
    }

    if (!dbReady && !dbError) { json(res, { error: 'Base de datos inicializando...' }, 503); return; }
    if (dbError) { json(res, { error: dbError }, 500); return; }

    try {
        const handled = await handleRoute(req, res, urlPath, q);
        if (handled) return;
    } catch(e) {
        console.error('Route error:', e.message);
        json(res, { error: e.message }, 500);
        return;
    }

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
});
