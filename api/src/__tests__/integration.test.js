const http = require('http');

let server;
let baseUrl;
let dbAvailable = false;

async function makeRequest(method, urlPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, baseUrl);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
                catch { resolve({ status: res.statusCode, body: data }); }
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

beforeAll(async () => {
    process.env.PORT = '0';
    const mod = require('../index');
    server = mod.server;
    await new Promise(resolve => setTimeout(resolve, 3000));
    const addr = server.address();
    baseUrl = `http://127.0.0.1:${addr.port}`;
    try {
        const health = await makeRequest('GET', '/api/health');
        dbAvailable = health.body.db === 'connected';
    } catch { dbAvailable = false; }
}, 15000);

afterAll(() => { if (server) server.close(); });

const ifDb = dbAvailable ? describe : describe.skip;

describe('Health Check', () => {
    it('GET /api/health returns ok', async () => {
        const res = await makeRequest('GET', '/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.version).toBeDefined();
    });
});

ifDb('Auth (requires DB)', () => {
    it('POST /api/auth/login with valid credentials', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {
            email: 'admin@vidrieria.com', password: 'admin123'
        });
        expect(res.status).toBe(200);
        expect(res.body.user.email).toBe('admin@vidrieria.com');
    });

    it('POST /api/auth/login with invalid credentials', async () => {
        const res = await makeRequest('POST', '/api/auth/login', {
            email: 'wrong@email.com', password: 'wrong'
        });
        expect(res.status).toBe(401);
    });
});

ifDb('SIGMA (requires DB)', () => {
    it('GET /api/sigma/stats', async () => {
        const res = await makeRequest('GET', '/api/sigma/stats');
        expect(res.status).toBe(200);
        expect(res.body.totalMachines).toBeGreaterThanOrEqual(0);
    });

    it('GET /api/sigma/machines returns array', async () => {
        const res = await makeRequest('GET', '/api/sigma/machines');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/sigma/stats/summary', async () => {
        const res = await makeRequest('GET', '/api/sigma/stats/summary');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('totalMachines');
    });

    it('GET /api/sigma/reports/overdue', async () => {
        const res = await makeRequest('GET', '/api/sigma/reports/overdue');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

ifDb('Turnos (requires DB)', () => {
    it('GET /api/turnos/estado', async () => {
        const res = await makeRequest('GET', '/api/turnos/estado');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('enEspera');
    });

    it('GET /api/turnos/cola', async () => {
        const res = await makeRequest('GET', '/api/turnos/cola');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

ifDb('Pedidos (requires DB)', () => {
    it('GET /api/pedidos returns array', async () => {
        const res = await makeRequest('GET', '/api/pedidos');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('POST /api/pedidos with valid data', async () => {
        const res = await makeRequest('POST', '/api/pedidos', {
            numero_pedido: 'INT-TEST-001', cliente: 'Integration Test'
        });
        expect(res.status).toBe(201);
        expect(res.body.numero_pedido).toBe('INT-TEST-001');
    });

    it('POST /api/pedidos missing fields returns 400', async () => {
        const res = await makeRequest('POST', '/api/pedidos', {});
        expect(res.status).toBe(400);
    });
});

ifDb('Produccion (requires DB)', () => {
    it('GET /api/produccion/ordenes', async () => {
        const res = await makeRequest('GET', '/api/produccion/ordenes');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/produccion/maquinas', async () => {
        const res = await makeRequest('GET', '/api/produccion/maquinas');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

ifDb('Catalogos (requires DB)', () => {
    it('GET /api/catalogos/tipos-cristal', async () => {
        const res = await makeRequest('GET', '/api/catalogos/tipos-cristal');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });

    it('GET /api/catalogos/espesores', async () => {
        const res = await makeRequest('GET', '/api/catalogos/espesores');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});
