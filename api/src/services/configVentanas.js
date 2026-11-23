// Configuración de VENTANAS RÍGIDAS por prioridad (Configuración → Ventanas).
// Cada regla define los DÍAS HÁBILES desde el ingreso que tiene esa prioridad
// para entrar al plan; una regla puede ser específica de GRUPO (ej: Express de
// Carroceros = 7 días). El motor de planificación SIEMPRE toma estos valores
// (nada de números fijos en el código).
//   · Regla con grupo manda sobre la genérica de la misma prioridad.
//   · dias = 0 → esa prioridad/grupo queda SIN ventana rígida.
//   · Sin regla que aplice → sin ventana.
const { query } = require('../config/database');

const TABLA = 'ventanas_config';

// Defaults (se plantan una sola vez al crear la tabla): reglas históricas.
const DEFAULTS = [
    { nombre: 'Reposición', nivel_prioridad: 4, grupo: null, dias: 2 },
    { nombre: 'Express', nivel_prioridad: 2, grupo: null, dias: 3 },
    { nombre: 'Express Carroceros', nivel_prioridad: 2, grupo: 'Carroceros', dias: 7 },
    { nombre: 'Urgencia', nivel_prioridad: 3, grupo: null, dias: 3 }
];

const _norm = (g) => (g == null ? null : String(g).trim().toLowerCase());

async function asegurarTabla() {
    await query(`CREATE TABLE IF NOT EXISTS ${TABLA} (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(60) NOT NULL,
        nivel_prioridad INTEGER NOT NULL,
        grupo TEXT DEFAULT NULL,
        dias INTEGER NOT NULL DEFAULT 0,
        activa BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // Planta de defaults SOLO si la tabla está vacía: borrar una regla debe
    // persistir (borrar TODAS vuelve a plantar las de fábrica como red de
    // seguridad).
    const n = await query(`SELECT COUNT(*)::int AS n FROM ${TABLA}`);
    if (!n.rows[0].n) {
        for (const d of DEFAULTS) {
            await query(`INSERT INTO ${TABLA} (nombre, nivel_prioridad, grupo, dias) VALUES ($1,$2,$3,$4)`,
                [d.nombre, d.nivel_prioridad, d.grupo, d.dias]);
        }
    }
}

/** Reglas configuradas (para UI y motor). */
async function getConfigVentanas() {
    try {
        await asegurarTabla();
        const r = await query(`SELECT id, nombre, nivel_prioridad, grupo, dias, activa
            FROM ${TABLA} ORDER BY nivel_prioridad, (grupo IS NULL) DESC, grupo, id`);
        return r.rows.length ? r.rows : DEFAULTS.map((d, i) => ({ id: 0, ...d, activa: true }));
    } catch (_) {
        return DEFAULTS.map((d, i) => ({ id: 0, ...d, activa: true }));
    }
}

/**
 * Días de ventana para una orden (la misma regla para el motor y el KPI).
 * Prioridad: regla específica de grupo > regla genérica de la prioridad.
 * @param {Array} reglas  filas de getConfigVentanas()
 * @param {number} prioridad  nivel_prioridad (4 Repo, 2 Express, 3 Urgencia, 1 Normal)
 * @param {string|null} grupo  grupo efectivo de la orden
 * @returns {number|null} días hábiles, o null si no tiene ventana rígida
 */
function ventanaDias(reglas, prioridad, grupo) {
    const lista = (reglas && reglas.length) ? reglas : DEFAULTS;
    const g = _norm(grupo);
    let especifica = null, generica = null;
    for (const r of lista) {
        if (Number(r.nivel_prioridad) !== Number(prioridad)) continue;
        if (r.activa === false) continue;
        const rg = _norm(r.grupo);
        if (rg && g && rg === g) especifica = r;
        else if (rg == null && !generica) generica = r;
    }
    const regla = especifica || generica;
    if (!regla) return null;
    const d = Number(regla.dias);
    return Number.isFinite(d) && d > 0 ? Math.round(d) : null;
}

/** Crea una regla nueva (validada). */
async function crearRegla({ nombre, nivel_prioridad, grupo, dias }) {
    const prio = Number(nivel_prioridad);
    if (![1, 2, 3, 4].includes(prio)) throw new Error('nivel_prioridad debe ser 1-4');
    const d = Math.max(0, Math.round(Number(dias) || 0));
    const nom = String(nombre || '').trim() || (grupo ? `Prioridad ${prio} ${grupo}` : `Prioridad ${prio}`);
    const g = String(grupo || '').trim() || null;
    await asegurarTabla();
    const r = await query(`INSERT INTO ${TABLA} (nombre, nivel_prioridad, grupo, dias) VALUES ($1,$2,$3,$4) RETURNING *`,
        [nom, prio, g, d]);
    return r.rows[0];
}

/** Actualiza nombre / días / activa (no cambia prioridad ni grupo). */
async function actualizarRegla(id, { nombre, dias, activa }) {
    await asegurarTabla();
    const r = await query(`UPDATE ${TABLA} SET
            nombre = COALESCE($2, nombre),
            dias = COALESCE($3, dias),
            activa = COALESCE($4, activa)
        WHERE id = $1 RETURNING *`,
        [id, nombre == null ? null : String(nombre).trim() || null,
         dias == null ? null : Math.max(0, Math.round(Number(dias) || 0)),
         activa == null ? null : !!activa]);
    return r.rows[0] || null;
}

/** Elimina una regla: sin regla que aplice → esa prioridad/grupo queda sin ventana. */
async function eliminarRegla(id) {
    await asegurarTabla();
    const r = await query(`DELETE FROM ${TABLA} WHERE id = $1 RETURNING id`, [id]);
    return { eliminada: r.rowCount > 0 };
}

module.exports = { getConfigVentanas, ventanaDias, crearRegla, actualizarRegla, eliminarRegla };
