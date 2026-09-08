const express = require('express');
const router = express.Router();
const catalogos = require('../services/produccionCatalogos');
const { requireAnyPerm, requireAdmin } = require('../middleware/permisos');
const { parseExcel } = require('../utils/excelUtils');

const MOD = 'prod_config';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

router.get('/api/produccion/recetas-bom', canView, async (req, res, next) => { res.json(await catalogos.getRecetasBom()); });

router.post('/api/produccion/recetas-bom', canCreate, async (req, res, next) => {
    if (!req.body.codigo_sap_padre || !req.body.materia_prima_id) return res.status(400).json({ error: 'Código SAP y materia prima requeridos' });
    res.json(await catalogos.crearRecetaBom(req.body));
});

router.put('/api/produccion/recetas-bom/:id', canUpdate, async (req, res, next) => {
    try {
        const r = await catalogos.actualizarRecetaBom(Number(req.params.id), req.body);
        res.json(r);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/produccion/recetas-bom/all', canDelete, requireAdmin, async (req, res, next) => {
    try {
        const r = await catalogos.eliminarTodasRecetasBom();
        res.json({ ok: true, eliminados: r });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/api/produccion/recetas-bom/preview', canView, async (req, res, next) => {
    if (!req.body.excel_data) return res.status(400).json({ error: 'Datos del archivo requeridos' });
    try {
        const rows = parseExcel(req.body.excel_data, { debug: true });
        if (!rows.length) return res.status(400).json({ error: 'Archivo vacio' });
        const result = await catalogos.previewRecetasBom(rows);
        result._rawKeys = Object.keys(rows[0] || {});
        result._rawFirstRow = rows[0] || {};
        res.json(result);
    } catch (e) { res.status(500).json({ error: 'Error al leer archivo: ' + e.message }); }
});

router.post('/api/produccion/recetas-bom/importar', canCreate, async (req, res, next) => {
    if (!req.body.excel_data) return res.status(400).json({ error: 'Datos del archivo requeridos' });
    try {
        const rows = parseExcel(req.body.excel_data);
        if (!rows.length) return res.status(400).json({ error: 'Archivo vacio' });
        res.json(await catalogos.importarRecetasBom(rows));
    } catch (e) { res.status(500).json({ error: 'Error al procesar: ' + e.message }); }
});

router.delete('/api/produccion/recetas-bom/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarRecetaBom(Number(req.params.id));
    res.json({ ok: true });
});

router.delete('/api/produccion/recetas/all', canDelete, requireAdmin, async (req, res, next) => {
    res.json({ eliminados: await catalogos.eliminarTodasRecetasAntiguas() });
});

router.post('/api/produccion/recetas/importar', canCreate, async (req, res, next) => {
    let parsedRows = req.body.rows;
    if (!parsedRows && req.body.excel_data) {
        try {
            parsedRows = parseExcel(req.body.excel_data);
        } catch (e) { return res.status(400).json({ error: 'Error al parsear Excel: ' + e.message }); }
    }
    if (!Array.isArray(parsedRows) || !parsedRows.length) return res.status(400).json({ error: 'No hay datos para importar' });
    res.json(await catalogos.importarRecetasAntiguas(parsedRows));
});

router.get('/api/produccion/recetas', canView, async (req, res, next) => { res.json(await catalogos.getRecetasAntiguas()); });

router.post('/api/produccion/recetas', canCreate, async (req, res, next) => {
    if (!req.body.codigo_sap_padre || !req.body.codigo_materia_prima) return res.status(400).json({ error: 'Código padre y materia prima requeridos' });
    try { res.status(201).json(await catalogos.crearRecetaAntigua(req.body)); }
    catch (e) { res.status(500).json({ error: 'Error al crear receta: ' + e.message }); }
});

router.delete('/api/produccion/recetas/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarRecetaAntigua(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/reglas-extras', canView, async (req, res, next) => { res.json(await catalogos.getReglasExtras()); });

router.post('/api/produccion/reglas-extras', canCreate, async (req, res, next) => {
    if (!req.body.nombre_flag || !req.body.estacion_id) return res.status(400).json({ error: 'Flag y estación requeridos' });
    res.json(await catalogos.crearReglaExtra(req.body));
});

router.put('/api/produccion/reglas-extras/:id', canUpdate, async (req, res, next) => {
    await catalogos.editarReglaExtra(Number(req.params.id), req.body);
    res.json({ ok: true });
});

router.delete('/api/produccion/reglas-extras/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarReglaExtra(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/tecnicos', canView, async (req, res, next) => { res.json(await catalogos.getTecnicos()); });

router.post('/api/produccion/tecnicos', canCreate, async (req, res, next) => {
    if (!req.body.nombre || !req.body.nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    try { res.json(await catalogos.crearTecnico(req.body.nombre)); }
    catch (e) { next(e); }
});

router.put('/api/produccion/tecnicos/:id', canUpdate, async (req, res, next) => {
    await catalogos.editarTecnico(Number(req.params.id), req.body);
    res.json({ ok: true });
});

router.delete('/api/produccion/tecnicos/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarTecnico(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/vendedores', canView, async (req, res, next) => { res.json(await catalogos.getVendedores()); });

router.post('/api/produccion/vendedores', canCreate, async (req, res, next) => {
    if (!req.body.nombre || !req.body.nombre.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    try { res.json(await catalogos.crearVendedor(req.body.nombre)); }
    catch (e) { next(e); }
});

router.put('/api/produccion/vendedores/:id', canUpdate, async (req, res, next) => {
    await catalogos.editarVendedor(Number(req.params.id), req.body);
    res.json({ ok: true });
});

router.delete('/api/produccion/vendedores/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarVendedor(Number(req.params.id));
    res.json({ ok: true });
});

module.exports = router;
