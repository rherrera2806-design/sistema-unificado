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
            'FTermino', 'IdSap', 'Cliente', 'Detalle_Sap', 'Ruta', 'OC', 'Procesos', '', 'Nota2', 'Nota8', 'Nota9'];
        const f1 = (v) => Number(v || 0).toLocaleString('es-CL', { maximumFractionDigits: 1 });
        // Fecha con guiones para las notas (formato del archivo de ejemplo)
        const fGuion = (s) => { const t = fCorta(s); return t.split('/').join('-'); };
        const rows = filas.map((r) => {
            const ancho = Number(r.ancho) || 0;
            const alto = Number(r.alto) || 0;
            const espesor = (r.mp1_espesor == null || r.mp1_espesor === '') ? '' : Number(r.mp1_espesor);
            const m2u = (ancho * alto) / 1000000;
            const kgu = m2u * (Number(espesor) || 0) * 2.5;
            // Descripcion2: 836 x 862 x 5 mm (9 Kg) - (0,7 M²)
            const desc2 = `${ancho} x ${alto} x ${espesor} mm (${f1(kgu)} Kg) - (${f1(m2u)} M²)`;
            // Nota8: SAP: V4761 - EXPRESS
            const nota8 = `SAP: ${r.id_sap || ''} - ${String(r.prioridad || '').toUpperCase()}`;
            // Nota9: V4761|23-10-2026|111805-101|1.072 (al item se le antepone 10; M² con 3 decimales)
            const nota9 = `${r.id_sap || ''}|${fGuion(r.f_termino)}|${r.ov || ''}-10${Number(r.item) || 0}|${m2u.toFixed(3)}`;
            return [
                Number(r.fabric) || 0,
                r.mp1_codigo || '-',
                r.mp2_codigo || '-',
                ancho,
                alto,
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
                desc2,
                fCorta(r.f_termino),
                nota8,
                nota9
            ];
        });
        const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
        ws['!cols'] = [8, 9, 9, 8, 8, 11, 6, 9, 11, 9, 16, 22, 10, 8, 12, 30, 11, 22, 30].map((w) => ({ wch: w }));
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
