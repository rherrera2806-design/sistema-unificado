const express = require('express');
const router = express.Router();
const planificacion = require('../services/planificacion');
const planificacionGrupo = require('../services/planificacionGrupo');
const { autoAsignarPendientes } = require('../services/planificacionAuto');
const { reprogramarPendientes } = require('../services/reprogramarService');
const { importarOrdenes } = require('../services/produccionImportar');
const { query } = require('../config/database');

router.post('/api/produccion/importar', async (req, res, next) => {
    let rows = req.body.rows;
    if (!rows && req.body.excel_data) {
        try {
            const XLSX = require('xlsx');
            const buffer = Buffer.from(req.body.excel_data, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        } catch (e) { return res.status(400).json({ error: 'Error al parsear Excel: ' + e.message }); }
    }
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'El archivo Excel esta vacio' });
    console.log('[PROD] Importando', rows.length, 'filas desde', req.body.file_name || 'excel');
    res.json(await importarOrdenes(rows));
});

router.get('/api/produccion/importar/template', (req, res) => {
    const XLSX = require('xlsx');
    const headers = ['codigo', 'pedido', 'item', 'cliente', 'descripcion', 'cantidad', 'ancho', 'alto', 'perforaciones', 'destaje', 'sacado', 'radio', 'ventana', 'pintado', 'pintado car', 'tipo de venta', 'fecha_creacion', 'nota', 'posicion', 'orden de compra', 'tipo de entrega'];
    const example = ['VT-001', 'PED-2026-001', 1, 'VIDRIERIA LOS ANDES', 'Vidrio templado 8mm', 10, 1500, 1000, 0, 0, 0, 0, 0, 0, 0, 'Normal', '2026-08-07', '', '', '', 'Despacho'];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Ordenes Produccion');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_ordenes_produccion.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

router.get('/api/produccion/calendario', async (req, res, next) => {
    try { res.json(await planificacion.getCalendario()); }
    catch (e) { next(e); }
});

router.post('/api/produccion/calendario', async (req, res, next) => {
    if (!req.body.fecha) return res.status(400).json({ error: 'fecha requerida' });
    try { await planificacion.marcarDia(req.body); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.delete('/api/produccion/calendario/:id', async (req, res, next) => {
    try { await planificacion.eliminarDia(Number(req.params.id)); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.get('/api/produccion/planificacion/carga-semanal', async (req, res, next) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    try { res.json(await planificacion.getCargaSemanal(req.query.inicio, req.query.fin)); }
    catch (e) { res.status(500).json({ error: String(e.message || e) }); }
});

router.get('/api/produccion/planificacion/carga-por-grupo', async (req, res, next) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    try { res.json(await planificacion.getCargaPorGrupo(req.query.inicio, req.query.fin)); }
    catch (e) { next(e); }
});

router.get('/api/produccion/planificacion/carga-por-grupo-finales', async (req, res, next) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    try { res.json(await planificacion.getCargaPorGrupoFinales(req.query.inicio, req.query.fin)); }
    catch (e) { next(e); }
});

router.get('/api/produccion/planificacion/carga-estaciones', async (req, res, next) => {
    try {
        const inicio = req.query.inicio || new Date().toISOString().split('T')[0];
        const fin = req.query.fin || inicio;
        res.json(await planificacion.getCargaEstaciones(inicio, fin));
    } catch (e) { next(e); }
});

router.get('/api/produccion/planificacion/pendientes', async (req, res, next) => {
    try { res.json(await planificacion.getPendientes()); }
    catch (e) { next(e); }
});

router.post('/api/produccion/planificacion/programar', async (req, res, next) => {
    if (!req.body.orden_id) return res.status(400).json({ error: 'orden_id requerido' });
    try {
        const result = await planificacion.programarOrden(req.body.orden_id, req.body.fecha_entrega_propuesta);
        res.json({ ok: true, mensaje: `Orden programada${result.fechaFinal ? '. Entrega: ' + result.fechaFinal : ''}`, asignaciones: result.asignaciones });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/api/produccion/capacidad-grupo', async (req, res, next) => {
    try { res.json(await planificacion.getCapacidadGrupo()); }
    catch (e) { next(e); }
});

router.put('/api/produccion/capacidad-grupo/:id', async (req, res, next) => {
    try { res.json(await planificacion.actualizarCapacidadGrupo(Number(req.params.id), req.body)); }
    catch (e) { res.status(e.message === 'Sin campos' ? 400 : 500).json({ error: e.message }); }
});

router.get('/api/produccion/planificacion-grupo/semana', async (req, res, next) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    try { res.json(await planificacionGrupo.getSemanaGrupo(inicio, fin)); }
    catch (e) { next(e); }
});

router.get('/api/produccion/planificacion-grupo/semana-finales', async (req, res, next) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    try { res.json(await planificacionGrupo.getSemanaGrupoFinales(inicio, fin)); }
    catch (e) { next(e); }
});

router.get('/api/produccion/planificacion-grupo', async (req, res, next) => {
    try { res.json(await planificacionGrupo.getDiaGrupo(req.query.fecha)); }
    catch (e) { next(e); }
});

router.post('/api/produccion/planificacion-grupo/asignar', async (req, res, next) => {
    if (!req.body.orden_id) return res.status(400).json({ error: 'orden_id requerido' });
    try { await planificacionGrupo.asignarOrdenFecha(req.body.orden_id, req.body.fecha); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.post('/api/produccion/planificacion-grupo/auto-asignar', async (req, res, next) => {
    try {
        const dias = Number(req.body.dias) || 14;
        const inicio = req.body.inicio || new Date().toISOString().split('T')[0];
        res.json(await autoAsignarPendientes({ dias, inicio }));
    } catch (e) { next(e); }
});

router.get('/api/produccion/notas', async (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    try { res.json((await query('SELECT * FROM prod_notas WHERE usuario_email = $1 ORDER BY fecha_creacion DESC', [userEmail])).rows); }
    catch (e) { next(e); }
});

router.post('/api/produccion/notas', async (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    if (!req.body.nota || !req.body.nota.trim()) return res.status(400).json({ error: 'Nota requerida' });
    try {
        const result = await query("INSERT INTO prod_notas (usuario_email, nota, estado) VALUES ($1, $2, 'pendiente') RETURNING *", [userEmail, req.body.nota.trim()]);
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

router.put('/api/produccion/notas/:id', async (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    try {
        const result = req.body.estado === 'realizado'
            ? await query('UPDATE prod_notas SET estado = $1, fecha_completado = CURRENT_TIMESTAMP WHERE id = $2 AND usuario_email = $3 RETURNING *', [req.body.estado, Number(req.params.id), userEmail])
            : await query('UPDATE prod_notas SET estado = $1, fecha_completado = NULL WHERE id = $2 AND usuario_email = $3 RETURNING *', [req.body.estado, Number(req.params.id), userEmail]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Nota no encontrada' });
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

router.delete('/api/produccion/notas/:id', async (req, res, next) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    try { await query('DELETE FROM prod_notas WHERE id = $1 AND usuario_email = $2', [Number(req.params.id), userEmail]); res.json({ ok: true }); }
    catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════
// CAMBIO DE PRIORIDAD — PATCH /api/produccion/ordenes/:id/prioridad
// ═══════════════════════════════════════════════════════════════
router.patch('/api/produccion/ordenes/:id/prioridad', async (req, res, next) => {
    const { nivel_prioridad } = req.body;
    const nivel = Number(nivel_prioridad);
    if (![1, 2, 3, 4].includes(nivel)) return res.status(400).json({ error: 'nivel_prioridad debe ser 1 (Normal), 2 (Express), 3 (Urgencia) o 4 (Reposición)' });
    try {
        await query('UPDATE produccion_ordenes SET nivel_prioridad = $1, needs_reprogramming = TRUE WHERE id = $2', [nivel, Number(req.params.id)]);
        res.json({ ok: true, nivel_prioridad: nivel });
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════
// REPROGRAMAR PENDIENTES — POST /api/produccion/reprogramar
// Paso A: Liberar PROGRAMADO → PENDIENTE (sin tocar EN PROCESO/MERMADO/TERMINADO)
// Paso B: Re-ejecutar auto-asignar con Priority Queue 4→1
// ═══════════════════════════════════════════════════════════════
router.post('/api/produccion/reprogramar', async (req, res, next) => {
    try {
        const dias = Number(req.body.dias) || 21;
        const inicio = req.body.inicio || new Date().toISOString().split('T')[0];
        res.json(await reprogramarPendientes({ dias, inicio }));
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════════════
// VERIFICAR SI HAY CAMBIOS PENDIENTES DE REPROGRAMACIÓN
// ═══════════════════════════════════════════════════════════════
router.get('/api/produccion/reprogramar/pendientes', async (req, res, next) => {
    try {
        const result = await query('SELECT COUNT(*) as count FROM produccion_ordenes WHERE needs_reprogramming = TRUE');
        res.json({ pendientes: Number(result.rows[0].count) > 0, count: Number(result.rows[0].count) });
    } catch (e) { next(e); }
});

module.exports = router;
