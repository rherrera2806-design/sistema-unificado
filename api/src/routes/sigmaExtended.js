const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const sigmaReports = require('../services/sigmaReports');
const sigmaService = require('../services/sigma');
const { requireAnyPerm, requirePerm } = require('../middleware/permisos');

const MOD = 'dashboard';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);
const requireAdmin = requirePerm('usuarios');

router.get('/api/sigma/calendar-data', canView, async (req, res, next) => {
    try {
        const month = parseInt(req.query.month) || new Date().getMonth() + 1;
        const year = parseInt(req.query.year) || new Date().getFullYear();
        res.json(await sigmaReports.getCalendarData(month, year));
    } catch (e) { next(e); }
});

router.get('/api/sigma/dashboard-data', canView, async (req, res, next) => {
    try { res.json(await sigmaReports.getDashboardData(sigmaService.getSigmaStats)); }
    catch (e) { next(e); }
});

router.get('/api/sigma/preventive-data', canView, async (req, res, next) => {
    try { res.json(await sigmaReports.getPreventiveData()); }
    catch (e) { next(e); }
});

router.get('/api/sigma/corrective-data', canView, async (req, res, next) => {
    try { res.json(await sigmaReports.getCorrectiveData()); }
    catch (e) { next(e); }
});

router.get('/api/sigma/machine-types-data', canView, async (req, res, next) => {
    try { res.json(await sigmaReports.getMachineTypesData()); }
    catch (e) { next(e); }
});

router.get('/api/sigma/stats/summary', canView, async (req, res, next) => {
    try { res.json(await sigmaReports.getStatsSummary()); }
    catch (e) { next(e); }
});

router.get('/api/sigma/components/by-type/:id', canView, async (req, res, next) => {
    res.json(await sigmaReports.getComponentsByType(Number(req.params.id)));
});

router.get('/api/sigma/machines/:id/details', canView, async (req, res, next) => {
    const details = await sigmaReports.getMachineDetails(Number(req.params.id));
    if (!details) return res.status(404).json({ error: 'No encontrada' });
    res.json(details);
});

router.get('/api/sigma/machines/:id/components', canView, async (req, res, next) => {
    res.json(await sigmaReports.getMachineComponents(Number(req.params.id)));
});

router.put('/api/sigma/machines/:id/components', canUpdate, async (req, res, next) => {
    await sigmaReports.setMachineComponents(Number(req.params.id), req.body.componentes || []);
    res.json({ ok: true });
});

router.get('/api/sigma/reports/overdue', canView, async (req, res, next) => {
    res.json(await sigmaReports.getOverdue());
});

router.get('/api/sigma/reports/upcoming', canView, async (req, res, next) => {
    res.json(await sigmaReports.getUpcoming(Number(req.query.days) || 15));
});

router.get('/api/sigma/reports/completed', canView, async (req, res, next) => {
    res.json(await sigmaReports.getCompleted());
});

router.get('/api/sigma/reports/recent-completed', canView, async (req, res, next) => {
    res.json(await sigmaReports.getRecentCompleted());
});

router.get('/api/sigma/reports/top-failing-machines', canView, async (req, res, next) => {
    res.json(await sigmaReports.getTopFailingMachines());
});

router.get('/api/sigma/reports/by-period', canView, async (req, res, next) => {
    res.json(await sigmaReports.getByPeriod(req.query.start, req.query.end));
});

router.get('/api/sigma/reports/bitacora', canView, async (req, res, next) => {
    res.json(await sigmaReports.getBitacora());
});

router.post('/api/sigma/reset', requireAdmin, async (req, res, next) => {
    await sigmaService.clearAllSigma();
    res.json({ ok: true, message: 'Base de datos reiniciada' });
});

router.get('/api/sigma/diagnostico', canView, async (req, res, next) => {
    try {
        const [maquinas, tipos, links, machineComps, preventivos] = await Promise.all([
            query('SELECT id, nombre, codigo, tipo_id FROM machines ORDER BY id'),
            query('SELECT id, nombre FROM machine_types ORDER BY id'),
            query('SELECT * FROM component_type_links'),
            query('SELECT * FROM machine_components'),
            query('SELECT id, maquina_id, componente_id, estado FROM preventive_maintenance')
        ]);

        const tipoMap = {};
        tipos.rows.forEach(t => { tipoMap[t.id] = t.nombre; });

        const compsPerType = {};
        links.rows.forEach(l => {
            if (!compsPerType[l.tipo_id]) compsPerType[l.tipo_id] = 0;
            compsPerType[l.tipo_id]++;
        });

        const compsPerMachine = {};
        machineComps.rows.forEach(mc => {
            if (!compsPerMachine[mc.maquina_id]) compsPerMachine[mc.maquina_id] = 0;
            compsPerMachine[mc.maquina_id]++;
        });

        const prevPerMachine = {};
        preventivos.rows.forEach(p => {
            if (!prevPerMachine[p.maquina_id]) prevPerMachine[p.maquina_id] = { total: 0, realizadas: 0, programadas: 0, vencidas: 0 };
            prevPerMachine[p.maquina_id].total++;
            if (p.estado === 'Realizada') prevPerMachine[p.maquina_id].realizadas++;
            else if (p.estado === 'Programada') prevPerMachine[p.maquina_id].programadas++;
            else prevPerMachine[p.maquina_id].vencidas++;
        });

        const desglose = maquinas.rows.map(m => {
            const compsTipo = compsPerType[m.tipo_id] || 0;
            const compsAsignados = compsPerMachine[m.id] || 0;
            const prev = prevPerMachine[m.id] || { total: 0, realizadas: 0, programadas: 0, vencidas: 0 };
            return {
                id: m.id,
                codigo: m.codigo,
                nombre: m.nombre,
                tipo: tipoMap[m.tipo_id] || 'Sin tipo',
                tipo_id: m.tipo_id,
                componentes_por_tipo: compsTipo,
                componentes_asignados: compsAsignados,
                mantenciones: prev.total,
                realizadas: prev.realizadas,
                programadas: prev.programadas,
                vencidas: prev.vencidas
            };
        });

        const totalMaquinas = maquinas.rows.length;
        const totalLinks = links.rows.length;
        const totalMachineComps = machineComps.rows.length;
        const totalPreventivos = preventivos.rows.length;
        const maquinasSinCompsTipo = desglose.filter(d => d.componentes_por_tipo === 0).length;
        const maquinasSinCompsAsignados = desglose.filter(d => d.componentes_asignados === 0).length;
        const cicloCompleto = totalMachineComps;

        res.json({
            resumen: {
                totalMaquinas,
                totalTipos: tipos.rows.length,
                totalComponentesCatalogo: (await query('SELECT COUNT(*) as c FROM components')).rows[0].c,
                totalLinksTipo: totalLinks,
                totalMachineComponents: totalMachineComps,
                totalPreventivos,
                maquinasSinComponentesTipo: maquinasSinCompsTipo,
                maquinasSinComponentesAsignados: maquinasSinCompsAsignados,
                cicloCompletoMantenciones: cicloCompleto
            },
            desglose
        });
    } catch (e) { next(e); }
});

module.exports = router;
