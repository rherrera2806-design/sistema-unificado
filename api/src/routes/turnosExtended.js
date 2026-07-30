const { parseBody, json } = require('../middleware/parser');
const { sanitizeString, validateRut, validatePatente } = require('../utils/helpers');
const { query } = require('../config/database');
const turnosFlujo = require('../services/turnosFlujo');
const turnosReportes = require('../services/turnosReportes');
const entregas = require('../services/entregas');
const turnosService = require('../services/turnos');

const handleTurnosExtended = async (req, res, urlPath, q) => {
    // Estado (alias de stats, usado por el frontend)
    if (urlPath === '/api/turnos/estado' && req.method === 'GET') {
        json(res, await turnosService.getTurnosStats());
        return true;
    }

    // Crear turno con validaciones
    if (urlPath === '/api/turnos/crear' && req.method === 'POST') {
        const body = await parseBody(req);
        const nombre = sanitizeString(body.nombre);
        const rut = sanitizeString(body.rut || '');
        const patente = sanitizeString(body.patente || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const motivo = sanitizeString(body.motivo || 'Retirar');
        const rut_empresa = sanitizeString(body.rut_empresa || '');

        if (!nombre) { json(res, { error: 'Nombre requerido' }, 400); return true; }
        if (rut && !validateRut(rut)) { json(res, { error: 'RUT invalido. Verifica el formato.' }, 400); return true; }
        if (patente && !validatePatente(patente)) { json(res, { error: 'Patente invalida. Formato: AB1234 o ABCD12' }, 400); return true; }

        const hoy = turnosFlujo.hoyChile();
        const hora = turnosFlujo.horaActualChile();
        const numRow = await query('SELECT COALESCE(MAX(numero), 0) + 1 AS next FROM turnos WHERE fecha = $1', [hoy]);
        const result = await query(
            'INSERT INTO turnos (nombre, numero, fecha, hora_creacion, rut, patente, motivo, rut_empresa) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
            [nombre, numRow.rows[0].next, hoy, hora, rut, patente, motivo, rut_empresa]
        );
        json(res, result.rows[0], 201);
        return true;
    }

    // Llamar siguiente
    if (urlPath === '/api/turnos/siguiente' && req.method === 'POST') {
        const siguiente = await turnosFlujo.llamarSiguiente();
        if (!siguiente) { json(res, { error: 'No hay turnos en espera' }, 400); return true; }
        json(res, { llamado: siguiente, ...await turnosService.getTurnosStats() });
        return true;
    }

    // Historial del día
    if (urlPath === '/api/turnos/historial' && req.method === 'GET') {
        json(res, await turnosReportes.getHistorialDelDia());
        return true;
    }

    // Reporte completo con rango de fechas
    if (urlPath === '/api/turnos/reporte' && req.method === 'GET') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        json(res, await turnosReportes.getReporteCompleto(params.get('desde') || '', params.get('hasta') || ''));
        return true;
    }

    // Entregas sin turno
    if (urlPath === '/api/turnos/reporte-entregas' && req.method === 'GET') {
        const params = new URL(req.url, 'http://localhost').searchParams;
        json(res, await turnosReportes.getReporteEntregasSinTurno(params.get('desde') || '', params.get('hasta') || ''));
        return true;
    }

    // Derivar a bodega
    if (urlPath === '/api/turnos/derivar-bodega' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.turno_id) { json(res, { error: 'turno_id requerido' }, 400); return true; }
        await turnosFlujo.derivarABodega(body);
        json(res, { ok: true });
        return true;
    }

    // Verificar (Bodega → Almacén)
    if (urlPath === '/api/turnos/verificar' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.entrega_id) { json(res, { error: 'entrega_id requerido' }, 400); return true; }
        await turnosFlujo.verificarEntrega(body);
        json(res, { ok: true });
        return true;
    }

    // Cargado (Almacén → Por Facturar)
    if (urlPath === '/api/turnos/cargado' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.entrega_id) { json(res, { error: 'entrega_id requerido' }, 400); return true; }
        await turnosFlujo.marcarCargado(body);
        json(res, { ok: true });
        return true;
    }

    // Facturar
    if (urlPath === '/api/turnos/facturar' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.entrega_id || !body.numero_factura) { json(res, { error: 'entrega_id y numero_factura requeridos' }, 400); return true; }
        await turnosFlujo.facturarEntrega(body);
        json(res, { ok: true });
        return true;
    }

    // Técnicos almacén
    if (urlPath === '/api/turnos/tecnicos-almacen' && req.method === 'GET') {
        json(res, await entregas.getTecnicosAlmacen());
        return true;
    }
    if (urlPath === '/api/turnos/tecnicos-almacen' && req.method === 'POST') {
        const body = await parseBody(req);
        const nombre = sanitizeString(body.nombre);
        if (!nombre) { json(res, { error: 'Nombre requerido' }, 400); return true; }
        json(res, await entregas.crearTecnicoAlmacen(nombre), 201);
        return true;
    }
    const tecnicoAlmMatch = urlPath.match(/^\/api\/turnos\/tecnicos-almacen\/(\d+)$/);
    if (tecnicoAlmMatch && req.method === 'DELETE') {
        await entregas.eliminarTecnicoAlmacen(Number(tecnicoAlmMatch[1]));
        json(res, { ok: true });
        return true;
    }

    // Pendientes por etapa
    if (urlPath === '/api/turnos/almacen/pendientes' && req.method === 'GET') {
        json(res, await entregas.getPendientesAlmacen());
        return true;
    }
    if (urlPath === '/api/turnos/facturar/pendientes' && req.method === 'GET') {
        json(res, await entregas.getPendientesFacturar());
        return true;
    }

    // Adjuntos
    const adjuntosMatch = urlPath.match(/^\/api\/turnos\/(\d+)\/adjuntos$/);
    if (adjuntosMatch && req.method === 'GET') {
        try {
            json(res, await entregas.getAdjuntos(parseInt(adjuntosMatch[1])));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    const adjuntoPdfMatch = urlPath.match(/^\/api\/turnos\/adjunto\/(\d+)$/);
    if (adjuntoPdfMatch && req.method === 'GET') {
        try {
            const adj = await entregas.getAdjuntoArchivo(parseInt(adjuntoPdfMatch[1]));
            if (!adj) { json(res, { error: 'No encontrado' }, 404); return true; }
            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${adj.nombre}"`,
                'Content-Length': adj.archivo.length
            });
            res.end(adj.archivo);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // QR de registro
    if (urlPath === '/api/turnos/qr' && req.method === 'GET') {
        const QRCode = require('qrcode');
        const url = req.headers.host
            ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/turnos/?view=registro`
            : 'http://localhost:3000/turnos/?view=registro';
        try {
            const qrDataUrl = await QRCode.toDataURL(url, { width: 250, margin: 2 });
            json(res, { qr: qrDataUrl, url });
        } catch (e) {
            json(res, { qr: '', url, error: e.message });
        }
        return true;
    }

    // Entregas (bodega)
    if (urlPath === '/api/turnos/entregas' && req.method === 'GET') {
        json(res, await entregas.getEntregasDelDia());
        return true;
    }
    if (urlPath === '/api/turnos/entregas/pendientes' && req.method === 'GET') {
        json(res, await entregas.getEntregasPendientes());
        return true;
    }
    if (urlPath === '/api/turnos/entregas/registrar' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.cliente_nombre) { json(res, { error: 'Nombre requerido' }, 400); return true; }
        json(res, await entregas.registrarEntrega(body), 201);
        return true;
    }

    const entregaEntregarMatch = urlPath.match(/^\/api\/turnos\/entregas\/(\d+)\/entregar$/);
    if (entregaEntregarMatch && req.method === 'POST') {
        await entregas.marcarEntregado(Number(entregaEntregarMatch[1]));
        json(res, { ok: true });
        return true;
    }

    // Eliminar
    const eliminarTurnoMatch = urlPath.match(/^\/api\/turnos\/eliminar-turno\/(\d+)$/);
    if (eliminarTurnoMatch && req.method === 'DELETE') {
        const id = Number(eliminarTurnoMatch[1]);
        await query('DELETE FROM entregas WHERE turno_id = $1', [id]);
        await query('DELETE FROM turnos WHERE id = $1', [id]);
        json(res, { ok: true });
        return true;
    }

    const eliminarEntregaMatch = urlPath.match(/^\/api\/turnos\/eliminar-entrega\/(\d+)$/);
    if (eliminarEntregaMatch && req.method === 'DELETE') {
        await entregas.eliminarEntrega(Number(eliminarEntregaMatch[1]));
        json(res, { ok: true });
        return true;
    }

    // Ticket individual (al final porque el regex captura cualquier número)
    const turnoByIdMatch = urlPath.match(/^\/api\/turnos\/(\d+)$/);
    if (turnoByIdMatch && req.method === 'GET') {
        const ticket = await turnosReportes.getTicketTurno(Number(turnoByIdMatch[1]));
        if (!ticket) { json(res, { error: 'No encontrado' }, 404); return true; }
        json(res, ticket);
        return true;
    }

    return false;
};

module.exports = { handleTurnosExtended };
