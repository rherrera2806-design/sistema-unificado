const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../config/database');
const { validate, pedidosSchema } = require('../middleware/validate');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
        const joinQuery = `SELECT p.id, p.numero_pedido, p.cliente, p.vendedor, p.tipo_ov, p.estado, p.motivo_rechazo,
            p.fecha_subida, p.fecha_revision, p.revisado_por, p.archivo_url,
            v.nombre AS vendedor_nombre, r.nombre AS revisor_nombre
            FROM pedidos p LEFT JOIN usuarios v ON v.email = p.vendedor
            LEFT JOIN usuarios r ON r.email = p.revisado_por`;
        const result = esAdmin
            ? await query(joinQuery + ' ORDER BY p.fecha_subida DESC')
            : await query(joinQuery + ' WHERE p.vendedor = $1 ORDER BY p.fecha_subida DESC', [userEmail]);
        res.json(result.rows);
    } catch (e) { next(e); }
});

router.post('/api/pedidos', upload.single('archivo_pdf'), async (req, res, next) => {
    try {
        const { numero_pedido, cliente, tipo_ov, vendedor, archivo_url } = req.body;
        if (!numero_pedido || !cliente) return res.status(400).json({ error: 'Numero y cliente son requeridos' });
        const exists = await query('SELECT id FROM pedidos WHERE numero_pedido = $1 LIMIT 1', [numero_pedido]);
        if (exists.rows.length > 0) return res.status(400).json({ error: 'Ya existe un pedido con este número' });
        const pdfBuffer = req.file ? req.file.buffer : null;
        const result = await query(
            'INSERT INTO pedidos (numero_pedido, cliente, tipo_ov, vendedor, archivo_url, archivo_pdf, estado) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [numero_pedido, cliente, tipo_ov || 'Normal', vendedor || '', archivo_url || '', pdfBuffer, 'pendiente']
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

router.get('/api/pedidos/:id/historial', async (req, res, next) => {
    try {
        const result = await query(
            'SELECT id, accion, campos_antes, campos_despues, usuario, created_at FROM pedido_historial WHERE pedido_id = $1 ORDER BY created_at DESC',
            [Number(req.params.id)]
        );
        res.json(result.rows);
    } catch (e) { next(e); }
});

router.post('/api/pedidos/cleanup-pdf', async (req, res, next) => {
    try {
        const result = await query("UPDATE pedidos SET archivo_pdf = NULL WHERE estado != 'pendiente' AND archivo_pdf IS NOT NULL");
        res.json({ ok: true, cleaned: result.rowCount });
    } catch (e) { next(e); }
});

router.put('/api/pedidos/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        const { estado, motivo_rechazo, revisado_por, cliente, tipo_ov, numero_pedido } = req.body;
        const user = req.headers['x-user-email'] || '';
        const beforeResult = await query('SELECT numero_pedido, cliente, tipo_ov, estado, motivo_rechazo, revisado_por FROM pedidos WHERE id = $1', [id]);
        const before = beforeResult.rows[0] || {};
        let result;
        if (estado && ['aprobado', 'rechazado'].includes(estado)) {
            result = await query(
                'UPDATE pedidos SET estado = $1, motivo_rechazo = $2, revisado_por = $3, fecha_revision = CURRENT_TIMESTAMP, archivo_pdf = NULL WHERE id = $4 RETURNING *',
                [estado, motivo_rechazo || null, revisado_por || '', id]
            );
        } else if (estado === 'pendiente' || cliente || tipo_ov || numero_pedido) {
            const fields = [];
            const values = [];
            let idx = 1;
            if (estado === 'pendiente') {
                fields.push('estado = $' + idx++); values.push('pendiente');
                fields.push('motivo_rechazo = NULL');
                fields.push('revisado_por = NULL');
                fields.push('fecha_revision = NULL');
            }
            if (numero_pedido) { fields.push('numero_pedido = $' + idx++); values.push(numero_pedido); }
            if (cliente) { fields.push('cliente = $' + idx++); values.push(cliente); }
            if (tipo_ov) { fields.push('tipo_ov = $' + idx++); values.push(tipo_ov); }
            values.push(id);
            result = await query('UPDATE pedidos SET ' + fields.join(', ') + ' WHERE id = $' + idx + ' RETURNING *', values);
        } else {
            return res.status(400).json({ error: 'Datos invalidos' });
        }
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        const after = result.rows[0];
        const changes = {};
        for (const key of ['numero_pedido', 'cliente', 'tipo_ov', 'estado', 'motivo_rechazo', 'revisado_por']) {
            if (before[key] !== undefined && before[key] !== after[key]) {
                changes[key] = { antes: before[key], despues: after[key] };
            }
        }
        if (Object.keys(changes).length > 0) {
            let accion = 'Edición';
            if (before.estado !== after.estado) {
                if (after.estado === 'aprobado') accion = 'Aprobado';
                else if (after.estado === 'rechazado') accion = 'Rechazado';
                else if (after.estado === 'pendiente') accion = 'Vuelto a pendiente';
            }
            await query(
                'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                [id, accion, JSON.stringify(before), JSON.stringify(changes), user]
            );
        }
        res.json(after);
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
