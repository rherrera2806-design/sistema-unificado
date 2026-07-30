const { parseBody, json } = require('../middleware/parser');
const sigmaService = require('../services/sigma');
const turnosService = require('../services/turnos');

const handleSigmaRoutes = async (req, res, urlPath) => {
    if (urlPath === '/api/sigma/stats' && req.method === 'GET') {
        json(res, await sigmaService.getSigmaStats());
        return true;
    }
    const sigmaCollectionMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)$/);
    if (sigmaCollectionMatch && req.method === 'GET') {
        try { json(res, await sigmaService.getAll(sigmaCollectionMatch[1])); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const sigmaByIdMatch = urlPath.match(/^\/api\/sigma\/([a-z_]+)\/(\d+)$/);
    if (sigmaByIdMatch && req.method === 'GET') {
        try {
            const item = await sigmaService.getById(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]));
            if (!item) return json(res, { error: 'No encontrado' }, 404), true;
            json(res, item);
        } catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaCollectionMatch && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await sigmaService.insert(sigmaCollectionMatch[1], body), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaByIdMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try { json(res, await sigmaService.update(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]), body)); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (sigmaByIdMatch && req.method === 'DELETE') {
        try {
            const ok = await sigmaService.del(sigmaByIdMatch[1], Number(sigmaByIdMatch[2]));
            if (!ok) return json(res, { error: 'No encontrado' }, 404), true;
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    if (urlPath === '/api/sigma/export' && req.method === 'GET') {
        json(res, await sigmaService.exportJSON());
        return true;
    }
    if (urlPath === '/api/sigma/import' && req.method === 'POST') {
        const body = await parseBody(req);
        await sigmaService.importJSON(body);
        json(res, { ok: true });
        return true;
    }
    if (urlPath === '/api/sigma/clear' && req.method === 'POST') {
        await sigmaService.clearAllSigma();
        json(res, { ok: true });
        return true;
    }
    return false;
};

const handleTurnosRoutes = async (req, res, urlPath) => {
    if (urlPath === '/api/turnos/stats' && req.method === 'GET') {
        json(res, await turnosService.getTurnosStats());
        return true;
    }
    if (urlPath === '/api/turnos/actual' && req.method === 'GET') {
        json(res, await turnosService.getTurnoActual());
        return true;
    }
    if (urlPath === '/api/turnos/cola' && req.method === 'GET') {
        json(res, await turnosService.getCola());
        return true;
    }
    if (urlPath === '/api/turnos' && req.method === 'POST') {
        const body = await parseBody(req);
        json(res, await turnosService.crearTurno(body), 201);
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+\/llamar$/) && req.method === 'POST') {
        const id = parseInt(urlPath.split('/')[3]);
        await turnosService.llamarTurno(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+\/finalizar$/) && req.method === 'POST') {
        const id = parseInt(urlPath.split('/')[3]);
        await turnosService.finalizarTurno(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath.match(/^\/api\/turnos\/\d+$/) && req.method === 'DELETE') {
        const id = parseInt(urlPath.split('/').pop());
        await turnosService.eliminarTurno(id);
        json(res, { ok: true });
        return true;
    }
    return false;
};

module.exports = { handleSigmaRoutes, handleTurnosRoutes };
