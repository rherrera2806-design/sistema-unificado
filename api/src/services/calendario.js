// Calendario laboral de producción (Configuración → Calendario).
// REGLA DEL NEGOCIO: los días laborales se definen MES A MES en
// calendario_produccion (fecha, es_laboral, motivo). Las fechas que NO están
// en la tabla usan el fallback clásico: laboral salvo sábado/domingo.
//
// Todos los servicios que mueven fechas (planificar, reprogramar, cascadas)
// deben usar este helper para no programar sobre días bloqueados.
const { query } = require('../config/database');

let calMap = null;          // { 'YYYY-MM-DD': boolean }
let calMapCargadoEn = 0;
const TTL = 5 * 60 * 1000;  // recarga cada 5 min (el calendario se edita a mano)

async function cargarCalendario() {
    const ahora = Date.now();
    if (calMap && (ahora - calMapCargadoEn) < TTL) return calMap;
    const map = {};
    try {
        const r = await query('SELECT fecha, es_laboral FROM calendario_produccion');
        for (const row of r.rows) {
            const f = typeof row.fecha === 'string'
                ? row.fecha.split('T')[0]
                : new Date(row.fecha).toISOString().slice(0, 10);
            map[f] = !!row.es_laboral;
        }
    } catch (_) { /* sin BD o sin tabla: fallback clásico */ }
    calMap = map;
    calMapCargadoEn = ahora;
    return calMap;
}

function fmt(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** ¿Es día laboral? Respeta el calendario; si la fecha no está cargada, salta sáb/dom. */
async function esDiaLaboral(fechaStr) {
    const map = await cargarCalendario();
    if (Object.prototype.hasOwnProperty.call(map, fechaStr)) return !!map[fechaStr];
    const d = new Date(fechaStr + 'T00:00:00');
    return d.getDay() !== 0 && d.getDay() !== 6;
}

/** Siguiente día laboral estrictamente posterior a fechaStr. */
async function siguienteDiaHabil(fechaStr) {
    const d = new Date(fechaStr + 'T00:00:00');
    do { d.setDate(d.getDate() + 1); } while (!(await esDiaLaboral(fmt(d))));
    return fmt(d);
}

/** Día laboral anterior estrictamente previo a fechaStr (para retrocesos). */
async function anteriorDiaHabil(fechaStr) {
    const d = new Date(fechaStr + 'T00:00:00');
    do { d.setDate(d.getDate() - 1); } while (!(await esDiaLaboral(fmt(d))));
    return fmt(d);
}

/** Fuerza la recarga del calendario (tras editarlo en Configuración). */
function invalidarCalendario() { calMap = null; }

module.exports = { esDiaLaboral, siguienteDiaHabil, anteriorDiaHabil, invalidarCalendario, fmt };
