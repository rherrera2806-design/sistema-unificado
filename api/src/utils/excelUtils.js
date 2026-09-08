/**
 * Utilidades compartidas para parsing de archivos Excel.
 * Reemplaza las implementaciones duplicadas en produccionConfig.js, produccionCatalogos.js, etc.
 */

/**
 * Busca un valor en una fila de Excel probando múltiples nombres de columna.
 * @param {Object} row - Fila del Excel como objeto
 * @param {string[]} names - Nombres de columna a buscar (case-insensitive)
 * @returns {*} El valor encontrado o string vacío
 */
function findCol(row, names) {
    const keys = Object.keys(row);
    for (const n of names) {
        const normalized = n.toLowerCase().trim();
        for (const k of keys) {
            if (k.toLowerCase().trim() === normalized) return row[k];
        }
    }
    return '';
}

/**
 * Parsea un archivo Excel desde base64 a array de objetos.
 * @param {string} base64 - Datos del archivo en base64
 * @param {Object} options - Opciones adicionales
 * @param {boolean} options.debug - Si true, imprime logs de debug
 * @returns {Array<Object>} Filas parseadas como objetos
 */
function parseExcel(base64, options = {}) {
    const XLSX = require('xlsx');
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: true, cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    if (options.debug) {
        const range = XLSX.utils.decode_range(sheet['!ref']);
        console.log('[PARSE] Range:', sheet['!ref'], 'Cols:', range.e.c + 1, 'Rows:', range.e.r + 1);
    }

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (options.debug) {
        console.log('[PARSE] Raw row 0:', JSON.stringify(raw[0]));
        console.log('[PARSE] Raw row 1:', JSON.stringify(raw[1]));
        console.log('[PARSE] Total raw rows:', raw.length);
    }

    if (raw.length < 2) return [];

    const headers = raw[0].map(h => String(h || '').trim());

    if (options.debug) {
        console.log('[PARSE] Headers array:', headers);
    }

    const rows = [];
    for (let i = 1; i < raw.length; i++) {
        const row = {};
        let hasData = false;
        for (let j = 0; j < headers.length; j++) {
            if (headers[j]) {
                row[headers[j]] = raw[i][j] !== undefined ? raw[i][j] : '';
                if (row[headers[j]] !== '' && row[headers[j]] !== null && row[headers[j]] !== undefined) hasData = true;
            }
        }
        if (hasData) rows.push(row);
    }

    if (options.debug) {
        console.log('[PARSE] Parsed rows:', rows.length, 'Keys:', Object.keys(rows[0] || {}));
    }

    return rows;
}

/**
 * Parsea un archivo Excel simple (sin opciones de debug).
 * Versión simplificada para uso común.
 * @param {string} base64 - Datos del archivo en base64
 * @returns {Array<Object>} Filas parseadas como objetos
 */
function parseExcelSimple(base64) {
    const XLSX = require('xlsx');
    const buffer = Buffer.from(base64, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
}

module.exports = {
    findCol,
    parseExcel,
    parseExcelSimple
};
