const express = require('express');
const router = express.Router();
const { R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, r2CurlUpload } = require('../config/r2');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'pedidos';
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);

router.post('/api/r2/upload', canCreate, async (req, res, next) => {
    if (!R2_ACCESS_KEY_ID) return res.status(500).json({ error: 'R2 no configurado' });
    const { fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'fileName requerido' });
    const key = `pedidos/${fileName}`;
    res.json({ key, url: `${R2_PUBLIC_URL}/${key}` });
});

router.post('/api/r2/direct-upload', canCreate, async (req, res, next) => {
    if (!R2_ACCESS_KEY_ID) return res.status(500).json({ error: 'R2 no configurado' });
    const { fileName, fileBase64 } = req.body;
    if (!fileName || !fileBase64) return res.status(400).json({ error: 'fileName y fileBase64 requeridos' });
    try {
        const key = `pedidos/${fileName}`;
        const buffer = Buffer.from(fileBase64, 'base64');
        await r2CurlUpload(key, buffer);
        res.json({ key, url: `${R2_PUBLIC_URL}/${key}` });
    } catch (e) { res.status(500).json({ error: 'Error al subir' }); }
});

router.get('/api/r2/test', canView, (req, res) => {
    res.json({ ok: !!R2_ACCESS_KEY_ID, bucket: R2_BUCKET_NAME });
});

module.exports = router;
