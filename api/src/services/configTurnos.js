// Configuración del REPARTO DE CAPACIDAD POR TURNO (Configuración → Turnos).
// La capacidad diaria de cada estación (cap_max m²/día) se divide entre el
// turno DÍA y el NOCHE según este porcentaje, configurable con una barra:
//   pct_dia = 60  →  día 60% / noche 40%
//   pct_dia = 50  →  50% / 50%
// REGLA: un día tiene 2 turnos y los procesos pueden encadenarse de un turno
// al siguiente (sin esperas): Pulido 🌞 lunes → Templado 🌙 lunes.
const { query } = require('../config/database');

const TABLA = 'turnos_config';

async function asegurarTabla() {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLA} (
        id INTEGER PRIMARY KEY DEFAULT 1,
        pct_dia INTEGER NOT NULL DEFAULT 50,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`INSERT INTO ${TABLA} (id, pct_dia) VALUES (1, 50) ON CONFLICT (id) DO NOTHING`);
}

/** { pct_dia: 50, pct_noche: 50 } — el porcentaje de capacidad por turno. */
async function getConfigTurnos() {
    try {
        await asegurarTabla();
        const r = await query(`SELECT pct_dia FROM ${TABLA} WHERE id = 1`);
        let pctDia = Number(r.rows[0] && r.rows[0].pct_dia);
        if (!Number.isFinite(pctDia) || pctDia < 10 || pctDia > 90) pctDia = 50;
        return { pct_dia: pctDia, pct_noche: 100 - pctDia };
    } catch (_) {
        return { pct_dia: 50, pct_noche: 50 };
    }
}

/** Guarda el porcentaje del turno DÍA (10-90); el resto es del NOCHE. */
async function setConfigTurnos(pctDia) {
    const pct = Math.max(10, Math.min(90, Math.round(Number(pctDia) || 50)));
    await asegurarTabla();
    await query(`UPDATE ${TABLA} SET pct_dia = $1, updated_at = NOW() WHERE id = 1`, [pct]);
    return { pct_dia: pct, pct_noche: 100 - pct };
}

/**
 * Capacidad en m² para un (estación, turno) según cap_max y el reparto.
 * capMax viene de estaciones_maestras.cap_max (m²/día).
 */
function capacidadTurno(capMax, turno, config) {
    const cap = Number(capMax) || 0;
    if (!(cap > 0)) return 0;   // 0 = sin capacidad configurada (sin tope)
    const pct = turno === 'noche' ? (config.pct_noche || 50) : (config.pct_dia || 50);
    return cap * pct / 100;
}

module.exports = { getConfigTurnos, setConfigTurnos, capacidadTurno };
