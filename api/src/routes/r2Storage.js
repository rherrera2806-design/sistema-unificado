const { R2_ACCESS_KEY_ID } = require('../config/r2');
const { parseBody, json } = require('../middleware/parser');
const r2Service = require('../services/r2Storage');

const requireR2 = (res) => {
    if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return false; }
    return true;
};

const handleR2Storage = async (req, res, urlPath, q) => {
    if (urlPath === '/api/r2/presign-post' && req.method === 'POST') {
        if (!requireR2(res)) return true;
        const body = await parseBody(req);
        if (!body.fileName) { json(res, { error: 'fileName requerido' }, 400); return true; }
        try { json(res, r2Service.generatePresignPost(body.fileName)); }
        catch (e) { json(res, { error: 'Error al generar presign' }, 500); }
        return true;
    }

    if (urlPath === '/api/r2/presign-put' && req.method === 'POST') {
        if (!requireR2(res)) return true;
        const body = await parseBody(req);
        if (!body.fileName) { json(res, { error: 'fileName requerido' }, 400); return true; }
        try { json(res, r2Service.generatePresignPut(body.fileName)); }
        catch (e) { json(res, { error: 'Error al generar presign PUT' }, 500); }
        return true;
    }

    if (urlPath === '/api/r2/download' && req.method === 'GET') {
        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const key = urlObj.searchParams.get('key');
        if (!key) { json(res, { error: 'key es requerida' }, 400); return true; }
        json(res, r2Service.getPublicUrl(key));
        return true;
    }

    if (urlPath === '/api/r2/delete' && req.method === 'DELETE') {
        const body = await parseBody(req);
        if (!body.key) { json(res, { error: 'key es requerida' }, 400); return true; }
        try { json(res, await r2Service.deleteFile(body.key)); }
        catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    return false;
};

module.exports = { handleR2Storage };
