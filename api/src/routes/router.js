const { query } = require('../config/database');
const { parseBody, json } = require('../middleware/parser');
const { sanitizeObject } = require('../utils/helpers');
const { R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, r2Sign, r2CurlUpload } = require('../config/r2');

const sigmaService = require('../services/sigma');
const catalogosService = require('../services/catalogos');
const inventarioService = require('../services/inventario');
const authService = require('../services/auth');
const turnosService = require('../services/turnos');

async function handleRoute(req, res, urlPath, q) {
    // AUTH
    if (urlPath === '/api/auth/login' && req.method === 'POST') {
        const body = await parseBody(req);
        const email = (body.email || '').replace(/[<>]/g, '').trim();
        const password = body.password;
        if (!email || !password) { json(res, { error: 'Email y contrasena requeridos' }, 400); return true; }
        const user = await authService.login(email, password);
        if (!user) { json(res, { error: 'Credenciales invalidas' }, 401); return true; }
        const { createSession, SESSION_TTL } = require('../middleware/security');
        const token = createSession(user);
        const isSecure = req.headers.host && !req.headers.host.includes('localhost');
        const cookieValue = `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}${isSecure ? '; Secure' : ''}`;
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': cookieValue });
        res.end(JSON.stringify(user));
        return true;
    }
    if (urlPath === '/api/auth/verify-password' && req.method === 'POST') {
        const body = await parseBody(req);
        const { email, password } = body;
        if (!email || !password) { json(res, { ok: false }, 400); return true; }
        try {
            const result = await query("SELECT password FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
            if (result.rows.length === 0) { json(res, { ok: false }, 401); return true; }
            const { verifyPassword } = require('../config/database');
            const verification = verifyPassword(password, result.rows[0].password);
            if (!verification) { json(res, { ok: false }, 401); return true; }
            json(res, { ok: true });
        } catch(e) { json(res, { ok: false }, 500); }
        return true;
    }
    if (urlPath === '/api/auth/me' && req.method === 'GET') {
        const { getSession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        const user = getSession(token);
        if (!user) { json(res, { error: 'No autenticado' }, 401); return true; }
        json(res, user);
        return true;
    }
    if (urlPath === '/api/auth/logout' && req.method === 'POST') {
        const { destroySession } = require('../middleware/security');
        const cookieHeader = req.headers.cookie || '';
        const sessionCookie = cookieHeader.split(';').find(c => c.trim().startsWith('session='));
        const token = sessionCookie ? sessionCookie.split('=')[1].trim() : null;
        destroySession(token);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Set-Cookie': 'session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
        res.end(JSON.stringify({ ok: true }));
        return true;
    }

    // HEALTH
    if (urlPath === '/api/health') {
        json(res, { status: 'ok', version: '4.0.0', modules: ['sigma', 'inventario', 'turnos', 'pedidos', 'produccion', 'instalaciones'] });
        return true;
    }

    // USUARIOS
    if (urlPath === '/api/usuarios' && req.method === 'GET') {
        json(res, await authService.getUsuarios());
        return true;
    }
    if (urlPath === '/api/usuarios' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await authService.crearUsuario(body), 201); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath.match(/^\/api\/usuarios\/\d+$/) && req.method === 'PUT') {
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        try { json(res, await authService.updateUsuario(id, body)); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath.match(/^\/api\/usuarios\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        json(res, { ok: await authService.eliminarUsuario(id) });
        return true;
    }

    // CATALOGOS
    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'GET') {
        json(res, await catalogosService.getTiposCristal());
        return true;
    }
    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await catalogosService.crearTipoCristal(body), 201); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const tipoCristalMatch = urlPath.match(/^\/api\/catalogos\/tipos-cristal\/(\d+)$/);
    if (tipoCristalMatch && req.method === 'PUT') {
        const id = Number(tipoCristalMatch[1]);
        const body = await parseBody(req);
        const item = await catalogosService.updateTipoCristal(id, body);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, item);
        return true;
    }
    if (tipoCristalMatch && req.method === 'DELETE') {
        const id = Number(tipoCristalMatch[1]);
        const item = await catalogosService.eliminarTipoCristal(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, { ok: true, item });
        return true;
    }
    if (urlPath === '/api/catalogos/espesores' && req.method === 'GET') {
        json(res, await catalogosService.getEspesores());
        return true;
    }
    if (urlPath === '/api/catalogos/espesores' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await catalogosService.crearEspesor(body.valor), 201); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const espesorMatch = urlPath.match(/^\/api\/catalogos\/espesores\/(\d+)$/);
    if (espesorMatch && req.method === 'DELETE') {
        const id = Number(espesorMatch[1]);
        const item = await catalogosService.eliminarEspesor(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, { ok: true, item });
        return true;
    }

    // INVENTARIO
    if (urlPath === '/api/inv/movimientos' && req.method === 'GET') {
        json(res, await inventarioService.getMovimientos(q));
        return true;
    }
    if (urlPath === '/api/inv/movimientos' && req.method === 'POST') {
        const body = await parseBody(req);
        const sanitized = sanitizeObject(body);
        try { json(res, await inventarioService.crearMovimiento(sanitized), 201); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const movMatch = urlPath.match(/^\/api\/inv\/movimientos\/(\d+)$/);
    if (movMatch && req.method === 'DELETE') {
        const id = Number(movMatch[1]);
        await inventarioService.eliminarMovimiento(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath === '/api/inv/inventario' && req.method === 'GET') {
        json(res, await inventarioService.getInventario(q));
        return true;
    }
    if (urlPath === '/api/inv/estadisticas' && req.method === 'GET') {
        json(res, await inventarioService.getEstadisticas());
        return true;
    }
    if (urlPath === '/api/inv/estadisticas-por-tipo' && req.method === 'GET') {
        json(res, await inventarioService.getEstadisticasPorTipo());
        return true;
    }
    if (urlPath === '/api/inv/autonomia' && req.method === 'GET') {
        json(res, await catalogosService.getAutonomia());
        return true;
    }
    if (urlPath === '/api/inv/alertas' && req.method === 'GET') {
        json(res, await catalogosService.getAlertas());
        return true;
    }

    // SIGMA
    if (urlPath === '/api/sigma/stats' && req.method === 'GET') {
        json(res, await sigmaService.getSigmaStats());
        return true;
    }
    const sigmaCollectionMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)$/);
    if (sigmaCollectionMatch && req.method === 'GET') {
        try { json(res, await sigmaService.getAll(sigmaCollectionMatch[1])); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const sigmaByIdMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)\/(\d+)$/);
    if (sigmaByIdMatch && req.method === 'GET') {
        try {
            const item = await sigmaService.getById(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]));
            if (!item) return json(res, { error: 'No encontrado' }, 404), true;
            json(res, item);
        } catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaCollectionMatch && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await sigmaService.insert(sigmaCollectionMatch[1], body), 201); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaByIdMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try { json(res, await sigmaService.update(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]), body)); }
        catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaByIdMatch && req.method === 'DELETE') {
        try {
            const ok = await sigmaService.del(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]));
            if (!ok) return json(res, { error: 'No encontrado' }, 404), true;
            json(res, { ok: true });
        } catch(e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath === '/api/sigma/export' && req.method === 'GET') {
        json(res, await sigmaService.exportJSON());
        return true;
    }
    if (urlPath === '/api/sigma/import' && req.method === 'POST') {
        const body = await parseBody(req);
        await sigmaService.importJSON(body);
        json(res, { ok: true });
        return true;
    }
    if (urlPath === '/api/sigma/clear' && req.method === 'POST') {
        await sigmaService.clearAllSigma();
        json(res, { ok: true });
        return true;
    }

    // TURNOS
    if (urlPath === '/api/turnos/stats' && req.method === 'GET') {
        json(res, await turnosService.getTurnosStats());
        return true;
    }
    if (urlPath === '/api/turnos/actual' && req.method === 'GET') {
        json(res, await turnosService.getTurnoActual());
        return true;
    }
    if (urlPath === '/api/turnos/cola' && req.method === 'GET') {
        json(res, await turnosService.getCola());
        return true;
    }
    if (urlPath === '/api/turnos' && req.method === 'POST') {
        const body = await parseBody(req);
        json(res, await turnosService.crearTurno(body), 201);
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+\/llamar$/) && req.method === 'POST') {
        const id = parseInt(urlPath.split('/')[3]);
        await turnosService.llamarTurno(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+\/finalizar$/) && req.method === 'POST') {
        const id = parseInt(urlPath.split('/')[3]);
        await turnosService.finalizarTurno(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await turnosService.eliminarTurno(id);
        json(res, { ok: true });
        return true;
    }

    // R2
    if (urlPath === '/api/r2/upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return true; }
        const body = await parseBody(req);
        const { fileName } = body;
        if (!fileName) { json(res, { error: 'fileName requerido' }, 400); return true; }
        const key = `pedidos/${fileName}`;
        json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        return true;
    }
    if (urlPath === '/api/r2/direct-upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return true; }
        const body = await parseBody(req);
        const { fileName, fileBase64 } = body;
        if (!fileName || !fileBase64) { json(res, { error: 'fileName y fileBase64 requeridos' }, 400); return true; }
        try {
            const key = `pedidos/${fileName}`;
            const buffer = Buffer.from(fileBase64, 'base64');
            await r2CurlUpload(key, buffer);
            json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        } catch(e) { json(res, { error: 'Error al subir' }, 500); }
        return true;
    }
    if (urlPath === '/api/r2/test' && req.method === 'GET') {
        json(res, { ok: R2_ACCESS_KEY_ID ? true : false, bucket: R2_BUCKET_NAME });
        return true;
    }

    // PEDIDOS - (kept inline for now due to complexity)
    if (urlPath === '/api/pedidos' && req.method === 'GET') {
        const userEmail = req.headers['x-user-email'] || '';
        const userPerm = req.headers['x-user-permisos'] || '';
        const esAdmin = userPerm.includes('pedidos.autorizar') || userPerm.includes('usuarios');
        const joinQuery = `SELECT p.*, v.nombre AS vendedor_nombre, r.nombre AS revisor_nombre
            FROM pedidos p LEFT JOIN usuarios u ON u.email = p.vendedor
            LEFT JOIN usuarios v ON v.email = p.vendedor LEFT JOIN usuarios r ON r.email = p.revisado_por`;
        const result = esAdmin
            ? await query(joinQuery + ' ORDER BY p.fecha_subida DESC')
            : await query(joinQuery + ' WHERE p.vendedor = $1 ORDER BY p.fecha_subida DESC', [userEmail]);
        json(res, result.rows);
        return true;
    }
    if (urlPath === '/api/pedidos' && req.method === 'POST') {
        const body = await parseBody(req);
        const { numero_pedido, cliente, vendedor, archivo_url, pdf_base64 } = body;
        if (!numero_pedido || !cliente) { json(res, { error: 'Numero de pedido y cliente requeridos' }, 400); return true; }
        let pdfBuffer = null;
        if (pdf_base64) {
            pdfBuffer = Buffer.from(pdf_base64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
        }
        const result = await query(
            'INSERT INTO pedidos (numero_pedido, cliente, vendedor, archivo_url, archivo_pdf, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [numero_pedido, cliente, vendedor || '', archivo_url || '', pdfBuffer, 'pendiente']
        );
        json(res, result.rows[0], 201);
        return true;
    }
    const pedidoPdfMatch = urlPath.match(/^\/api\/pedidos\/(\d+)\/pdf$/);
    if (pedidoPdfMatch && req.method === 'GET') {
        const id = Number(pedidoPdfMatch[1]);
        const result = await query('SELECT archivo_pdf, archivo_url, numero_pedido FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return true; }
        const row = result.rows[0];
        if (row.archivo_pdf) {
            res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${row.numero_pedido}.pdf"`, 'Cache-Control': 'public, max-age=3600' });
            res.end(row.archivo_pdf);
        } else if (row.archivo_url) {
            res.writeHead(302, { 'Location': row.archivo_url }); res.end();
        } else { json(res, { error: 'PDF no disponible' }, 404); }
        return true;
    }
    const updatePedidoMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (updatePedidoMatch && req.method === 'PUT') {
        const id = Number(updatePedidoMatch[1]);
        const body = await parseBody(req);
        const { estado, motivo_rechazo, revisado_por } = body;
        if (!estado || !['aprobado', 'rechazado'].includes(estado)) { json(res, { error: 'Estado debe ser aprobado o rechazado' }, 400); return true; }
        const result = await query('UPDATE pedidos SET estado = $1, motivo_rechazo = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [estado, motivo_rechazo || null, revisado_por || '', id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return true; }
        json(res, result.rows[0]);
        return true;
    }
    const deletePedidoMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (deletePedidoMatch && req.method === 'DELETE') {
        const userPerms = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);
        if (!userPerms.includes('usuarios')) { json(res, { error: 'Sin permisos' }, 403); return true; }
        const id = Number(deletePedidoMatch[1]);
        await query('DELETE FROM pedidos WHERE id = $1', [id]);
        json(res, { ok: true });
        return true;
    }

    return false;
}

module.exports = { handleRoute };
