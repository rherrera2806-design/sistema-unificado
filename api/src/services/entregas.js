const { query } = require('../config/database');
const { hoyChile, horaActualChile } = require('./turnosFlujo');

// Gestión de entregas (bodega), adjuntos y técnicos de almacén

const getEntregasDelDia = async () => {
    const result = await query(
        `SELECT e.*, t.numero as turno_numero,
            (SELECT COUNT(*) FROM turnos_adjuntos ta WHERE ta.turno_id = e.turno_id) as adjuntos_count
         FROM entregas e
         LEFT JOIN turnos t ON e.turno_id = t.id
         WHERE e.fecha = $1
         ORDER BY e.id DESC`, [hoyChile()]
    );
    return result.rows;
};

const getEntregasPendientes = async () => {
    const result = await query(
        `SELECT e.*, t.numero as turno_numero, t.patente, t.motivo, t.rut_empresa,
            (SELECT COUNT(*) FROM turnos_adjuntos ta WHERE ta.turno_id = e.turno_id) as adjuntos_count
         FROM entregas e
         LEFT JOIN turnos t ON e.turno_id = t.id
         WHERE e.fecha = $1 AND e.estado = 'pendiente'
         ORDER BY e.id ASC`, [hoyChile()]
    );
    return result.rows;
};

const registrarEntrega = async ({ cliente_nombre, descripcion, tipo, pedidos }) => {
    const result = await query(
        'INSERT INTO entregas (cliente_nombre, descripcion, tipo, pedidos, estado, fecha, hora_registrada) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [cliente_nombre, descripcion || null, tipo || 'Retira', pedidos || null, 'pendiente', hoyChile(), horaActualChile()]
    );
    return result.rows[0];
};

const marcarEntregado = async (id) => {
    await query('UPDATE entregas SET estado = $1, hora_entregada = $2 WHERE id = $3',
        ['entregado', horaActualChile(), id]);

    const turnoResult = await query('SELECT turno_id FROM entregas WHERE id = $1', [id]);
    if (turnoResult.rows.length > 0 && turnoResult.rows[0].turno_id) {
        await query('DELETE FROM turnos_adjuntos WHERE turno_id = $1', [turnoResult.rows[0].turno_id]);
    }
};

const eliminarEntrega = async (id) => {
    const turnoResult = await query('SELECT turno_id FROM entregas WHERE id = $1', [id]);
    if (turnoResult.rows.length > 0 && turnoResult.rows[0].turno_id) {
        await query('DELETE FROM turnos_adjuntos WHERE turno_id = $1', [turnoResult.rows[0].turno_id]);
    }
    await query('DELETE FROM entregas WHERE id = $1', [id]);
};

// --- Adjuntos ---

const getAdjuntos = async (turnoId) => {
    const result = await query(
        'SELECT id, nombre, created_at FROM turnos_adjuntos WHERE turno_id = $1 ORDER BY created_at',
        [turnoId]
    );
    return result.rows;
};

const getAdjuntoArchivo = async (adjId) => {
    const result = await query('SELECT nombre, archivo FROM turnos_adjuntos WHERE id = $1', [adjId]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

// --- Técnicos de almacén ---

const getTecnicosAlmacen = async () => {
    const result = await query('SELECT * FROM tecnicos_almacen WHERE activo = TRUE ORDER BY nombre');
    return result.rows;
};

const crearTecnicoAlmacen = async (nombre) => {
    const result = await query('INSERT INTO tecnicos_almacen (nombre) VALUES ($1) RETURNING *', [nombre]);
    return result.rows[0];
};

const eliminarTecnicoAlmacen = async (id) => {
    await query('UPDATE tecnicos_almacen SET activo = FALSE WHERE id = $1', [id]);
};

// --- Pendientes por etapa ---

const getPendientesAlmacen = async () => {
    const result = await query(
        `SELECT e.*, t.numero as turno_numero, t.nombre as cliente_nombre, t.rut, t.patente, t.motivo, t.rut_empresa,
                ta.nombre as tecnico_nombre,
                (SELECT COUNT(*) FROM turnos_adjuntos adj WHERE adj.turno_id = t.id) as adjuntos_count
         FROM entregas e
         JOIN turnos t ON e.turno_id = t.id
         LEFT JOIN tecnicos_almacen ta ON e.tecnico_almacen_id = ta.id
         WHERE e.fecha = $1 AND e.estado = 'verificado'
         ORDER BY e.id ASC`, [hoyChile()]
    );
    return result.rows;
};

const getPendientesFacturar = async () => {
    const result = await query(
        `SELECT e.*, t.numero as turno_numero, t.nombre as cliente_nombre, t.rut, t.patente, t.motivo, t.rut_empresa,
                ta.nombre as tecnico_nombre
         FROM entregas e
         JOIN turnos t ON e.turno_id = t.id
         LEFT JOIN tecnicos_almacen ta ON e.tecnico_almacen_id = ta.id
         WHERE e.fecha = $1 AND e.estado = 'cargado'
         ORDER BY e.id ASC`, [hoyChile()]
    );
    return result.rows;
};

module.exports = {
    getEntregasDelDia,
    getEntregasPendientes,
    registrarEntrega,
    marcarEntregado,
    eliminarEntrega,
    getAdjuntos,
    getAdjuntoArchivo,
    getTecnicosAlmacen,
    crearTecnicoAlmacen,
    eliminarTecnicoAlmacen,
    getPendientesAlmacen,
    getPendientesFacturar
};
