const express = require('express');
const router = express.Router();
const taller = require('../services/taller');
const backfills = require('../services/tallerBackfills');
const { autoAsignarPendientes } = require('../services/planificacionAuto');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

const MOD = 'produccion';
const canView = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);

// ============ CONSULTAS ============

router.get('/api/taller/estaciones', canView, asyncHandler(async (req, res) => {
    res.json(await taller.getEstacionesConCarga());
}));

router.get('/api/taller/maquinas/:estacionId', canView, asyncHandler(async (req, res) => {
    res.json(await taller.getMaquinasPorEstacion(req.params.estacionId));
}));

router.get('/api/taller/colaxestacion/:id', canView, asyncHandler(async (req, res) => {
    res.json(await taller.getColaPorEstacion(req.params.id));
}));

router.get('/api/taller/mermas', canView, asyncHandler(async (req, res) => {
    const hoy = req.query.fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
    res.json(await taller.getMermas(hoy));
}));

// ============ ACCIONES DE OPERARIO ============

router.post('/api/taller/iniciar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    await taller.iniciarPaso(req.body.paso_id, req.body.maquina_id, operarioEmail, operarioNombre);
    res.json({ ok: true });
}));

router.post('/api/taller/iniciar-pedido', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.orden_id) return res.status(400).json({ error: 'orden_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    const iniciados = await taller.iniciarPasosPorOrden(req.body.orden_id, req.body.estacion_id, req.body.maquina_id, operarioEmail, operarioNombre);
    res.json({ ok: true, iniciados });
}));

router.post('/api/taller/pausar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    await taller.pausarPaso(req.body.paso_id, operarioEmail, operarioNombre);
    res.json({ ok: true });
}));

router.post('/api/taller/reanudar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    await taller.reanudarPaso(req.body.paso_id, operarioEmail, operarioNombre);
    res.json({ ok: true });
}));

router.post('/api/taller/finalizar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    const result = await taller.finalizarPaso(req.body.paso_id, operarioEmail, operarioNombre);
    if (!result) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json({ ok: true, ...result });
}));

router.post('/api/taller/procesar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    const operarioEmail = req.headers['x-user-email'] || req.body.operario_email || 'Operario';
    const operarioNombre = req.body.operario_nombre || operarioEmail;
    const result = await taller.procesarPaso(req.body.paso_id, req.body.cantidad, req.body.maquina_id, operarioEmail, operarioNombre);
    if (!result) return res.status(404).json({ error: 'Paso no encontrado' });
    res.json({ ok: true, ...result });
}));

router.post('/api/taller/merma', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.paso_id || !req.body.causa) return res.status(400).json({ error: 'paso_id y causa requeridos' });
    const userEmail = req.headers['x-user-email'] || req.body.operario || 'Operario';
    const result = await taller.registrarMerma({ ...req.body, userEmail });
    if (!result) return res.status(404).json({ error: 'Paso no encontrado' });
    const cantidadMermada = Number(req.body.cantidad) || 1;
    const msg = result.cantidadRestante > 0
        ? `Merma registrada. Reposicion #${result.nuevaOrdenId} por ${cantidadMermada} unidades.`
        : `Merma total. Reposicion #${result.nuevaOrdenId} creada.`;

    let autoAsignados = 0;
    try {
        const autoResult = await autoAsignarPendientes({ dias: 21, inicio: new Date().toISOString().split('T')[0] });
        autoAsignados = Array.isArray(autoResult.asignados) ? autoResult.asignados.length : 0;
    } catch (autoErr) { console.error('[TALLER] Auto-asignar post-merma error:', autoErr.message); }

    res.json({ ok: true, ...result, mensaje: msg + (autoAsignados > 0 ? ` Auto-asignada: ${autoAsignados} orden(es).` : '') });
}));

// ============ BACKFILLS ============

router.post('/api/taller/backfill-familia', canUpdate, asyncHandler(async (req, res) => {
    const actualizadas = await backfills.backfillFamilia();
    res.json({ ok: true, actualizadas });
}));

router.post('/api/taller/backfill-espesor', canUpdate, asyncHandler(async (req, res) => {
    const actualizadas = await backfills.backfillEspesor();
    res.json({ ok: true, actualizadas });
}));

router.post('/api/taller/backfill-pasos-termopanel', canUpdate, asyncHandler(async (req, res) => {
    const result = await backfills.backfillPasosTermopanel();
    res.json(result);
}));

module.exports = router;
