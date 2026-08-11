const express = require('express');
const router = express.Router();
const taller = require('../services/taller');
const { autoAsignarPendientes } = require('../services/planificacionAuto');

router.get('/api/taller/estaciones', async (req, res, next) => {
    try { res.json(await taller.getEstacionesConCarga()); }
    catch (e) { next(e); }
});

router.get('/api/taller/colaxestacion/:id', async (req, res, next) => {
    try { res.json(await taller.getColaPorEstacion(req.params.id)); }
    catch (e) { next(e); }
});

router.post('/api/taller/iniciar', async (req, res, next) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    try { await taller.iniciarPaso(req.body.paso_id); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.post('/api/taller/finalizar', async (req, res, next) => {
    if (!req.body.paso_id) return res.status(400).json({ error: 'paso_id requerido' });
    try {
        const result = await taller.finalizarPaso(req.body.paso_id);
        if (!result) return res.status(404).json({ error: 'Paso no encontrado' });
        res.json({ ok: true, ...result });
    } catch (e) { next(e); }
});

router.post('/api/taller/merma', async (req, res, next) => {
    if (!req.body.paso_id || !req.body.causa) return res.status(400).json({ error: 'paso_id y causa requeridos' });
    try {
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
    } catch (e) { next(e); }
});

router.get('/api/taller/mermas', async (req, res, next) => {
    try {
        const hoy = req.query.fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
        res.json(await taller.getMermas(hoy));
    } catch (e) { next(e); }
});

router.post('/api/taller/backfill-espesor', async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        const result = await query(`
            UPDATE produccion_ordenes o
            SET espesor_mm = COALESCE(
                (SELECT m.espesor_mm FROM materias_primas m WHERE m.codigo_mp = o.codigo_producto),
                o.espesor_mm
            )
        `);
        res.json({ ok: true, actualizadas: result.rowCount });
    } catch (e) { next(e); }
});

router.get('/api/taller/debug-grupo', async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        const orders = await query(`
            SELECT o.id, o.codigo_producto, o.codigo_padre, o.grupo, o.bom_padre_id,
                   cc.grupo as cod_grupo, cc.familia as cod_familia
            FROM produccion_ordenes o
            LEFT JOIN produccion_codigos cc ON cc.codigo = o.codigo_padre
            ORDER BY o.id DESC LIMIT 5
        `);
        const sample = await query(`SELECT DISTINCT codigo_padre, grupo FROM produccion_ordenes ORDER BY id DESC LIMIT 5`);
        const codigos = await query(`SELECT codigo, grupo, familia FROM produccion_codigos LIMIT 10`);
        res.json({ orders: orders.rows, sample: sample.rows, codigos: codigos.rows });
    } catch (e) { next(e); }
});

module.exports = router;
