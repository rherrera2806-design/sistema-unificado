const { query } = require('../config/database');
const { parseBody, json } = require('../middleware/parser');

const handlePedidos = async (req, res, urlPath) => {
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

    const pedidoIdMatch = urlPath.match(/^\/api\/pedidos\/(\d+)$/);
    if (pedidoIdMatch && req.method === 'GET') {
        const id = Number(pedidoIdMatch[1]);
        const result = await query('SELECT * FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return true; }
        json(res, result.rows[0]);
        return true;
    }

    if (pedidoIdMatch && req.method === 'PUT') {
        const id = Number(pedidoIdMatch[1]);
        const body = await parseBody(req);
        const { estado, motivo_rechazo, revisado_por } = body;
        if (!estado || !['aprobado', 'rechazado'].includes(estado)) { json(res, { error: 'Estado debe ser aprobado o rechazado' }, 400); return true; }
        const result = await query('UPDATE pedidos SET estado = $1, motivo_rechazo = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [estado, motivo_rechazo || null, revisado_por || '', id]);
        if (result.rows.length === 0) { json(res, { error: 'Pedido no encontrado' }, 404); return true; }
        json(res, result.rows[0]);
        return true;
    }

    if (pedidoIdMatch && req.method === 'DELETE') {
        const userPerms = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);
        if (!userPerms.includes('usuarios')) { json(res, { error: 'Sin permisos' }, 403); return true; }
        const id = Number(pedidoIdMatch[1]);
        await query('DELETE FROM pedidos WHERE id = $1', [id]);
        json(res, { ok: true });
        return true;
    }

    return false;
};

module.exports = { handlePedidos };
