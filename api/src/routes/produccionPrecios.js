const express = require('express');
const router = express.Router();
const precios = require('../services/sapPrecios');
const { requireAnyPerm } = require('../middleware/permisos');
const { asyncHandler } = require('../middleware/asyncHandler');

// Se reutiliza el permiso del módulo de planificación de Producción (quien
// puede importar órdenes de SAP puede cargar sus precios de venta).
const MOD = 'prod_planificacion';
const canView   = requireAnyPerm(MOD);
const canCreate = requireAnyPerm(`${MOD}.agregar`);

// Importar Excel de precios (pedido + item + precio unitario).
// Acepta rows ya parseados o excel_data en base64 (mismo patrón que
// /api/produccion/importar).
router.post('/api/produccion/precios-sap/importar', canCreate, asyncHandler(async (req, res) => {
    let rows = req.body.rows;
    if (!rows && req.body.excel_data) {
        const { parseExcelSimple } = require('../utils/excelUtils');
        rows = parseExcelSimple(req.body.excel_data);
    }
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'El archivo Excel esta vacio' });
    console.log('[PRECIOS] Importando', rows.length, 'filas desde', req.body.file_name || 'excel');
    res.json(await precios.importarPrecios(rows));
}));

// Listar precios cargados (con cruce a órdenes y vendedor).
router.get('/api/produccion/precios-sap', canView, asyncHandler(async (req, res) => {
    res.json(await precios.getPrecios());
}));

// Resumen (cuántos precios, a cuántas órdenes llegan).
router.get('/api/produccion/precios-sap/resumen', canView, asyncHandler(async (req, res) => {
    res.json(await precios.getResumen());
}));

// Plantilla Excel mínima para que el usuario sepa qué columnas subir.
router.get('/api/produccion/precios-sap/template', canView, (req, res) => {
    const XLSX = require('xlsx');
    const headers = ['pedido', 'item', 'precio unitario', 'cantidad', 'cliente'];
    const example = ['111102', 1, 150000, 2, 'PRISMA S.A.'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = headers.map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Precios SAP');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename="precios_sap.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

module.exports = router;
