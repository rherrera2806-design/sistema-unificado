const { parseBody, json } = require('../middleware/parser');
const adminService = require('../services/adminUsuarios');

const handleAdminUsuarios = async (req, res, urlPath, q) => {
    if (urlPath === '/api/admin/usuarios' && req.method === 'GET') {
        json(res, await adminService.getAll());
        return true;
    }

    if (urlPath === '/api/admin/usuarios/export' && req.method === 'GET') {
        try {
            const txt = await adminService.exportTxt();
            res.writeHead(200, {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': 'attachment; filename="usuarios_vitroflow.txt"'
            });
            res.end(txt);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/admin/usuarios' && req.method === 'POST') {
        const body = await parseBody(req);
        try { json(res, await adminService.create(body), 201); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }

    const idMatch = urlPath.match(/^\/api\/admin\/usuarios\/(\d+)$/);
    if (idMatch && req.method === 'PUT') {
        const id = Number(idMatch[1]);
        const body = await parseBody(req);
        try { json(res, await adminService.update(id, body)); }
        catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }

    if (idMatch && req.method === 'DELETE') {
        const id = Number(idMatch[1]);
        json(res, await adminService.remove(id));
        return true;
    }

    return false;
};

module.exports = { handleAdminUsuarios };
