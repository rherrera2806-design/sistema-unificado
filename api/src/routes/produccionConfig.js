const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const config = require('../services/produccionConfig');
const catalogos = require('../services/produccionCatalogos');

const checkAdmin = async (req) => {
    const userEmail = req.headers['x-user-email'];
    const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
    return userRes.rows.length > 0 && userRes.rows[0].permisos.includes('usuarios');
};

router.get('/api/produccion/maquinas', async (req, res, next) => { res.json(await config.getMaquinas()); });

router.post('/api/produccion/maquinas/import', async (req, res, next) => {
    if (!Array.isArray(req.body.maquinas) || req.body.maquinas.length === 0) return res.status(400).json({ error: 'No hay máquinas para importar' });
    res.json(await config.importarMaquinas(req.body.maquinas));
});

router.post('/api/produccion/maquinas', async (req, res, next) => {
    if (!req.body.nombre || !req.body.codigo) return res.status(400).json({ error: 'Nombre y código requeridos' });
    try { res.status(201).json(await config.crearMaquina(req.body)); }
    catch (e) { next(e); }
});

router.put('/api/produccion/maquinas/:id', async (req, res, next) => {
    try { await config.editarMaquina(Number(req.params.id), req.body); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.delete('/api/produccion/maquinas/:id', async (req, res, next) => {
    await config.eliminarMaquina(Number(req.params.id));
    res.json({ ok: true });
});

router.delete('/api/produccion/codigos/all', async (req, res, next) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ error: 'Solo admin' });
    res.json({ ok: true, eliminados: await config.eliminarTodosCodigos() });
});

router.post('/api/produccion/codigos/importar', async (req, res, next) => {
    if (!req.body.excel_data) return res.status(400).json({ error: 'Datos del archivo requeridos' });
    try {
        const XLSX = require('xlsx');
        const buffer = Buffer.from(req.body.excel_data, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (!rows.length) return res.status(400).json({ error: 'Archivo vacio' });
        res.json(await config.importarCodigos(rows));
    } catch (e) { res.status(500).json({ error: 'Error al procesar: ' + e.message }); }
});

router.get('/api/produccion/codigos', async (req, res, next) => {
    res.json(await config.getCodigos(req.query.search || '', parseInt(req.query.limit) || 0));
});

router.post('/api/produccion/codigos', async (req, res, next) => {
    if (!req.body.codigo) return res.status(400).json({ error: 'Codigo requerido' });
    try { res.status(201).json(await config.crearCodigo(req.body)); }
    catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'El codigo ya existe' });
        next(e);
    }
});

router.delete('/api/produccion/codigos/:id', async (req, res, next) => {
    await config.eliminarCodigo(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/estaciones', async (req, res, next) => { res.json(await config.getEstaciones()); });

router.post('/api/produccion/estaciones', async (req, res, next) => {
    if (!req.body.nombre_estacion || !req.body.orden_secuencia_defecto) return res.status(400).json({ error: 'Nombre y orden requeridos' });
    res.json(await config.crearEstacion(req.body));
});

router.put('/api/produccion/estaciones/:id', async (req, res, next) => {
    const result = await config.editarEstacion(Number(req.params.id), req.body);
    res.json(result || { error: 'No encontrado' });
});

router.delete('/api/produccion/estaciones/:id', async (req, res, next) => {
    await config.eliminarEstacion(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/familias', async (req, res, next) => { res.json(await config.getFamilias()); });

router.post('/api/produccion/familias', async (req, res, next) => {
    if (!req.body.codigo_familia || !req.body.nombre_familia) return res.status(400).json({ error: 'Código y nombre requeridos' });
    res.json(await config.crearFamilia(req.body));
});

router.put('/api/produccion/familias/:id', async (req, res, next) => {
    await config.editarFamilia(Number(req.params.id), req.body);
    res.json({ ok: true });
});

router.delete('/api/produccion/familias/:id', async (req, res, next) => {
    await config.eliminarFamilia(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/materias-primas', async (req, res, next) => { res.json(await catalogos.getMateriasPrimas()); });

router.post('/api/produccion/materias-primas', async (req, res, next) => {
    if (!req.body.codigo_mp || !req.body.nombre) return res.status(400).json({ error: 'Código y nombre requeridos' });
    res.json(await catalogos.crearMateriaPrima(req.body));
});

router.put('/api/produccion/materias-primas/:id', async (req, res, next) => {
    const result = await catalogos.editarMateriaPrima(Number(req.params.id), req.body);
    res.json(result || { error: 'No encontrado' });
});

router.delete('/api/produccion/materias-primas/:id', async (req, res, next) => {
    await catalogos.eliminarMateriaPrima(Number(req.params.id));
    res.json({ ok: true });
});

module.exports = router;
