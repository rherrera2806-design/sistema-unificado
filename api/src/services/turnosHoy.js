// ============================================================================
// turnosHoy.js — Turnos RESTANTES de HOY según los horarios configurados
// (Configuración → Horarios de Turno, tabla turnos_semanales).
//
// REGLA DE ACREDITACIÓN (misma que toda la planta): el turno se acredita al
// día en que TERMINA. Ej: Lun 22:00 → Mar 07:30 = Martes. Por eso, para
// saber qué queda de HOY hay que mirar las ventanas de ayer y de hoy:
//   · Noche de AYER que termina hoy temprano  → turno NOCHE de hoy
//   · Día de HOY (08:00→18:00)               → turno DIA de hoy
//   · Noche de HOY (22:00→mañana 06:00)       → NO cuenta para hoy (es de mañana)
//
// La capacidad restante de un turno en curso se recorta PROPORCIONALMENTE
// al tiempo que falta (decisión de planta): 14:00 con turno día 08:00→18:00
// = 40% restante.
//
// Usado por: el modal único de Programación (preguntar al planificador qué
// turnos de hoy aplican) y por el motor unificado
// planificacionMotor.js (recortar la capacidad de hoy).
// ============================================================================
const { query } = require('../config/database');

const fmtL = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const mismoDia = (a, b) => fmtL(a) === fmtL(b);
// "Ahora" SIEMPRE en hora de CHILE: el servidor (Railway) corre en UTC — sin
// esta conversión, a las 10:38 de Chile el servidor calculaba con 13:38 y el
// % restante de cada turno salía más bajo de lo real.
const ahoraChile = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));

// Sin configuración del mes: 06:00-22:00 día / 22:00-06:00 noche (mismo
// respaldo que taller.getTurnoActual).
const VENTANAS_RESPALDO = [
    { turno: 'dia', hora_inicio: '06:00', hora_fin: '22:00', dia_siguiente: false },
    { turno: 'noche', hora_inicio: '22:00', hora_fin: '06:00', dia_siguiente: true }
];

/**
 * Versión PURA (testeable): dadas las filas de turnos_semanales del mes y el
 * instante "ahora", devuelve los turnos acreditados a HOY con su % restante.
 * Retorna { hoy, ahora, disponible, turnos: [{turno, pct_restante, inicio, fin, termina_hoy}] }
 *   · pct_restante en 0..1 (0 = ya terminó / no sirve; 1 = completo por venir)
 *   · disponible = true si al menos un turno queda con pct > 0
 */
function calcularTurnosRestantes(filas, ahora = new Date()) {
    const cfg = (filas || []).filter(h => h && h.hora_inicio && h.hora_fin);
    // Se miran ayer y hoy: lo de ANOCHE que termina HOY es el turno noche de hoy
    const candidatas = [];
    for (let atras = 0; atras <= 1; atras++) {
        const d = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - atras);
        const diaSemana = d.getDay();
        const delDia = cfg.length
            ? cfg.filter(h => Number(h.dia_semana) === diaSemana)
            : VENTANAS_RESPALDO.filter(h => Number(h.dia_semana ?? -1) === diaSemana || !h.dia_semana);
        for (const h of delDia) {
            const [hi, mi] = String(h.hora_inicio).split(':').map(Number);
            const [hf, mf] = String(h.hora_fin).split(':').map(Number);
            if (!Number.isFinite(hi) || !Number.isFinite(hf)) continue;
            const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi);
            const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (h.dia_siguiente ? 1 : 0), hf, mf);
            if (!(fin > ini)) continue;                 // ventana inválida
            if (!mismoDia(fin, ahora)) continue;        // solo turnos que TERMINAN hoy (acreditación)
            candidatas.push({ turno: String(h.turno).toLowerCase(), inicio: ini, fin });
        }
    }

    // Una fila por turno (por si la config duplica): queda el MAYOR restante
    const porTurno = {};
    for (const c of candidatas) {
        const dur = c.fin - c.inicio;
        let pct = 0;
        if (ahora < c.inicio) pct = 1;                       // aún no empieza
        else if (ahora < c.fin) pct = (c.fin - ahora) / dur; // en curso → proporcional
        const prev = porTurno[c.turno];
        if (!prev || pct > prev.pct_restante) {
            porTurno[c.turno] = {
                turno: c.turno,
                pct_restante: Math.round(pct * 1000) / 1000, // 3 decimales bastan
                inicio: String(c.inicio.getHours()).padStart(2, '0') + ':' + String(c.inicio.getMinutes()).padStart(2, '0'),
                fin: String(c.fin.getHours()).padStart(2, '0') + ':' + String(c.fin.getMinutes()).padStart(2, '0')
            };
        }
    }

    // Orden del motor: turno 1 (noche) primero, luego turno 2 (día)
    const orden = { noche: 0, dia: 1 };
    const turnos = Object.values(porTurno).sort((a, b) => (orden[a.turno] ?? 9) - (orden[b.turno] ?? 9));
    return {
        hoy: fmtL(ahora),
        ahora: String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0'),
        disponible: turnos.some(t => t.pct_restante > 0),
        turnos
    };
}

/** Lee turnos_semanales del mes actual (con fallback al mes anterior para
 *  turnos que cruzan medianoche entre meses) y calcula los restantes de hoy. */
async function getTurnosRestantesHoy(ahora = ahoraChile()) {
    let filas = [];
    try {
        const r = await query(
            `SELECT dia_semana, turno, to_char(hora_inicio, 'HH24:MI') as hora_inicio,
                    to_char(hora_fin, 'HH24:MI') as hora_fin, dia_siguiente
             FROM turnos_semanales
             WHERE (anio = $1 AND mes = $2)
                OR (anio = $3 AND mes = $4)`,
            [ahora.getFullYear(), ahora.getMonth() + 1,
             ahora.getMonth() === 0 ? ahora.getFullYear() - 1 : ahora.getFullYear(),
             ahora.getMonth() === 0 ? 12 : ahora.getMonth()]);
        filas = r.rows || [];
    } catch (_) { filas = []; }
    return calcularTurnosRestantes(filas, ahora);
}

module.exports = { getTurnosRestantesHoy, calcularTurnosRestantes };
