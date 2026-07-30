const { parseBody, json } = require('../middleware/parser');
const taller = require('../services/taller');

async function handleTaller(req, res, urlPath, q) {
    // GET /api/taller/estaciones
    if (urlPath === '/api/taller/estaciones' && req.method === 'GET') {
        try {
            json(res, await taller.getEstacionesConCarga());
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/taller/colaxestacion/:id
    const colaMatch = urlPath.match(/^\/api\/taller\/colaxestacion\/(\d+)$/);
    if (colaMatch && req.method === 'GET') {
        try {
            json(res, await taller.getColaPorEstacion(colaMatch[1]));
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/taller/iniciar
    if (urlPath === '/api/taller/iniciar' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.paso_id) {
                json(res, { error: 'paso_id requerido' }, 400);
                return true;
            }
            await taller.iniciarPaso(body.paso_id);
            json(res, { ok: true });
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/taller/finalizar
    if (urlPath === '/api/taller/finalizar' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.paso_id) {
                json(res, { error: 'paso_id requerido' }, 400);
                return true;
            }
            const result = await taller.finalizarPaso(body.paso_id);
            if (!result) {
                json(res, { error: 'Paso no encontrado' }, 404);
                return true;
            }
            json(res, { ok: true, ...result });
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    // POST /api/taller/merma
    if (urlPath === '/api/taller/merma' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.paso_id || !body.causa) {
                json(res, { error: 'paso_id y causa requeridos' }, 400);
                return true;
            }
            const userEmail = req.headers['x-user-email'] || body.operario || 'Operario';
            const result = await taller.registrarMerma({ ...body, userEmail });
            if (!result) {
                json(res, { error: 'Paso no encontrado' }, 404);
                return true;
            }
            if (result.cantidadRestante > 0) {
                const cantidadMermada = Number(body.cantidad) || 1;
                json(res, { ok: true, ...result, mensaje: `Merma registrada. Reposicion #${result.nuevaOrdenId} por ${cantidadMermada} unidades.` });
            } else {
                json(res, { ok: true, ...result, mensaje: `Merma total. Reposicion #${result.nuevaOrdenId} creada.` });
            }
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    // GET /api/taller/mermas
    if (urlPath === '/api/taller/mermas' && req.method === 'GET') {
        try {
            const hoy = q.fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
            json(res, await taller.getMermas(hoy));
        } catch (e) {
            json(res, { error: e.message }, 500);
        }
        return true;
    }

    return false;
}

module.exports = { handleTaller };
