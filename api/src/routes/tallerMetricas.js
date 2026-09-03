const express = require('express');
const router = express.Router();
const metricas = require('../services/tallerMetricas');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

const MOD = 'produccion';
const canView = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);

router.get('/api/taller/metricas/generales', canView, asyncHandler(async (req, res) => {
    const fecha = req.query.fecha || new Date().toISOString().split('T')[0];
    res.json(await metricas.getMetricasGenerales(fecha));
}));

router.get('/api/taller/metricas/oee', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getOEEPorEstacion(inicio, fin));
}));

router.get('/api/taller/metricas/lead-time', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getLeadTimePromedio(inicio, fin));
}));

router.get('/api/taller/metricas/mermas', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getTasaMerma(inicio, fin));
}));

router.get('/api/taller/metricas/operarios', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getRendimientoOperario(inicio, fin));
}));

router.get('/api/taller/metricas/calidad', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getMetricasCalidad(inicio, fin));
}));

router.get('/api/taller/metricas/defectos', canView, asyncHandler(async (req, res) => {
    const { inicio, fin, limite } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await metricas.getDefectosFrecuentes(inicio, fin, Number(limite) || 10));
}));

router.get('/api/taller/historial/:tipo/:id', canView, asyncHandler(async (req, res) => {
    res.json(await metricas.getHistorial(req.params.tipo, Number(req.params.id)));
}));

module.exports = router;
