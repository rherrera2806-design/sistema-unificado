const { query } = require('../config/database');
const { hoyChile } = require('./turnosFlujo');

// Consultas de reportes del módulo de atención (turnos y entregas)

const horaASegundos = (s) => {
    if (!s) return 0;
    const p = String(s).slice(0, 8).split(':').map(Number);
    return p[0] * 3600 + p[1] * 60 + (p[2] || 0);
};

const getHistorialDelDia = async () => {
    const hoy = hoyChile();
    const result = await query(
        `SELECT t.*, e.estado as entrega_estado, e.pedidos, e.factura, e.tipo,
                e.hora_registrada as bodega_recibido, e.hora_entregada as bodega_entregado
         FROM turnos t
         LEFT JOIN entregas e ON t.id = e.turno_id
         WHERE t.fecha = $1 AND t.estado != 'espera'
         ORDER BY t.numero DESC`, [hoy]
    );

    return result.rows.map(t => {
        let espera_segundos = null, recepcion_segundos = null, bodega_segundos = null, total_segundos = null;
        if (t.hora_creacion && t.hora_llamada) espera_segundos = horaASegundos(t.hora_llamada) - horaASegundos(t.hora_creacion);
        if (t.hora_fin && t.hora_llamada) recepcion_segundos = horaASegundos(t.hora_fin) - horaASegundos(t.hora_llamada);
        if (t.bodega_recibido && t.bodega_entregado) bodega_segundos = horaASegundos(t.bodega_entregado) - horaASegundos(t.bodega_recibido);
        if (t.hora_creacion && t.bodega_entregado) total_segundos = horaASegundos(t.bodega_entregado) - horaASegundos(t.hora_creacion);
        else if (t.hora_creacion && t.hora_fin) total_segundos = horaASegundos(t.hora_fin) - horaASegundos(t.hora_creacion);
        return { ...t, espera_segundos, recepcion_segundos, bodega_segundos, total_segundos,
                 fecha_fmt: new Date(t.fecha).toLocaleDateString('es-CL') };
    });
};

const getReporteCompleto = async (desde, hasta) => {
    const conditions = [];
    const vals = [];
    let idx = 1;
    if (desde) { conditions.push(`t.fecha >= $${idx++}`); vals.push(desde); }
    if (hasta) { conditions.push(`t.fecha <= $${idx++}`); vals.push(hasta); }
    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const result = await query(
        `SELECT t.id as turno_id, t.nombre, t.numero, t.estado as turno_estado, t.fecha,
                t.hora_creacion, t.hora_llamada, t.hora_fin, t.rut, t.patente, t.motivo, t.rut_empresa,
                e.id as entrega_id, e.estado as entrega_estado, e.pedidos, e.factura, e.tipo,
                e.hora_registrada as bodega_recibido, e.hora_verificada, e.hora_cargada, e.hora_facturada,
                e.hora_entregada as bodega_entregado, e.numero_factura, e.monto_factura,
                e.descripcion as entrega_desc
         FROM turnos t
         LEFT JOIN entregas e ON t.id = e.turno_id
         ${where}
         ORDER BY t.fecha DESC, t.numero DESC`, vals
    );

    return result.rows.map(t => {
        let espera_seg = null, recepcion_seg = null, verificacion_seg = null, almacen_seg = null, facturacion_seg = null, total_seg = null;
        if (t.hora_creacion && t.hora_llamada) espera_seg = horaASegundos(t.hora_llamada) - horaASegundos(t.hora_creacion);
        if (t.hora_llamada && t.hora_fin) recepcion_seg = horaASegundos(t.hora_fin) - horaASegundos(t.hora_llamada);
        if (t.bodega_recibido && t.hora_verificada) verificacion_seg = horaASegundos(t.hora_verificada) - horaASegundos(t.bodega_recibido);
        if (t.hora_verificada && t.hora_cargada) almacen_seg = horaASegundos(t.hora_cargada) - horaASegundos(t.hora_verificada);
        if (t.hora_cargada && t.hora_facturada) facturacion_seg = horaASegundos(t.hora_facturada) - horaASegundos(t.hora_cargada);
        if (t.hora_creacion && t.hora_facturada) total_seg = horaASegundos(t.hora_facturada) - horaASegundos(t.hora_creacion);
        else if (t.hora_creacion && t.hora_fin) total_seg = horaASegundos(t.hora_fin) - horaASegundos(t.hora_creacion);
        return { ...t, espera_seg, recepcion_seg, verificacion_seg, almacen_seg, facturacion_seg, total_seg,
                 fecha_fmt: t.fecha ? new Date(t.fecha).toLocaleDateString('es-CL') : '-' };
    });
};

const getReporteEntregasSinTurno = async (desde, hasta) => {
    const conditions = ['e.turno_id IS NULL'];
    const vals = [];
    let idx = 1;
    if (desde) { conditions.push(`e.fecha >= $${idx++}`); vals.push(desde); }
    if (hasta) { conditions.push(`e.fecha <= $${idx++}`); vals.push(hasta); }

    const result = await query(
        `SELECT e.*, t.numero as turno_numero
         FROM entregas e
         LEFT JOIN turnos t ON e.turno_id = t.id
         WHERE ${conditions.join(' AND ')}
         ORDER BY e.fecha DESC, e.id DESC`, vals
    );
    return result.rows;
};

const getTicketTurno = async (id) => {
    const result = await query('SELECT * FROM turnos WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;

    const turno = result.rows[0];
    const antes = await query(
        'SELECT COUNT(*) as c FROM turnos WHERE fecha = $1 AND numero < $2 AND estado IN ($3, $4)',
        [turno.fecha, turno.numero, 'espera', 'atendiendo']
    );
    const posicion = Number(antes.rows[0].c);

    const actualRes = await query(
        'SELECT numero FROM turnos WHERE fecha = $1 AND estado = $2 ORDER BY numero DESC LIMIT 1',
        [turno.fecha, 'atendiendo']
    );
    const actualNumero = actualRes.rows.length > 0 ? actualRes.rows[0].numero : null;

    return {
        turno,
        posicion,
        estimado: posicion * 5,
        esSuTurno: actualNumero === turno.numero,
        actualNumero
    };
};

module.exports = {
    getHistorialDelDia,
    getReporteCompleto,
    getReporteEntregasSinTurno,
    getTicketTurno
};
