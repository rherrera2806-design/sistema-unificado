const express = require('express');
const router = express.Router();
const ordenes = require('../services/produccionOrdenes');
const { query } = require('../config/database');

router.get('/api/produccion/dashboard', async (req, res, next) => {
    try {
        const [total, pendientes, enProceso, completadas, totalPasos, pasosCompletados] = await Promise.all([
            query('SELECT COUNT(*) as c FROM produccion_ordenes'),
            query("SELECT COUNT(*) as c FROM produccion_ordenes WHERE estado_programacion = 'PENDIENTE'"),
            query("SELECT COUNT(DISTINCT o.id) as c FROM produccion_ordenes o INNER JOIN produccion_pasos p ON p.orden_produccion_id = o.id WHERE p.estado != 'PENDIENTE' AND o.estado_programacion != 'CERRADA'"),
            query("SELECT COUNT(*) as c FROM produccion_ordenes WHERE estado_programacion = 'CERRADA'"),
            query('SELECT COUNT(*) as c FROM produccion_pasos'),
            query("SELECT COUNT(*) as c FROM produccion_pasos WHERE estado = 'COMPLETADO'")
        ]);
        res.json({
            total: Number(total.rows[0].c),
            pendientes: Number(pendientes.rows[0].c),
            enProceso: Number(enProceso.rows[0].c),
            completadas: Number(completadas.rows[0].c),
            totalPasos: Number(totalPasos.rows[0].c),
            pasosCompletados: Number(pasosCompletados.rows[0].c)
        });
    } catch (e) { next(e); }
});

router.get('/api/produccion/ordenes', async (req, res, next) => {
    try { res.json(await ordenes.getOrdenes()); }
    catch (e) { next(e); }
});

router.post('/api/produccion/ordenes', async (req, res, next) => {
    const { pedido_sap_id, codigo_producto, ancho, alto } = req.body;
    if (!pedido_sap_id || !codigo_producto || !ancho || !alto) return res.status(400).json({ error: 'Pedido, codigo, ancho y alto requeridos' });
    try { res.status(201).json({ ok: true, ...await ordenes.crearOrden(req.body) }); }
    catch (e) { res.status(500).json({ error: 'Error al crear orden: ' + e.message }); }
});

router.put('/api/produccion/ordenes/:id/cerrar', async (req, res, next) => {
    if (!req.body.nota) return res.status(400).json({ error: 'Motivo de cierre requerido' });
    try { await ordenes.cerrarOrden(Number(req.params.id), req.body.nota); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.get('/api/produccion/ordenes/:id/pasos', async (req, res, next) => {
    res.json(await ordenes.getPasos(Number(req.params.id)));
});

router.post('/api/produccion/ordenes/:id/pasos', async (req, res, next) => {
    if (!req.body.estacion_id) return res.status(400).json({ error: 'Estacion requerida' });
    try { await ordenes.agregarPaso(Number(req.params.id), req.body.estacion_id); res.json({ ok: true }); }
    catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/produccion/ordenes/:id', async (req, res, next) => {
    try { res.json(await ordenes.editarOrden(Number(req.params.id), req.body)); }
    catch (e) { res.status(e.message.includes('Sin campos') ? 400 : 500).json({ error: e.message }); }
});

router.delete('/api/produccion/ordenes/:id', async (req, res, next) => {
    try { await ordenes.eliminarOrden(Number(req.params.id)); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.put('/api/produccion/pasos/:id', async (req, res, next) => {
    if (!req.body.estado) return res.status(400).json({ error: 'Estado requerido' });
    try { await ordenes.actualizarPaso(Number(req.params.id), req.body); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.delete('/api/produccion/pasos/:id', async (req, res, next) => {
    try { await ordenes.eliminarPaso(Number(req.params.id)); res.json({ ok: true }); }
    catch (e) { next(e); }
});

module.exports = router;
