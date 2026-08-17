const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const config = require('../services/produccionConfig');
const catalogos = require('../services/produccionCatalogos');
const procesosCarroceria = require('../services/procesosCarroceria');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'prod_config';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

const checkAdmin = async (req) => {
    const userEmail = req.headers['x-user-email'];
    const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
    return userRes.rows.length > 0 && userRes.rows[0].permisos.includes('usuarios');
};

router.get('/api/produccion/maquinas', canView, async (req, res, next) => { res.json(await config.getMaquinas()); });

router.post('/api/produccion/maquinas/import', canCreate, async (req, res, next) => {
    if (!Array.isArray(req.body.maquinas) || req.body.maquinas.length === 0) return res.status(400).json({ error: 'No hay máquinas para importar' });
    res.json(await config.importarMaquinas(req.body.maquinas));
});

router.post('/api/produccion/maquinas', canCreate, async (req, res, next) => {
    if (!req.body.nombre || !req.body.codigo) return res.status(400).json({ error: 'Nombre y código requeridos' });
    try { res.status(201).json(await config.crearMaquina(req.body)); }
    catch (e) { next(e); }
});

router.put('/api/produccion/maquinas/:id', canUpdate, async (req, res, next) => {
    try { await config.editarMaquina(Number(req.params.id), req.body); res.json({ ok: true }); }
    catch (e) { next(e); }
});

router.delete('/api/produccion/maquinas/:id', canDelete, async (req, res, next) => {
    await config.eliminarMaquina(Number(req.params.id));
    res.json({ ok: true });
});

router.delete('/api/produccion/codigos/all', canDelete, async (req, res, next) => {
    if (!(await checkAdmin(req))) return res.status(403).json({ error: 'Solo admin' });
    res.json({ ok: true, eliminados: await config.eliminarTodosCodigos() });
});

const parseExcel = (base64) => {
    const XLSX = require('xlsx');
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
};

router.post('/api/produccion/codigos/preview', canView, async (req, res, next) => {
    if (!req.body.excel_data) return res.status(400).json({ error: 'Datos del archivo requeridos' });
    try {
        const rows = parseExcel(req.body.excel_data);
        if (!rows.length) return res.status(400).json({ error: 'Archivo vacio' });
        res.json(config.previewCodigos(rows));
    } catch (e) { res.status(500).json({ error: 'Error al leer archivo: ' + e.message }); }
});

router.post('/api/produccion/codigos/importar', canCreate, async (req, res, next) => {
    if (!req.body.excel_data) return res.status(400).json({ error: 'Datos del archivo requeridos' });
    try {
        const rows = parseExcel(req.body.excel_data);
        if (!rows.length) return res.status(400).json({ error: 'Archivo vacio' });
        res.json(await config.importarCodigos(rows));
    } catch (e) { res.status(500).json({ error: 'Error al procesar: ' + e.message }); }
});

router.get('/api/produccion/codigos', canView, async (req, res, next) => {
    res.json(await config.getCodigos(req.query.search || '', parseInt(req.query.limit) || 0));
});

router.post('/api/produccion/codigos', canCreate, async (req, res, next) => {
    if (!req.body.codigo) return res.status(400).json({ error: 'Codigo requerido' });
    try { res.status(201).json(await config.crearCodigo(req.body)); }
    catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'El codigo ya existe' });
        next(e);
    }
});

router.put('/api/produccion/codigos/:id', canUpdate, async (req, res, next) => {
    try {
        const result = await config.editarCodigo(Number(req.params.id), req.body);
        if (!result) return res.status(404).json({ error: 'Codigo no encontrado' });
        res.json(result);
    } catch (e) { next(e); }
});

router.delete('/api/produccion/codigos/:id', canDelete, async (req, res, next) => {
    await config.eliminarCodigo(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/estaciones', canView, async (req, res, next) => { res.json(await config.getEstaciones()); });

router.post('/api/produccion/estaciones', canCreate, async (req, res, next) => {
    if (!req.body.nombre_estacion || !req.body.orden_secuencia_defecto) return res.status(400).json({ error: 'Nombre y orden requeridos' });
    res.json(await config.crearEstacion(req.body));
});

router.put('/api/produccion/estaciones/:id', canUpdate, async (req, res, next) => {
    const result = await config.editarEstacion(Number(req.params.id), req.body);
    res.json(result || { error: 'No encontrado' });
});

router.delete('/api/produccion/estaciones/:id', canDelete, async (req, res, next) => {
    await config.eliminarEstacion(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/familias', canView, async (req, res, next) => { res.json(await config.getFamilias()); });

router.post('/api/produccion/familias', canCreate, async (req, res, next) => {
    if (!req.body.codigo_familia || !req.body.nombre_familia) return res.status(400).json({ error: 'Código y nombre requeridos' });
    res.json(await config.crearFamilia(req.body));
});

router.put('/api/produccion/familias/:id', canUpdate, async (req, res, next) => {
    await config.editarFamilia(Number(req.params.id), req.body);
    res.json({ ok: true });
});

router.delete('/api/produccion/familias/:id', canDelete, async (req, res, next) => {
    await config.eliminarFamilia(Number(req.params.id));
    res.json({ ok: true });
});

router.get('/api/produccion/materias-primas', canView, async (req, res, next) => { res.json(await catalogos.getMateriasPrimas()); });

router.get('/api/produccion/materias-primas/template', canView, (req, res) => {
    const XLSX = require('xlsx');
    const headers = [
        'Codigo MP', 'Nombre', 'Espesor (mm)',
        'Costo Nacional ($/m2)', 'Hojas por paquete', 'Ancho', 'Alto', 'Paquetes por camion',
        'Costo Importado ($/m2)', 'Hojas por paquete', 'Ancho', 'Alto', 'Paquetes por contenedor',
        'CPM', 'MPA (%)', 'Observacion'
    ];
    const example = ['1017', 'Laminado', 6, 13369, 29, 3600, 2500, 12, 0, 0, 0, 0, 0, 150, 2.5, '3600 x 2500 - Lirquen'];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, 'Materias Primas');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="plantilla_materias_primas.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

router.post('/api/produccion/materias-primas/import', canCreate, async (req, res) => {
    const rows = req.body.rows || [];
    if (!rows.length) return res.status(400).json({ error: 'Sin datos' });
    const resultados = { importados: 0, errores: [] };
    const findCol = (row, names) => {
        for (const n of names) {
            for (const k of Object.keys(row)) {
                if (k.toLowerCase().trim() === n.toLowerCase().trim()) return row[k];
            }
        }
        return '';
    };
    for (let i = 0; i < rows.length; i++) {
        try {
            const r = rows[i];
            const codigo = String(findCol(r, ['Codigo MP', 'Codigo', 'CodigoMP', 'ItemCode']) || '').trim();
            const nombre = String(findCol(r, ['Nombre', 'Name', 'Descripcion']) || '').trim();
            if (!codigo || !nombre) { resultados.errores.push({ fila: i + 1, error: 'Sin codigo o nombre' }); continue; }
            const data = {
                codigo_mp: codigo, nombre,
                espesor_mm: parseFloat(findCol(r, ['Espesor', 'Espesor (mm)', 'EspesorMM']) || 0) || 0,
                costo_unitario_mp: parseFloat(findCol(r, ['Costo Nacional ($/m2)', 'Costo Nac', 'CostoNac', 'Costo Unitario']) || 0) || 0,
                hojas_por_paquete_nal: parseInt(findCol(r, ['Hojas por paquete Nac', 'Hojas Pqt Nac', 'HojasNac']) || 0) || 0,
                ancho_nal: parseFloat(findCol(r, ['Ancho Nac', 'AnchoNac', 'Ancho']) || 0) || 0,
                alto_nal: parseFloat(findCol(r, ['Alto Nac', 'AltoNac', 'Alto']) || 0) || 0,
                paquetes_por_camion: parseInt(findCol(r, ['Paquetes por camion', 'Pqt Camion', 'PaqCamion']) || 0) || 0,
                costo_unitario_importado: parseFloat(findCol(r, ['Costo Importado ($/m2)', 'Costo Imp', 'CostoImp']) || 0) || 0,
                hojas_por_paquete_imp: parseInt(findCol(r, ['Hojas por paquete Imp', 'Hojas Pqt Imp', 'HojasImp']) || 0) || 0,
                ancho_imp: parseFloat(findCol(r, ['Ancho Imp', 'AnchoImp']) || 0) || 0,
                alto_imp: parseFloat(findCol(r, ['Alto Imp', 'AltoImp']) || 0) || 0,
                paquetes_por_contenedor: parseInt(findCol(r, ['Paquetes por contenedor', 'Pqt Contenedor', 'PaqContenedor']) || 0) || 0,
                consumo_promedio_mensual: parseInt(findCol(r, ['CPM', 'Consumo Promedio Mensual', 'Consumo Mensual', 'ConsumoMensual']) || 0) || 0,
                observacion: String(findCol(r, ['Observacion', 'Observacion', 'Nota']) || '').trim(),
                mpa: parseFloat(findCol(r, ['MPA', 'Merma', 'Merma Promedio', 'Merma Aprovechamiento']) || 0) || 0
            };
            await catalogos.crearMateriaPrima(data);
            resultados.importados++;
        } catch (e) { resultados.errores.push({ fila: i + 1, error: e.message }); }
    }
    res.json({ ok: true, ...resultados });
});

router.post('/api/produccion/materias-primas', canCreate, async (req, res, next) => {
    if (!req.body.codigo_mp || !req.body.nombre) return res.status(400).json({ error: 'Código y nombre requeridos' });
    res.json(await catalogos.crearMateriaPrima(req.body));
});

router.put('/api/produccion/materias-primas/:id', canUpdate, async (req, res, next) => {
    try {
        const result = await catalogos.editarMateriaPrima(Number(req.params.id), req.body);
        res.json(result || { error: 'No encontrado' });
    } catch (e) { next(e); }
});

router.delete('/api/produccion/materias-primas/:id', canDelete, async (req, res, next) => {
    await catalogos.eliminarMateriaPrima(Number(req.params.id));
    res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════
// PROCESOS CARROCERIA (Mapeo codigo_sap -> estaciones)
// ═══════════════════════════════════════════════════════

router.get('/api/produccion/procesos-carroceria', canView, async (req, res, next) => {
    try { res.json(await procesosCarroceria.getAll()); } catch (e) { next(e); }
});

router.get('/api/produccion/procesos-carroceria/count', canView, async (req, res, next) => {
    try { res.json({ count: await procesosCarroceria.count() }); } catch (e) { next(e); }
});

router.get('/api/produccion/procesos-carroceria/sap/:codigo', canView, async (req, res, next) => {
    try {
        const r = await procesosCarroceria.getByCodigoSap(req.params.codigo);
        if (!r) return res.status(404).json({ error: 'No encontrado' });
        res.json(r);
    } catch (e) { next(e); }
});

router.post('/api/produccion/procesos-carroceria', canCreate, async (req, res, next) => {
    try {
        const r = await procesosCarroceria.upsert(req.body);
        res.status(201).json(r);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/api/produccion/procesos-carroceria/:id', canUpdate, async (req, res, next) => {
    try {
        const r = await procesosCarroceria.upsert(req.body);
        res.json(r);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/produccion/procesos-carroceria/:id', canDelete, async (req, res, next) => {
    try {
        const ok = await procesosCarroceria.remove(Number(req.params.id));
        if (!ok) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.delete('/api/produccion/procesos-carroceria/all/all', canDelete, async (req, res, next) => {
    try {
        const eliminados = await procesosCarroceria.removeAll();
        res.json({ ok: true, eliminados });
    } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/api/produccion/procesos-carroceria/importar', canCreate, async (req, res, next) => {
    try {
        const { filas } = req.body;
        if (!Array.isArray(filas) || filas.length === 0) {
            return res.status(400).json({ error: 'Lista de filas vacía' });
        }
        const r = await procesosCarroceria.importarMasivo(filas);
        res.json(r);
    } catch (e) { res.status(400).json({ error: e.message }); }
});

module.exports = router;
