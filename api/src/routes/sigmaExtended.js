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

module.exports = router;
