const express = require('express');
const router = express.Router();
const { getReporteFechas, getExportarCorte } = require('../services/produccionReportes');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'prod_reportes';
// Solo lectura: exige el permiso base del modulo
const canView = requireAnyPerm(MOD);

// ===== Lista de corte (Excel) =====
// Orden de columnas EXACTO del archivo de corte de planta:
// Fabric, mprima1, mprima2, Ancho, Alto, Prioridad2, Item, OV, FTermino,
// IdSap, Cliente, Detalle_Sap, Ruta, OC, Procesos, Nota2
router.get('/api/produccion/exportar-corte', canView, async (req, res, next) => {
    try {
        const XLSX = require('xlsx');
        const filas = await getExportarCorte();
        const esp = (n) => (n == null || n === '' ? '' : Number(n).toLocaleString('es-CL', { maximumFractionDigits: 2 }));
        const fCorta = (s) => {
            if (!s) return '';
            const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
            if (isNaN(d.getTime())) return String(s);
            const p = (x) => String(x).padStart(2, '0');
            return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
        };
        const mp = (nombre, espesor) => nombre ? (String(nombre).toUpperCase() + ' ' + esp(espesor)).trim() : '-';
        const rows = filas.map((r) => ({
            Fabric: Number(r.fabric) || 0,
            mprima1: mp(r.mp1_nombre, r.mp1_espesor),
            mprima2: mp(r.mp2_nombre, r.mp2_espesor),
            Ancho: Number(r.ancho) || 0,
            Alto: Number(r.alto) || 0,
            Prioridad2: String(r.prioridad || '').toUpperCase(),
            Item: Number(r.item) || 0,
            OV: r.ov || '',
            FTermino: fCorta(r.f_termino),
            IdSap: r.id_sap || '',
            Cliente: r.cliente || '',
            Detalle_Sap: r.detalle_sap || '',
            Ruta: String(r.ruta || '').toUpperCase(),
            OC: r.oc || '',
            Procesos: r.procesos || '',
            Nota2: fCorta(r.f_termino)
        }));
        const ws = XLSX.utils.json_to_sheet(rows, {
            header: ['Fabric', 'mprima1', 'mprima2', 'Ancho', 'Alto', 'Prioridad2', 'Item', 'OV', 'FTermino', 'IdSap', 'Cliente', 'Detalle_Sap', 'Ruta', 'OC', 'Procesos', 'Nota2']
        });
        ws['!cols'] = [8, 12, 12, 8, 8, 11, 6, 9, 11, 9, 16, 22, 10, 8, 12, 11].map((w) => ({ wch: w }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Lista de Corte');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename="lista_corte_produccion.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buf);
    } catch (e) { next(e); }
});

router.get('/api/produccion/reporte-fechas', canView, async (req, res, next) => {    try {
        const { familia, fecha_inicio, fecha_fin, grupo, estado } = req.query;
        res.json(await getReporteFechas({ familia, fecha_inicio, fecha_fin, grupo, estado }));
    } catch (e) { next(e); }
});

module.exports = router;
