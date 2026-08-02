const express = require('express');
const router = express.Router();
const { query } = require('../config/database');

router.get('/api/maintenance/dashboard', async (req, res, next) => {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const hoy = now.toISOString().split('T')[0];
        const primerDiaMes = `${year}-${String(month).padStart(2, '0')}-01`;
        const ultimoDiaMes = new Date(year, month, 0).toISOString().split('T')[0];

        const [prevTotal, prevProgramadas, prevRealizadas, prevVencidas, corrTotal, corrEnMantencion, corrReparadas] = await Promise.all([
            query('SELECT COUNT(*) as c FROM preventive_maintenance'),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada >= $1 AND fecha_programada <= $2", [primerDiaMes, ultimoDiaMes]),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE estado = 'Realizada' AND fecha_programada >= $1 AND fecha_programada <= $2", [primerDiaMes, ultimoDiaMes]),
            query("SELECT COUNT(*) as c FROM preventive_maintenance WHERE fecha_programada < $1 AND estado != 'Realizada'", [hoy]),
            query('SELECT COUNT(*) as c FROM corrective_maintenance'),
            query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado = 'En Mantención'"),
            query("SELECT COUNT(*) as c FROM corrective_maintenance WHERE estado = 'Reparada' OR fecha_reparacion IS NOT NULL")
        ]);

        res.json({
            preventivasTotal: Number(prevTotal.rows[0].c),
            preventivasProgramadas: Number(prevProgramadas.rows[0].c),
            preventivasRealizadas: Number(prevRealizadas.rows[0].c),
            preventivasVencidas: Number(prevVencidas.rows[0].c),
            correctivasTotal: Number(corrTotal.rows[0].c),
            correctivasEnMantencion: Number(corrEnMantencion.rows[0].c),
            correctivasReparadas: Number(corrReparadas.rows[0].c)
        });
    } catch (e) { next(e); }
});

module.exports = router;
