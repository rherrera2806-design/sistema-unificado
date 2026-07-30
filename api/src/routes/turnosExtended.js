const express = require('express');
const router = express.Router();
const { sanitizeString, validateRut, validatePatente } = require('../utils/helpers');
const { query } = require('../config/database');
const turnosFlujo = require('../services/turnosFlujo');
const turnosReportes = require('../services/turnosReportes');
const entregas = require('../services/entregas');
const turnosService = require('../services/turnos');

router.get('/api/turnos/estado', async (req, res, next) => {
    res.json(await turnosService.getTurnosStats());
});

router.post('/api/turnos/crear', async (req, res, next) => {
    const { nombre, rut = '', patente = '', motivo = 'Retirar', rut_empresa = '' } = req.body;
    const clean = { nombre: sanitizeString(nombre), rut: sanitizeString(rut), patente: sanitizeString(patente).toUpperCase().replace(/[^A-Z0-9]/g, ''), motivo: sanitizeString(motivo), rut_empresa: sanitizeString(rut_empresa) };
    if (!clean.nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (clean.rut && !validateRut(clean.rut)) return res.status(400).json({ error: 'RUT invalido. Verifica el formato.' });
    if (clean.patente && !validatePatente(clean.patente)) return res.status(400).json({ error: 'Patente invalida. Formato: AB1234 o ABCD12' });
    const hoy = turnosFlujo.hoyChile();
    const hora = turnosFlujo.horaActualChile();
    const numRow = await query('SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM turnos WHERE fecha = $1', [hoy]);
    const result = await query(
        'INSERT INTO turnos (nombre, numero, fecha, hora_creacion, rut, patente, motivo, rut_empresa) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [clean.nombre, numRow.rows[0].next, hoy, hora, clean.rut, clean.patente, clean.motivo, clean.rut_empresa]
    );
    res.status(201).json(result.rows[0]);
});

router.post('/api/turnos/siguiente', async (req, res, next) => {
    const siguiente = await turnosFlujo.llamarSiguiente();
    if (!siguiente) return res.status(400).json({ error: 'No hay turnos en espera' });
    res.json({ llamado: siguiente, ...await turnosService.getTurnosStats() });
});

router.get('/api/turnos/historial', async (req, res, next) => {
    res.json(await turnosReportes.getHistorialDelDia());
});

router.get('/api/turnos/reporte', async (req, res, next) => {
    res.json(await turnosReportes.getReporteCompleto(req.query.desde || '', req.query.hasta || ''));
});

router.get('/api/turnos/reporte-entregas', async (req, res, next) => {
    res.json(await turnosReportes.getReporteEntregasSinTurno(req.query.desde || '', req.query.hasta || ''));
});

router.post('/api/turnos/derivar-bodega', async (req, res, next) => {
    if (!req.body.turno_id) return res.status(400).json({ error: 'turno_id requerido' });
    await turnosFlujo.derivarABodega(req.body);
    res.json({ ok: true });
});

router.post('/api/turnos/verificar', async (req, res, next) => {
    if (!req.body.entrega_id) return res.status(400).json({ error: 'entrega_id requerido' });
    await turnosFlujo.verificarEntrega(req.body);
    res.json({ ok: true });
});

router.post('/api/turnos/cargado', async (req, res, next) => {
    if (!req.body.entrega_id) return res.status(400).json({ error: 'entrega_id requerido' });
    await turnosFlujo.marcarCargado(req.body);
    res.json({ ok: true });
});

router.post('/api/turnos/facturar', async (req, res, next) => {
    if (!req.body.entrega_id || !req.body.numero_factura) return res.status(400).json({ error: 'entrega_id y numero_factura requeridos' });
    await turnosFlujo.facturarEntrega(req.body);
    res.json({ ok: true });
});

router.get('/api/turnos/tecnicos-almacen', async (req, res, next) => {
    res.json(await entregas.getTecnicosAlmacen());
});

router.post('/api/turnos/tecnicos-almacen', async (req, res, next) => {
    const nombre = sanitizeString(req.body.nombre);
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    res.status(201).json(await entregas.crearTecnicoAlmacen(nombre));
});

router.delete('/api/turnos/tecnicos-almacen/:id', async (req, res, next) => {
    await entregas.eliminarTecnicoAlmacen(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/turnos/almacen/pendientes', async (req, res, next) => {
    res.json(await entregas.getPendientesAlmacen());
});

router.get('/api/turnos/facturar/pendientes', async (req, res, next) => {
    res.json(await entregas.getPendientesFacturar());
});

router.get('/api/turnos/:id/adjuntos', async (req, res, next) => {
    try { res.json(await entregas.getAdjuntos(Number(req.params.id))); }
    catch (e) { next(e); }
});

router.get('/api/turnos/adjunto/:id', async (req, res, next) => {
    try {
        const adj = await entregas.getAdjuntoArchivo(Number(req.params.id));
        if (!adj) return res.status(404).json({ error: 'No encontrado' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${adj.nombre}"`);
        res.end(adj.archivo);
    } catch (e) { next(e); }
});

router.get('/api/turnos/qr', async (req, res, next) => {
    const QRCode = require('qrcode');
    const url = req.headers.host
        ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/turnos/?view=registro`
        : 'http://localhost:3000/turnos/?view=registro';
    try {
        const qrDataUrl = await QRCode.toDataURL(url, { width: 250, margin: 2 });
        res.json({ qr: qrDataUrl, url });
    } catch (e) { res.json({ qr: '', url, error: e.message }); }
});

router.get('/api/turnos/entregas', async (req, res, next) => {
    res.json(await entregas.getEntregasDelDia());
});

router.get('/api/turnos/entregas/pendientes', async (req, res, next) => {
    res.json(await entregas.getEntregasPendientes());
});

router.post('/api/turnos/entregas/registrar', async (req, res, next) => {
    if (!req.body.cliente_nombre) return res.status(400).json({ error: 'Nombre requerido' });
    res.status(201).json(await entregas.registrarEntrega(req.body));
});

router.post('/api/turnos/entregas/:id/entregar', async (req, res, next) => {
    await entregas.marcarEntregado(Number(req.params.id));
    res.json({ ok: true });
});

router.delete('/api/turnos/eliminar-turno/:id', async (req, res, next) => {
    const id = Number(req.params.id);
    await query('DELETE FROM entregas WHERE turno_id = $1', [id]);
    await query('DELETE FROM turnos WHERE id = $1', [id]);
    res.json({ ok: true });
});

router.delete('/api/turnos/eliminar-entrega/:id', async (req, res, next) => {
    await entregas.eliminarEntrega(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/turnos/:id', async (req, res, next) => {
    const ticket = await turnosReportes.getTicketTurno(Number(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'No encontrado' });
    res.json(ticket);
});

module.exports = router;
