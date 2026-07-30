const express = require('express');
const router = express.Router();
const { getReporteFechas } = require('../services/produccionReportes');

router.get('/api/produccion/reporte-fechas', async (req, res, next) => {
    try {
        const { familia, fecha_inicio, fecha_fin, grupo, estado } = req.query;
        res.json(await getReporteFechas({ familia, fecha_inicio, fecha_fin, grupo, estado }));
    } catch (e) { next(e); }
});

module.exports = router;
