const { parseBody, json } = require('../middleware/parser');
const { sanitizeObject } = require('../utils/helpers');
const catalogosService = require('../services/catalogos');
const inventarioService = require('../services/inventario');

const handleCatalogos = async (req, res, urlPath) => {
    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'GET') {
        json(res, await catalogosService.getTiposCristal());
        return true;
    }
    if (urlPath === '/api/catalogos/tipos-cristal' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await catalogosService.crearTipoCristal(body), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const tipoCristalMatch = urlPath.match(/^\/api\/catalogos\/tipos-cristal\/(\d+)$/);
    if (tipoCristalMatch && req.method === 'PUT') {
        const id = Number(tipoCristalMatch[1]);
        const body = await parseBody(req);
        const item = await catalogosService.updateTipoCristal(id, body);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, item);
        return true;
    }
    if (tipoCristalMatch && req.method === 'DELETE') {
        const id = Number(tipoCristalMatch[1]);
        const item = await catalogosService.eliminarTipoCristal(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, { ok: true, item });
        return true;
    }
    if (urlPath === '/api/catalogos/espesores' && req.method === 'GET') {
        json(res, await catalogosService.getEspesores());
        return true;
    }
    if (urlPath === '/api/catalogos/espesores' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await catalogosService.crearEspesor(body.valor), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const espesorMatch = urlPath.match(/^\/api\/catalogos\/espesores\/(\d+)$/);
    if (espesorMatch && req.method === 'DELETE') {
        const id = Number(espesorMatch[1]);
        const item = await catalogosService.eliminarEspesor(id);
        if (!item) return json(res, { error: 'No encontrado' }, 404), true;
        json(res, { ok: true, item });
        return true;
    }
    return false;
};

const handleInventario = async (req, res, urlPath, q) => {
    if (urlPath === '/api/inv/movimientos' && req.method === 'GET') {
        json(res, await inventarioService.getMovimientos(q));
        return true;
    }
    if (urlPath === '/api/inv/movimientos' && req.method === 'POST') {
        const body = await parseBody(req);
        const sanitized = sanitizeObject(body);
        try { json(res, await inventarioService.crearMovimiento(sanitized), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }
    const movMatch = urlPath.match(/^\/api\/inv\/movimientos\/(\d+)$/);
    if (movMatch && req.method === 'DELETE') {
        const id = Number(movMatch[1]);
        await inventarioService.eliminarMovimiento(id);
        json(res, { ok: true });
        return true;
    }
    if (urlPath === '/api/inv/inventario' && req.method === 'GET') {
        json(res, await inventarioService.getInventario(q));
        return true;
    }
    if (urlPath === '/api/inv/estadisticas' && req.method === 'GET') {
        json(res, await inventarioService.getEstadisticas());
        return true;
    }
    if (urlPath === '/api/inv/estadisticas-por-tipo' && req.method === 'GET') {
        json(res, await inventarioService.getEstadisticasPorTipo());
        return true;
    }
    if (urlPath === '/api/inv/autonomia' && req.method === 'GET') {
        json(res, await catalogosService.getAutonomia());
        return true;
    }
    if (urlPath === '/api/inv/alertas' && req.method === 'GET') {
        json(res, await catalogosService.getAlertas());
        return true;
    }
    return false;
};

module.exports = { handleCatalogos, handleInventario };
