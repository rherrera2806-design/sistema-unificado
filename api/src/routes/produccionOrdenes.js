const { parseBody, json } = require('../middleware/parser');
const ordenes = require('../services/produccionOrdenes');

const handleProduccionOrdenes = async (req, res, urlPath, q) => {
    // Órdenes
    if (urlPath === '/api/produccion/ordenes' && req.method === 'GET') {
        json(res, await ordenes.getOrdenes());
        return true;
    }

    if (urlPath === '/api/produccion/ordenes' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.pedido_sap_id || !body.codigo_producto || !body.ancho || !body.alto) {
            json(res, { error: 'Pedido, codigo, ancho y alto requeridos' }, 400);
            return true;
        }
        try {
            json(res, { ok: true, ...await ordenes.crearOrden(body) }, 201);
        } catch (e) {
            console.error('[PROD] Error crear orden manual:', e.message);
            json(res, { error: 'Error al crear orden: ' + e.message }, 500);
        }
        return true;
    }

    const cerrarMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)\/cerrar$/);
    if (cerrarMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        if (!body.nota) { json(res, { error: 'Motivo de cierre requerido' }, 400); return true; }
        try {
            await ordenes.cerrarOrden(Number(cerrarMatch[1]), body.nota);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const pasosGetMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)\/pasos$/);
    if (pasosGetMatch && req.method === 'GET') {
        json(res, await ordenes.getPasos(Number(pasosGetMatch[1])));
        return true;
    }

    if (pasosGetMatch && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.estacion_id) { json(res, { error: 'Estacion requerida' }, 400); return true; }
        try {
            await ordenes.agregarPaso(Number(pasosGetMatch[1]), body.estacion_id);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }

    const ordenMatch = urlPath.match(/^\/api\/produccion\/ordenes\/(\d+)$/);
    if (ordenMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try {
            json(res, await ordenes.editarOrden(Number(ordenMatch[1]), body));
        } catch (e) { json(res, { error: e.message }, e.message.includes('Sin campos') ? 400 : 500); }
        return true;
    }

    if (ordenMatch && req.method === 'DELETE') {
        try {
            await ordenes.eliminarOrden(Number(ordenMatch[1]));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // Pasos
    const pasoMatch = urlPath.match(/^\/api\/produccion\/pasos\/(\d+)$/);
    if (pasoMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        if (!body.estado) { json(res, { error: 'Estado requerido' }, 400); return true; }
        try {
            await ordenes.actualizarPaso(Number(pasoMatch[1]), body);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (pasoMatch && req.method === 'DELETE') {
        try {
            await ordenes.eliminarPaso(Number(pasoMatch[1]));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    return false;
};

module.exports = { handleProduccionOrdenes };
