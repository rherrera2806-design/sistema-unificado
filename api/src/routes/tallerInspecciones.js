const express = require('express');
const router = express.Router();
const inspecciones = require('../services/inspeccionesCalidad');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

const MOD = 'produccion';
const canView = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);

router.post('/api/taller/inspecciones', canCreate, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'] || 'Sistema';
    const result = await inspecciones.crearInspeccion({
        ...req.body,
        inspector_email: userEmail,
        inspector_nombre: req.body.inspector_nombre || userEmail
    });
    res.status(201).json(result);
}));

router.get('/api/taller/inspecciones/orden/:ordenId', canView, asyncHandler(async (req, res) => {
    res.json(await inspecciones.getInspeccionesPorOrden(Number(req.params.ordenId)));
}));

router.get('/api/taller/inspecciones/paso/:pasoId', canView, asyncHandler(async (req, res) => {
    res.json(await inspecciones.getInspeccionesPorPaso(Number(req.params.pasoId)));
}));

router.get('/api/taller/inspecciones/fecha', canView, asyncHandler(async (req, res) => {
    const { fecha, estacion_id } = req.query;
    if (!fecha) return res.status(400).json({ error: 'fecha requerida' });
    res.json(await inspecciones.getInspeccionesPorFecha(fecha, estacion_id ? Number(estacion_id) : null));
}));

router.get('/api/taller/inspecciones/estadisticas', canView, asyncHandler(async (req, res) => {
    const { inicio, fin } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await inspecciones.getEstadisticasCalidad(inicio, fin));
}));

router.get('/api/taller/inspecciones/defectos-frecuentes', canView, asyncHandler(async (req, res) => {
    const { inicio, fin, limite } = req.query;
    if (!inicio || !fin) return res.status(400).json({ error: 'inicio y fin requeridos' });
    res.json(await inspecciones.getDefectosFrecuentes(inicio, fin, Number(limite) || 10));
}));

router.get('/api/taller/inspecciones/tipos-defecto', canView, asyncHandler(async (req, res) => {
    res.json(await inspecciones.getTiposDefecto());
}));

router.put('/api/taller/inspecciones/:id', canUpdate, asyncHandler(async (req, res) => {
    const userEmail = req.headers['x-user-email'] || 'Sistema';
    const result = await inspecciones.actualizarInspeccion(
        Number(req.params.id), 
        req.body, 
        userEmail, 
        req.body.inspector_nombre || userEmail
    );
    if (!result) return res.status(404).json({ error: 'Inspección no encontrada' });
    res.json(result);
}));

module.exports = router;
