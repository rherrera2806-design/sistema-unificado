const express = require('express');
const router = express.Router();
const { getProgEstacion } = require('../services/produccionProgEstacion');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'prod_reportes';
const canView = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);

router.get('/api/produccion/prog-estacion', canView, async (req, res, next) => {
    try {
        const { estacion_id, fecha_inicio, fecha_fin, estado } = req.query;
        res.json(await getProgEstacion({ estacion_id, fecha_inicio, fecha_fin, estado }));
    } catch (e) { next(e); }
});

module.exports = router;
