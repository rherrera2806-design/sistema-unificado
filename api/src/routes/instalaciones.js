const { parseBody, json } = require('../middleware/parser');
const instalaciones = require('../services/instalaciones');

const getUserEmail = (req) => req.headers['x-user-email'] || 'Sistema';

const handleInstalaciones = async (req, res, urlPath, q) => {
    if (urlPath === '/api/instalaciones/calendario' && req.method === 'GET') {
        if (!q.inicio || !q.fin) { json(res, { error: 'Fechas requeridas' }, 400); return true; }
        try {
            json(res, await instalaciones.getCalendario(q.inicio, q.fin));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/instalaciones/tecnicos' && req.method === 'GET') {
        try {
            json(res, await instalaciones.getTecnicos());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/instalaciones/vendedores' && req.method === 'GET') {
        try {
            json(res, await instalaciones.getVendedores());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/instalaciones' && req.method === 'GET') {
        try {
            json(res, await instalaciones.getInstalaciones());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/instalaciones' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.cliente || !body.direccion || !body.fecha_programada) {
            json(res, { error: 'Cliente, dirección y fecha requeridos' }, 400);
            return true;
        }
        try {
            json(res, await instalaciones.crearInstalacion(body, getUserEmail(req)), 201);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // Rutas con ID
    const estadoMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)\/estado$/);
    if (estadoMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try {
            await instalaciones.cambiarEstado(parseInt(estadoMatch[1]), body.estado, body.detalle, getUserEmail(req));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, e.message === 'Estado inválido' ? 400 : 500); }
        return true;
    }

    const cerrarMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)\/cerrar$/);
    if (cerrarMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try {
            await instalaciones.cerrarInstalacion(parseInt(cerrarMatch[1]), body.notas_cierre, body.firma_cliente, getUserEmail(req));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const fotosMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)\/fotos$/);
    if (fotosMatch && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.fotos || !Array.isArray(body.fotos)) { json(res, { error: 'fotos array requerido' }, 400); return true; }
        try {
            await instalaciones.subirFotos(parseInt(fotosMatch[1]), body.fotos, getUserEmail(req));
            json(res, { ok: true, count: body.fotos.length });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (fotosMatch && req.method === 'GET') {
        try {
            json(res, await instalaciones.getFotos(parseInt(fotosMatch[1])));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const fotoMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)\/foto\/(\d+)$/);
    if (fotoMatch && req.method === 'GET') {
        try {
            const foto = await instalaciones.getFoto(parseInt(fotoMatch[2]));
            if (!foto) { json(res, { error: 'Foto no encontrada' }, 404); return true; }
            res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
            res.end(foto);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (fotoMatch && req.method === 'DELETE') {
        try {
            await instalaciones.eliminarFoto(parseInt(fotoMatch[1]), parseInt(fotoMatch[2]), getUserEmail(req));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const historialMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)\/historial$/);
    if (historialMatch && req.method === 'GET') {
        try {
            json(res, await instalaciones.getHistorial(parseInt(historialMatch[1])));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const idMatch = urlPath.match(/^\/api\/instalaciones\/(\d+)$/);
    if (idMatch && req.method === 'GET') {
        try {
            const inst = await instalaciones.getInstalacion(parseInt(idMatch[1]));
            if (!inst) { json(res, { error: 'No encontrada' }, 404); return true; }
            json(res, inst);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (idMatch && req.method === 'PUT') {
        const body = await parseBody(req);
        try {
            await instalaciones.editarInstalacion(parseInt(idMatch[1]), body, getUserEmail(req));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (idMatch && req.method === 'DELETE') {
        try {
            await instalaciones.eliminarInstalacion(parseInt(idMatch[1]));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    return false;
};

module.exports = { handleInstalaciones };
