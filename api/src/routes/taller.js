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

router.post('/api/taller/backfill-familia', async (req, res, next) => {
    try {
        const { query } = require('../config/database');
        const result = await query(`
            UPDATE produccion_ordenes o
            SET familia_id = f.id
            FROM familias_producto f
            WHERE f.nombre_familia = o.grupo
            AND o.familia_id IS NULL
            AND o.grupo IS NOT NULL
        `);
        res.json({ ok: true, actualizadas: result.rowCount });
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

router.post('/api/taller/backfill-pasos-termopanel', async (req, res, next) => {
    try {
        const { query } = require('../config/database');

        const familiaRes = await query('SELECT id FROM familias_producto WHERE nombre_familia = $1', ['Termopanel']);
        if (!familiaRes.rows.length) return res.json({ ok: false, error: 'Familia Termopanel no encontrada' });
        const familiaId = familiaRes.rows[0].id;

        const estacionesRes = await query(
            `SELECT em.id as estacion_id, em.orden_secuencia_defecto
             FROM familia_estaciones_base feb
             JOIN estaciones_maestras em ON em.id = feb.estacion_id
             WHERE feb.familia_id = $1
             ORDER BY em.orden_secuencia_defecto`, [familiaId]
        );
        const estacionesIds = estacionesRes.rows.map(r => r.estacion_id);

        if (!estacionesIds.length) return res.json({ ok: false, error: 'No hay estaciones configuradas para Termopanel' });

        const ordenesRes = await query(
            `SELECT o.id, o.familia_id, o.codigo_padre,
                    (SELECT COUNT(*) FROM cola_produccion_pasos cp WHERE cp.orden_produccion_id = o.id) as pasos_count
             FROM produccion_ordenes o
             WHERE o.grupo = 'Termopanel'
             OR o.familia_id = $1`, [familiaId]
        );

        let eliminados = 0;
        let creados = 0;

        for (const orden of ordenesRes.rows) {
            await query('DELETE FROM cola_produccion_pasos WHERE orden_produccion_id = $1', [orden.id]);
            eliminados++;

            for (let s = 0; s < estacionesIds.length; s++) {
                await query(
                    'INSERT INTO cola_produccion_pasos (orden_produccion_id, estacion_id, orden_secuencia, estado) VALUES ($1, $2, $3, $4)',
                    [orden.id, estacionesIds[s], s + 1, 'PENDIENTE']
                );
                creados++;
            }
        }

        res.json({ ok: true, ordenes_afectadas: ordenesRes.rows.length, eliminados, creados });
    } catch (e) { next(e); }
});

module.exports = router;
