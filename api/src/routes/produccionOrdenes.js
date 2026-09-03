const express = require('express');
const router = express.Router();
const ordenes = require('../services/produccionOrdenes');
const { transaction } = require('../config/dbPool');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

const MOD = 'prod_ordenes';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

router.get('/api/produccion/dashboard', canView, asyncHandler(async (req, res) => {
    const [total, pendientes, enProceso, completadas, totalPasos, pasosCompletados] = await Promise.all([
        ordenes.query('SELECT COUNT(*) as c FROM produccion_ordenes'),
        ordenes.query("SELECT COUNT(*) as c FROM produccion_ordenes WHERE estado_programacion = 'PENDIENTE'"),
        ordenes.query("SELECT COUNT(DISTINCT o.id) as c FROM produccion_ordenes o INNER JOIN produccion_pasos p ON p.orden_produccion_id = o.id WHERE p.estado != 'PENDIENTE' AND o.estado_programacion != 'CERRADA'"),
        ordenes.query("SELECT COUNT(*) as c FROM produccion_ordenes WHERE estado_programacion = 'CERRADA'"),
        ordenes.query('SELECT COUNT(*) as c FROM produccion_pasos'),
        ordenes.query("SELECT COUNT(*) as c FROM produccion_pasos WHERE estado = 'COMPLETADO'")
    ]);
    res.json({
        total: Number(total.rows[0].c),
        pendientes: Number(pendientes.rows[0].c),
        enProceso: Number(enProceso.rows[0].c),
        completadas: Number(completadas.rows[0].c),
        totalPasos: Number(totalPasos.rows[0].c),
        pasosCompletados: Number(pasosCompletados.rows[0].c)
    });
}));

router.get('/api/produccion/ordenes', canView, asyncHandler(async (req, res) => {
    res.json(await ordenes.getOrdenes());
}));

router.post('/api/produccion/ordenes', canCreate, asyncHandler(async (req, res) => {
    const { pedido_sap_id, codigo_producto, ancho, alto } = req.body;
    if (!pedido_sap_id || !codigo_producto || !ancho || !alto) return res.status(400).json({ error: 'Pedido, codigo, ancho y alto requeridos' });
    res.status(201).json({ ok: true, ...await ordenes.crearOrden(req.body) });
}));

router.put('/api/produccion/ordenes/:id/cerrar', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.nota) return res.status(400).json({ error: 'Motivo de cierre requerido' });
    await ordenes.cerrarOrden(Number(req.params.id), req.body.nota);
    res.json({ ok: true });
}));

router.get('/api/produccion/ordenes/:id/pasos', canView, asyncHandler(async (req, res) => {
    res.json(await ordenes.getPasos(Number(req.params.id)));
}));

router.post('/api/produccion/ordenes/:id/pasos', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.estacion_id) return res.status(400).json({ error: 'Estacion requerida' });
    await ordenes.agregarPaso(Number(req.params.id), req.body.estacion_id);
    res.json({ ok: true });
}));

router.put('/api/produccion/ordenes/:id', canUpdate, asyncHandler(async (req, res) => {
    res.json(await ordenes.editarOrden(Number(req.params.id), req.body));
}));

router.delete('/api/produccion/ordenes/all', canDelete, asyncHandler(async (req, res) => {
    const result = await transaction(async ({ query }) => {
        await query('DELETE FROM cola_produccion_pasos WHERE orden_produccion_id IN (SELECT id FROM produccion_ordenes)');
        await query('DELETE FROM produccion_pasos WHERE orden_produccion_id IN (SELECT id FROM produccion_ordenes)');
        const r = await query('DELETE FROM produccion_ordenes');
        return r.rowCount;
    });
    res.json({ ok: true, eliminadas: result });
}));

router.delete('/api/produccion/ordenes/:id', canDelete, asyncHandler(async (req, res) => {
    await ordenes.eliminarOrden(Number(req.params.id));
    res.json({ ok: true });
}));

router.put('/api/produccion/pasos/:id', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.estado) return res.status(400).json({ error: 'Estado requerido' });
    await ordenes.actualizarPaso(Number(req.params.id), req.body);
    res.json({ ok: true });
}));

router.delete('/api/produccion/pasos/:id', canDelete, asyncHandler(async (req, res) => {
    await ordenes.eliminarPaso(Number(req.params.id));
    res.json({ ok: true });
}));

module.exports = router;
