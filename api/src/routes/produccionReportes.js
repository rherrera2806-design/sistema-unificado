const express = require('express');
const router = express.Router();
const { getReporteFechas, getExportarCorte } = require('../services/produccionReportes');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'prod_reportes';
// Solo lectura: exige el permiso base del modulo
const canView = requireAnyPerm(MOD);

// ===== Lista de corte para Optiway 8 (Excel .xls modo compatibilidad) =====
// Orden de columnas EXACTO del archivo que consume Optiway 8 (optimización de
// planchas y etiquetas):
// Fabric, mprima1, mprima2, Ancho, Alto, Prioridad2, Item, OV, FTermino,
// IdSap, Cliente, Detalle_Sap, Ruta, OC, Procesos, (columna vacía), Nota2
// Reglas del archivo:
//   · mprima1/mprima2 = SOLO el código de materia prima (ej: 745), '-' si falta
//   · FTermino y Nota2 = fecha en TEXTO dd/mm/yyyy (igual que el archivo original)
//   · formato .xls (Excel 97-2003, "modo compatibilidad")
router.get('/api/produccion/exportar-corte', canView, async (req, res, next) => {
    try {
        const XLSX = require('xlsx');
        const filas = await getExportarCorte();
        const fCorta = (s) => {
            if (!s) return '';
            const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
            if (isNaN(d.getTime())) return String(s);
            const p = (x) => String(x).padStart(2, '0');
            return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
        };
        const header = ['Fabric', 'mprima1', 'mprima2', 'Ancho', 'Alto', 'Prioridad2', 'Item', 'OV',
            'FTermino', 'IdSap', 'Cliente', 'Detalle_Sap', 'Ruta', 'OC', 'Procesos', '', 'Nota2'];
        const rows = filas.map((r) => [
            Number(r.fabric) || 0,
            r.mp1_codigo || '-',
            r.mp2_codigo || '-',
            Number(r.ancho) || 0,
            Number(r.alto) || 0,
            String(r.prioridad || '').toUpperCase(),
            Number(r.item) || 0,
            r.ov || '',
            fCorta(r.f_termino),
            r.id_sap || '',
            r.cliente || '',
            r.detalle_sap || '',
            String(r.ruta || '').toUpperCase(),
            r.oc || '',
            r.procesos || '',
            '',
            fCorta(r.f_termino)
        ]);
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [8, 9, 9, 8, 8, 11, 6, 9, 11, 9, 16, 22, 10, 8, 12, 3, 11].map((w) => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lista de Corte');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xls' });
        res.setHeader('Content-Disposition', 'attachment; filename="lista_corte_produccion.xls"');
        res.setHeader('Content-Type', 'application/vnd.ms-excel');
        res.send(buf);
    } catch (e) { next(e); }
});

router.get('/api/produccion/reporte-fechas', canView, async (req, res, next) => {    try {
        const { familia, fecha_inicio, fecha_fin, grupo, estado } = req.query;
        res.json(await getReporteFechas({ familia, fecha_inicio, fecha_fin, grupo, estado }));
    } catch (e) { next(e); }
});

module.exports = router;
