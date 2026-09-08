const express = require('express');
const router = express.Router();
const planificacion = require('../services/planificacion');
const planificacionGrupo = require('../services/planificacionGrupo');
const { autoAsignarPendientes } = require('../services/planificacionAuto');
const { reprogramarPendientes } = require('../services/reprogramarService');
const { importarOrdenes } = require('../services/produccionImportar');
const planificacionService = require('../services/produccionPlanificacionService');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');
const { parseExcelSimple } = require('../utils/excelUtils');

const MOD = 'prod_planificacion';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

router.post('/api/produccion/importar', canCreate, asyncHandler(async (req, res) => {
    let rows = req.body.rows;
    if (!rows && req.body.excel_data) {
        rows = parseExcelSimple(req.body.excel_data);
    }
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'El archivo Excel esta vacio' });
    console.log('[PROD] Importando', rows.length, 'filas desde', req.body.file_name || 'excel');
    res.json(await importarOrdenes(rows));
}));

router.get('/api/produccion/importar/template', canView, (req, res) => {
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

router.get('/api/produccion/calendario', canView, asyncHandler(async (req, res) => { res.json(await planificacion.getCalendario()); }));

router.post('/api/produccion/calendario', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.fecha) return res.status(400).json({ error: 'fecha requerida' });
    await planificacion.marcarDia(req.body);
    res.json({ ok: true });
}));

router.delete('/api/produccion/calendario/:id', canDelete, asyncHandler(async (req, res) => {
    await planificacion.eliminarDia(Number(req.params.id));
    res.json({ ok: true });
}));

router.get('/api/produccion/planificacion/carga-semanal', canView, asyncHandler(async (req, res) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    res.json(await planificacion.getCargaSemanal(req.query.inicio, req.query.fin));
}));

router.get('/api/produccion/planificacion/carga-por-grupo', canView, asyncHandler(async (req, res) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    res.json(await planificacion.getCargaPorGrupo(req.query.inicio, req.query.fin));
}));

router.get('/api/produccion/planificacion/carga-por-grupo-finales', canView, asyncHandler(async (req, res) => {
    if (!req.query.inicio || !req.query.fin) return res.status(400).json({ error: 'Fechas inicio y fin requeridas' });
    res.json(await planificacion.getCargaPorGrupoFinales(req.query.inicio, req.query.fin));
}));

router.get('/api/produccion/planificacion/carga-estaciones', canView, asyncHandler(async (req, res) => {
    const inicio = req.query.inicio || new Date().toISOString().split('T')[0];
    const fin = req.query.fin || inicio;
    res.json(await planificacion.getCargaEstaciones(inicio, fin));
}));

router.get('/api/produccion/planificacion/detalle-grupo-dia', canView, asyncHandler(async (req, res) => {
    const { grupo, fecha } = req.query;
    if (!grupo || !fecha) return res.status(400).json({ error: 'grupo y fecha requeridos' });
    res.json(await planificacionService.getDetalleGrupoDia(grupo, fecha));
}));

router.get('/api/produccion/planificacion/pendientes', canView, asyncHandler(async (req, res) => { res.json(await planificacion.getPendientes()); }));

router.post('/api/produccion/planificacion/programar', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.orden_id) return res.status(400).json({ error: 'orden_id requerido' });
    const result = await planificacion.programarOrden(req.body.orden_id, req.body.fecha_entrega_propuesta);
    res.json({ ok: true, mensaje: `Orden programada${result.fechaFinal ? '. Entrega: ' + result.fechaFinal : ''}`, asignaciones: result.asignaciones });
}));

router.get('/api/produccion/capacidad-grupo/all', canView, asyncHandler(async (req, res) => { res.json(await planificacion.getAllCapacidadGrupo()); }));

router.get('/api/produccion/capacidad-grupo', canView, asyncHandler(async (req, res) => { res.json(await planificacion.getCapacidadGrupo()); }));

router.post('/api/produccion/capacidad-grupo', canCreate, asyncHandler(async (req, res) => {
    const { grupo, capacidad_kg_dia, color, activo } = req.body;
    if (!grupo) return res.status(400).json({ error: 'Nombre requerido' });
    res.json(await planificacionService.crearCapacidadGrupo({ grupo, capacidad_kg_dia, color, activo }));
}));

router.put('/api/produccion/capacidad-grupo/:id', canUpdate, asyncHandler(async (req, res) => {
    res.json(await planificacion.actualizarCapacidadGrupo(Number(req.params.id), req.body));
}));

router.delete('/api/produccion/capacidad-grupo/:id', canDelete, asyncHandler(async (req, res) => {
    await planificacionService.eliminarCapacidadGrupo(Number(req.params.id));
    res.json({ ok: true });
}));

router.get('/api/produccion/planificacion-grupo/semana', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await planificacionGrupo.getSemanaGrupo(inicio, fin));
}));

router.get('/api/produccion/planificacion-grupo/semana-finales', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await planificacionGrupo.getSemanaGrupoFinales(inicio, fin));
}));

router.get('/api/produccion/planificacion-grupo', canView, asyncHandler(async (req, res) => { res.json(await planificacionGrupo.getDiaGrupo(req.query.fecha)); }));

router.post('/api/produccion/planificacion-grupo/asignar', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.orden_id) return res.status(400).json({ error: 'orden_id requerido' });
    await planificacionGrupo.asignarOrdenFecha(req.body.orden_id, req.body.fecha);
    res.json({ ok: true });
}));

router.post('/api/produccion/planificacion-grupo/auto-asignar', canCreate, asyncHandler(async (req, res) => {
    const dias = Number(req.body.dias) || 14;
    const inicio = req.body.inicio || new Date().toISOString().split('T')[0];
    res.json(await autoAsignarPendientes({ dias, inicio }));
}));

router.get('/api/produccion/notas', canView, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    res.json(await planificacionService.getNotas(userEmail));
}));

router.post('/api/produccion/notas', canCreate, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    if (!req.body.nota || !req.body.nota.trim()) return res.status(400).json({ error: 'Nota requerida' });
    res.json(await planificacionService.crearNota(userEmail, req.body.nota));
}));

router.put('/api/produccion/notas/:id', canUpdate, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    const result = await planificacionService.actualizarNota(Number(req.params.id), userEmail, req.body.estado);
    if (!result) return res.status(404).json({ error: 'Nota no encontrada' });
    res.json(result);
}));

router.delete('/api/produccion/notas/:id', canDelete, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'];
    if (!userEmail) return res.status(401).json({ error: 'Usuario requerido' });
    await planificacionService.eliminarNota(Number(req.params.id), userEmail);
    res.json({ ok: true });
}));

// ═══════════════════════════════════════════════════════════════
// CAMBIO DE PRIORIDAD — PATCH /api/produccion/ordenes/:id/prioridad
// ═══════════════════════════════════════════════════════════════
router.patch('/api/produccion/ordenes/:id/prioridad', canUpdate, asyncHandler(async (req, res) => {
    const { nivel_prioridad } = req.body;
    const nivel = Number(nivel_prioridad);
    if (![1, 2, 3, 4].includes(nivel)) return res.status(400).json({ error: 'nivel_prioridad debe ser 1 (Normal), 2 (Express), 3 (Urgencia) o 4 (Reposición)' });
    await planificacionService.cambiarPrioridad(Number(req.params.id), nivel);
    res.json({ ok: true, nivel_prioridad: nivel });
}));

// ═══════════════════════════════════════════════════════════════
// REPROGRAMAR PENDIENTES — POST /api/produccion/reprogramar
// Paso A: Liberar PROGRAMADO → PENDIENTE (sin tocar EN PROCESO/MERMADO/TERMINADO)
// Paso B: Re-ejecutar auto-asignar con Priority Queue 4→1
// ═══════════════════════════════════════════════════════════════
router.post('/api/produccion/reprogramar', canCreate, asyncHandler(async (req, res) => {
    const dias = Number(req.body.dias) || 21;
    const inicio = req.body.inicio || new Date().toISOString().split('T')[0];
    res.json(await reprogramarPendientes({ dias, inicio }));
}));

// ═══════════════════════════════════════════════════════════════
// VERIFICAR SI HAY CAMBIOS PENDIENTES DE REPROGRAMACIÓN
// ═══════════════════════════════════════════════════════════════
router.get('/api/produccion/reprogramar/pendientes', canView, asyncHandler(async (req, res) => {
    res.json(await planificacionService.getReprogramarPendientes());
}));

module.exports = router;
