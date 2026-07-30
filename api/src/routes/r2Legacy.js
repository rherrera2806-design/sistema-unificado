const { R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, r2CurlUpload } = require('../config/r2');
const { parseBody, json } = require('../middleware/parser');

const handleR2Legacy = async (req, res, urlPath) => {
    if (urlPath === '/api/r2/upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return true; }
        const body = await parseBody(req);
        const { fileName } = body;
        if (!fileName) { json(res, { error: 'fileName requerido' }, 400); return true; }
        const key = `pedidos/${fileName}`;
        json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        return true;
    }
    if (urlPath === '/api/r2/direct-upload' && req.method === 'POST') {
        if (!R2_ACCESS_KEY_ID) { json(res, { error: 'R2 no configurado' }, 500); return true; }
        const body = await parseBody(req);
        const { fileName, fileBase64 } = body;
        if (!fileName || !fileBase64) { json(res, { error: 'fileName y fileBase64 requeridos' }, 400); return true; }
        try {
            const key = `pedidos/${fileName}`;
            const buffer = Buffer.from(fileBase64, 'base64');
            await r2CurlUpload(key, buffer);
            json(res, { key, url: `${R2_PUBLIC_URL}/${key}` });
        } catch (e) { json(res, { error: 'Error al subir' }, 500); }
        return true;
    }
    if (urlPath === '/api/r2/test' && req.method === 'GET') {
        json(res, { ok: R2_ACCESS_KEY_ID ? true : false, bucket: R2_BUCKET_NAME });
        return true;
    }
    return false;
};

module.exports = { handleR2Legacy };
