const express = require('express');
const router = express.Router();
const bodega = require('../services/bodegaCarros');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

const MOD = 'bodega';
const canView = requireAnyPerm(MOD, `${MOD}.agregar`, `${MOD}.editar`, `${MOD}.eliminar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

// ============ CARROS ============

router.get('/api/bodega/carros', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getCarros());
}));

router.get('/api/bodega/debug-tabla', asyncHandler(async (req, res) => {
    const { query } = require('../config/database');
    const cols = await query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'bodega_carros' ORDER BY ordinal_position`);
    const rows = await query(`SELECT * FROM bodega_carros LIMIT 5`);
    const allCarros = await query(`SELECT id, codigo, tipo, capacidad_items, activo FROM bodega_carros ORDER BY codigo`);
    res.json({
        timestamp: new Date().toISOString(),
        server_version: 'DEBUG-v2',
        columnas_tabla: cols.rows,
        primeras_5_filas_completas: rows.rows,
        todos_los_carros: allCarros.rows
    });
}));

router.post('/api/bodega/carros', canCreate, asyncHandler(async (req, res) => {
    res.status(201).json(await bodega.crearCarro(req.body));
}));

router.put('/api/bodega/carros/:id', canUpdate, asyncHandler(async (req, res) => {
    const result = await bodega.editarCarro(Number(req.params.id), req.body);
    if (!result) return res.status(404).json({ error: 'Carro no encontrado' });
    res.json(result);
}));

router.delete('/api/bodega/carros/:id', canDelete, asyncHandler(async (req, res) => {
    res.json(await bodega.eliminarCarro(Number(req.params.id)));
}));

// ============ ITEMS LISTOS ============

router.get('/api/bodega/items-listos', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getItemsListosParaBodega());
}));

// ============ ASIGNAR ============

router.post('/api/bodega/asignar', canCreate, asyncHandler(async (req, res) => {
    if (!req.body.carro_id) return res.status(400).json({ error: 'carro_id requerido' });
    if (!Array.isArray(req.body.paso_ids) || req.body.paso_ids.length === 0) {
        return res.status(400).json({ error: 'paso_ids[] requerido' });
    }
    const userEmail = req.headers['x-user-email'] || 'Sistema';
    const userNombre = req.body.armador_nombre || userEmail;
    const count = await bodega.asignarItemsACarro(req.body.paso_ids, req.body.carro_id, userEmail, userNombre);
    res.json({ ok: true, asignados: count });
}));

router.delete('/api/bodega/items/:id', canDelete, asyncHandler(async (req, res) => {
    res.json(await bodega.quitarItemDeCarro(Number(req.params.id)));
}));

// ============ PRE-ENTREGA ============

router.get('/api/bodega/pre-entrega', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getCarrosEnPreEntrega());
}));

router.get('/api/bodega/carros/:id/items', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getItemsDeCarro(Number(req.params.id)));
}));

// ============ GENERAR ENTREGA ============

router.post('/api/bodega/generar-entrega', canUpdate, asyncHandler(async (req, res) => {
    if (!req.body.carro_id) return res.status(400).json({ error: 'carro_id requerido' });
    const userEmail = req.headers['x-user-email'] || 'Sistema';
    const userNombre = req.body.usuario_nombre || userEmail;
    res.status(201).json(await bodega.generarEntrega(
        req.body.carro_id,
        userEmail,
        userNombre,
        req.body.observaciones
    ));
}));

// ============ ENTREGAS ============

router.get('/api/bodega/entregas', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getEntregasGeneradas());
}));

router.get('/api/bodega/historial', canView, asyncHandler(async (req, res) => {
    res.json(await bodega.getHistorialEntregas(Number(req.query.limite) || 100));
}));

router.get('/api/bodega/entregas/:id', canView, asyncHandler(async (req, res) => {
    const result = await bodega.getEntregaDetalle(Number(req.params.id));
    if (!result) return res.status(404).json({ error: 'Entrega no encontrada' });
    res.json(result);
}));

router.post('/api/bodega/entregas/:id/recibir', canUpdate, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'] || 'Sistema';
    const userNombre = req.body.usuario_nombre || userEmail;
    res.json(await bodega.recibirEntrega(Number(req.params.id), userEmail, userNombre));
}));

module.exports = router;
