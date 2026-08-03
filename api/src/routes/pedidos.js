const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { validate, pedidosSchema } = require('../middleware/validate');

router.get('/api/pedidos/dashboard', async (req, res, next) => {
    try {
        const [total, pendientes, aprobados, rechazados] = await Promise.all([
            query('SELECT COUNT(*) as c FROM pedidos'),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'pendiente'"),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'aprobado'"),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'rechazado'")
        ]);
        res.json({
            total: Number(total.rows[0].c),
            pendientes: Number(pendientes.rows[0].c),
            aprobados: Number(aprobados.rows[0].c),
            rechazados: Number(rechazados.rows[0].c)
        });
    } catch (e) { next(e); }
});

router.get('/api/pedidos', async (req, res, next) => {
    try {
        const userEmail = req.headers['x-user-email'] || '';
        const userPerm = req.headers['x-user-permisos'] || '';
        const esAdmin = userPerm.includes('pedidos.editar') || userPerm.includes('pedidos.autorizar') || userPerm.includes('usuarios');
        const joinQuery = `SELECT p.*, v.nombre AS vendedor_nombre, r.nombre AS revisor_nombre
            FROM pedidos p LEFT JOIN usuarios u ON u.email = p.vendedor
            LEFT JOIN usuarios v ON v.email = p.vendedor LEFT JOIN usuarios r ON r.email = p.revisado_por`;
        const result = esAdmin
            ? await query(joinQuery + ' ORDER BY p.fecha_subida DESC')
            : await query(joinQuery + ' WHERE p.vendedor = $1 ORDER BY p.fecha_subida DESC', [userEmail]);
        res.json(result.rows);
    } catch (e) { next(e); }
});

router.post('/api/pedidos', validate(pedidosSchema), async (req, res, next) => {
    try {
        const { numero_pedido, cliente, vendedor, archivo_url, pdf_base64 } = req.body;
        let pdfBuffer = null;
        if (pdf_base64) {
            pdfBuffer = Buffer.from(pdf_base64.replace(/^data:application\/pdf;base64,/, ''), 'base64');
        }
        const result = await query(
            'INSERT INTO pedidos (numero_pedido, cliente, vendedor, archivo_url, archivo_pdf, estado) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [numero_pedido, cliente, vendedor || '', archivo_url || '', pdfBuffer, 'pendiente']
        );
        res.status(201).json(result.rows[0]);
    } catch (e) { next(e); }
});

router.get('/api/pedidos/:id/pdf', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const result = await query('SELECT archivo_pdf, archivo_url, numero_pedido FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        const row = result.rows[0];
        if (row.archivo_pdf) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename="${row.numero_pedido}.pdf"`);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.end(row.archivo_pdf);
        } else if (row.archivo_url) {
            res.redirect(row.archivo_url);
        } else { res.status(404).json({ error: 'PDF no disponible' }); }
    } catch (e) { next(e); }
});

router.get('/api/pedidos/:id/download-pdf', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const result = await query('SELECT archivo_pdf, archivo_url, numero_pedido FROM pedidos WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        const row = result.rows[0];
        if (row.archivo_pdf) {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${row.numero_pedido}.pdf"`);
            res.end(row.archivo_pdf);
        } else if (row.archivo_url) {
            res.redirect(row.archivo_url);
        } else { res.status(404).json({ error: 'PDF no disponible' }); }
    } catch (e) { next(e); }
});

router.get('/api/pedidos/:id', async (req, res, next) => {
    try {
        const result = await query('SELECT * FROM pedidos WHERE id = $1', [Number(req.params.id)]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

router.put('/api/pedidos/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { estado, motivo_rechazo, revisado_por } = req.body;
        if (!estado || !['aprobado', 'rechazado'].includes(estado)) {
            return res.status(400).json({ error: 'Estado debe ser aprobado o rechazado' });
        }
        const result = await query(
            'UPDATE pedidos SET estado = $1, motivo_rechazo = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *',
            [estado, motivo_rechazo || null, revisado_por || '', id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

router.delete('/api/pedidos/:id', async (req, res, next) => {
    try {
        const userPerms = (req.headers['x-user-permisos'] || '').split(',').filter(Boolean);
        if (!userPerms.includes('usuarios')) return res.status(403).json({ error: 'Sin permisos' });
        await query('DELETE FROM pedidos WHERE id = $1', [Number(req.params.id)]);
        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;
