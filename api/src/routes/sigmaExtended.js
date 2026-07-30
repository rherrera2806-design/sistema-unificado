const { query } = require('../config/database');
const { parseBody, json } = require('../middleware/parser');
const sigmaReports = require('../services/sigmaReports');
const sigmaService = require('../services/sigma');

const checkAdmin = async (req) => {
    const userEmail = req.headers['x-user-email'];
    const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
    return userRes.rows.length > 0 && userRes.rows[0].permisos.includes('usuarios');
};

const handleSigmaExtended = async (req, res, urlPath, q) => {
    // Datos combinados
    if (urlPath === '/api/sigma/calendar-data' && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, `http://${req.headers.host}`);
            const month = parseInt(urlObj.searchParams.get('month')) || new Date().getMonth() + 1;
            const year = parseInt(urlObj.searchParams.get('year')) || new Date().getFullYear();
            json(res, await sigmaReports.getCalendarData(month, year));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/sigma/dashboard-data' && req.method === 'GET') {
        try {
            json(res, await sigmaReports.getDashboardData(sigmaService.getSigmaStats));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/sigma/preventive-data' && req.method === 'GET') {
        try {
            json(res, await sigmaReports.getPreventiveData());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/sigma/corrective-data' && req.method === 'GET') {
        try {
            json(res, await sigmaReports.getCorrectiveData());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/sigma/machine-types-data' && req.method === 'GET') {
        try {
            json(res, await sigmaReports.getMachineTypesData());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // Stats summary
    if (urlPath === '/api/sigma/stats/summary' && req.method === 'GET') {
        json(res, await sigmaReports.getStatsSummary());
        return true;
    }

    // Components by type
    const compByTypeMatch = urlPath.match(/^\/api\/sigma\/components\/by-type\/(\d+)$/);
    if (compByTypeMatch && req.method === 'GET') {
        json(res, await sigmaReports.getComponentsByType(Number(compByTypeMatch[1])));
        return true;
    }

    // Machine details
    const machineDetailsMatch = urlPath.match(/^\/api\/sigma\/machines\/(\d+)\/details$/);
    if (machineDetailsMatch && req.method === 'GET') {
        const details = await sigmaReports.getMachineDetails(Number(machineDetailsMatch[1]));
        if (!details) {
            json(res, { error: 'No encontrada' }, 404);
            return true;
        }
        json(res, details);
        return true;
    }

    // Machine components
    const machineCompsMatch = urlPath.match(/^\/api\/sigma\/machines\/(\d+)\/components$/);
    if (machineCompsMatch && req.method === 'GET') {
        json(res, await sigmaReports.getMachineComponents(Number(machineCompsMatch[1])));
        return true;
    }

    if (machineCompsMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        await sigmaReports.setMachineComponents(Number(machineCompsMatch[1]), body.componentes || []);
        json(res, { ok: true });
        return true;
    }

    // Reportes
    if (urlPath === '/api/sigma/reports/overdue' && req.method === 'GET') {
        json(res, await sigmaReports.getOverdue());
        return true;
    }

    if (urlPath === '/api/sigma/reports/upcoming' && req.method === 'GET') {
        json(res, await sigmaReports.getUpcoming(Number(q.days) || 15));
        return true;
    }

    if (urlPath === '/api/sigma/reports/completed' && req.method === 'GET') {
        json(res, await sigmaReports.getCompleted());
        return true;
    }

    if (urlPath === '/api/sigma/reports/recent-completed' && req.method === 'GET') {
        json(res, await sigmaReports.getRecentCompleted());
        return true;
    }

    if (urlPath === '/api/sigma/reports/top-failing-machines' && req.method === 'GET') {
        json(res, await sigmaReports.getTopFailingMachines());
        return true;
    }

    if (urlPath === '/api/sigma/reports/by-period' && req.method === 'GET') {
        json(res, await sigmaReports.getByPeriod(q.start, q.end));
        return true;
    }

    if (urlPath === '/api/sigma/reports/bitacora' && req.method === 'GET') {
        json(res, await sigmaReports.getBitacora());
        return true;
    }

    // Reset (admin only)
    if (urlPath === '/api/sigma/reset' && req.method === 'POST') {
        if (!(await checkAdmin(req))) {
            json(res, { error: 'Solo admin' }, 403);
            return true;
        }
        await sigmaService.clearAllSigma();
        json(res, { ok: true, message: 'Base de datos reiniciada' });
        return true;
    }

    return false;
};

module.exports = { handleSigmaExtended };
