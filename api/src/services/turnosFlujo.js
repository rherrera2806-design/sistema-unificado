const { query } = require('../config/database');

// Transiciones de estado del flujo de turnos y entregas.
// Flujo: espera → atendiendo → derivado → verificado → cargado → facturado

const horaActualChile = () => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }));
    const pad = n => String(n).padStart(2, '0');
    return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

const hoyChile = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });

const logEstado = async (turnoId, estado, entregaId = null) => {
    await query(
        'INSERT INTO turnos_estados_log (turno_id, entrega_id, estado, fecha_entrada) VALUES ($1, $2, $3, NOW())',
        [turnoId, entregaId, estado]
    );
};

const cerrarEstadoPrevio = async (turnoId, estadoPrevio) => {
    await query(
        `UPDATE turnos_estados_log SET fecha_salida = NOW(),
         duracion_segundos = EXTRACT(EPOCH FROM (NOW() - fecha_entrada))::INTEGER
         WHERE turno_id = $1 AND estado = $2 AND fecha_salida IS NULL`,
        [turnoId, estadoPrevio]
    );
};

const llamarSiguiente = async () => {
    const hoy = hoyChile();
    const hora = horaActualChile();

    const actual = (await query(
        'SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1',
        [hoy, 'atendiendo']
    )).rows[0];

    if (actual) {
        await query('UPDATE turnos SET estado = $1, hora_fin = $2 WHERE id = $3', ['atendido', hora, actual.id]);
    }

    const siguiente = (await query(
        'SELECT * FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero ASC LIMIT 1',
        [hoy, 'espera']
    )).rows[0];

    if (!siguiente) return null;

    await query('UPDATE turnos SET estado = $1, hora_llamada = $2 WHERE id = $3', ['atendiendo', hora, siguiente.id]);
    await logEstado(siguiente.id, 'atendiendo');
    await cerrarEstadoPrevio(siguiente.id, 'espera');

    return siguiente;
};

const derivarABodega = async ({ turno_id, pedidos, factura, adjuntos }) => {
    const hora = horaActualChile();
    const hoy = hoyChile();

    await query('UPDATE turnos SET estado = $1, hora_fin = $2 WHERE id = $3', ['derivado', hora, turno_id]);
    await logEstado(turno_id, 'derivado');
    await cerrarEstadoPrevio(turno_id, 'atendiendo');

    await query(
        'INSERT INTO entregas (turno_id, cliente_nombre, pedidos, factura, tipo, estado, fecha, hora_registrada) VALUES ($1, (SELECT nombre FROM turnos WHERE id=$2), $3, $4, $5, $6, $7, $8)',
        [turno_id, turno_id, pedidos || null, factura || null, 'Retira', 'pendiente', hoy, hora]
    );

    if (Array.isArray(adjuntos) && adjuntos.length > 0) {
        for (const adj of adjuntos) {
            const buf = Buffer.from(adj.base64, 'base64');
            await query('INSERT INTO turnos_adjuntos (turno_id, nombre, archivo) VALUES ($1, $2, $3)',
                [turno_id, adj.nombre || 'archivo.pdf', buf]);
        }
    }
};

const verificarEntrega = async ({ entrega_id, tecnico_almacen_id, observaciones }) => {
    const hora = horaActualChile();

    await query(
        "UPDATE entregas SET estado = 'verificado', tecnico_almacen_id = $1, observaciones_almacen = $2, hora_verificada = $3 WHERE id = $4",
        [tecnico_almacen_id || null, observaciones || '', hora, entrega_id]
    );

    const turnoId = await getTurnoIdDeEntrega(entrega_id);
    if (turnoId) {
        await query("UPDATE turnos SET estado = 'verificado' WHERE id = $1", [turnoId]);
        await logEstado(turnoId, 'verificado', entrega_id);
        await cerrarEstadoPrevio(turnoId, 'derivado');
    }
};

const marcarCargado = async ({ entrega_id, observaciones }) => {
    const hora = horaActualChile();

    await query(
        "UPDATE entregas SET estado = 'cargado', hora_cargada = $1, observaciones_almacen = CASE WHEN $2 != '' THEN $2 ELSE observaciones_almacen END WHERE id = $3",
        [hora, observaciones || '', entrega_id]
    );

    const turnoId = await getTurnoIdDeEntrega(entrega_id);
    if (turnoId) {
        await query("UPDATE turnos SET estado = 'cargado' WHERE id = $1", [turnoId]);
        await logEstado(turnoId, 'cargado', entrega_id);
        await cerrarEstadoPrevio(turnoId, 'verificado');
    }
};

const facturarEntrega = async ({ entrega_id, numero_factura, monto_factura }) => {
    const hora = horaActualChile();

    await query(
        "UPDATE entregas SET estado = 'facturado', numero_factura = $1, monto_factura = $2, hora_facturada = $3, hora_entregada = $3 WHERE id = $4",
        [numero_factura, monto_factura || 0, hora, entrega_id]
    );

    const turnoId = await getTurnoIdDeEntrega(entrega_id);
    if (turnoId) {
        await query("UPDATE turnos SET estado = 'completado' WHERE id = $1", [turnoId]);
        await logEstado(turnoId, 'facturado', entrega_id);
        await cerrarEstadoPrevio(turnoId, 'cargado');
        await query('DELETE FROM turnos_adjuntos WHERE turno_id = $1', [turnoId]);
    }
};

const getTurnoIdDeEntrega = async (entregaId) => {
    const result = await query('SELECT turno_id FROM entregas WHERE id = $1', [entregaId]);
    return result.rows.length > 0 ? result.rows[0].turno_id : null;
};

module.exports = {
    hoyChile,
    horaActualChile,
    llamarSiguiente,
    derivarABodega,
    verificarEntrega,
    marcarCargado,
    facturarEntrega
};
