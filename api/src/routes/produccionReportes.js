const express = require('express');
const router = express.Router();
const { getReporteFechas } = require('../services/produccionReportes');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'prod_reportes';
const canView = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);

router.get('/api/produccion/reporte-fechas', canView, async (req, res, next) => {
    try {
        const { familia, fecha_inicio, fecha_fin, grupo, estado } = req.query;
        res.json(await getReporteFechas({ familia, fecha_inicio, fecha_fin, grupo, estado }));
    } catch (e) { next(e); }
});

module.exports = router;
