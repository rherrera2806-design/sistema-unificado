const { parseBody, json } = require('../middleware/parser');
const planificacion = require('../services/planificacion');
const planificacionGrupo = require('../services/planificacionGrupo');
const { autoAsignarPendientes } = require('../services/planificacionAuto');
const { importarOrdenes } = require('../services/produccionImportar');
const { query } = require('../config/database');

const handleProduccionPlanificacion = async (req, res, urlPath, q) => {
    // ============ IMPORTAR ============
    if (urlPath === '/api/produccion/importar' && req.method === 'POST') {
        console.log('[PROD] >>> Endpoint /api/produccion/importar HIT');
        const body = await parseBody(req);
        let rows = body.rows;
        if (!rows && body.excel_data) {
            try {
                const XLSX = require('xlsx');
                const buffer = Buffer.from(body.excel_data, 'base64');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            } catch (e) { json(res, { error: 'Error al parsear Excel: ' + e.message }, 400); return true; }
        }
        if (!Array.isArray(rows) || !rows.length) { json(res, { error: 'El archivo Excel esta vacio' }, 400); return true; }
        console.log('[PROD] Importando', rows.length, 'filas desde', body.file_name || 'excel');
        json(res, await importarOrdenes(rows));
        return true;
    }

    // ============ CALENDARIO ============
    if (urlPath === '/api/produccion/calendario' && req.method === 'GET') {
        try {
            json(res, await planificacion.getCalendario());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (urlPath === '/api/produccion/calendario' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.fecha) { json(res, { error: 'fecha requerida' }, 400); return true; }
            await planificacion.marcarDia(body);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (urlPath.match(/^\/api\/produccion\/calendario\/\d+$/) && req.method === 'DELETE') {
        try {
            await planificacion.eliminarDia(parseInt(urlPath.split('/').pop()));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // ============ PLANIFICACIÓN (por estación) ============
    if (urlPath.startsWith('/api/produccion/planificacion/carga-semanal') && req.method === 'GET') {
        if (!q.inicio || !q.fin) { json(res, { error: 'Fechas inicio y fin requeridas' }, 400); return true; }
        try {
            json(res, await planificacion.getCargaSemanal(q.inicio, q.fin));
        } catch (e) { json(res, { error: String(e.message || e) }, 500); }
        return true;
    }

    if (urlPath.startsWith('/api/produccion/planificacion/carga-por-grupo') && req.method === 'GET') {
        if (!q.inicio || !q.fin) { json(res, { error: 'Fechas inicio y fin requeridas' }, 400); return true; }
        try {
            json(res, await planificacion.getCargaPorGrupo(q.inicio, q.fin));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath.startsWith('/api/produccion/planificacion/carga-estaciones') && req.method === 'GET') {
        try {
            const params = new URL(req.url, 'http://localhost').searchParams;
            const inicio = params.get('inicio') || new Date().toISOString().split('T')[0];
            const fin = params.get('fin') || inicio;
            json(res, await planificacion.getCargaEstaciones(inicio, fin));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/produccion/planificacion/pendientes' && req.method === 'GET') {
        try {
            json(res, await planificacion.getPendientes());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/produccion/planificacion/programar' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.orden_id) { json(res, { error: 'orden_id requerido' }, 400); return true; }
        try {
            const result = await planificacion.programarOrden(body.orden_id, body.fecha_entrega_propuesta);
            json(res, { ok: true, mensaje: `Orden programada${result.fechaFinal ? '. Entrega: ' + result.fechaFinal : ''}`, asignaciones: result.asignaciones });
        } catch (e) { json(res, { error: e.message }, 400); }
        return true;
    }

    // ============ CAPACIDAD GRUPO ============
    if (urlPath === '/api/produccion/capacidad-grupo' && req.method === 'GET') {
        try {
            json(res, await planificacion.getCapacidadGrupo());
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    const capGrupoMatch = urlPath.match(/^\/api\/produccion\/capacidad-grupo\/(\d+)$/);
    if (capGrupoMatch && req.method === 'PUT') {
        try {
            json(res, await planificacion.actualizarCapacidadGrupo(Number(capGrupoMatch[1]), await parseBody(req)));
        } catch (e) { json(res, { error: e.message }, e.message === 'Sin campos' ? 400 : 500); }
        return true;
    }

    // ============ PLANIFICACIÓN POR GRUPO ============
    if (urlPath === '/api/produccion/planificacion-grupo/semana' && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            const inicio = urlObj.searchParams.get('inicio');
            const fin = urlObj.searchParams.get('fin');
            if (!inicio || !fin) { json(res, { error: 'inicio y fin requeridos' }, 400); return true; }
            json(res, await planificacionGrupo.getSemanaGrupo(inicio, fin));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/produccion/planificacion-grupo' && req.method === 'GET') {
        try {
            const urlObj = new URL(req.url, 'http://localhost');
            json(res, await planificacionGrupo.getDiaGrupo(urlObj.searchParams.get('fecha')));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/produccion/planificacion-grupo/asignar' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.orden_id) { json(res, { error: 'orden_id requerido' }, 400); return true; }
            await planificacionGrupo.asignarOrdenFecha(body.orden_id, body.fecha);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    if (urlPath === '/api/produccion/planificacion-grupo/auto-asignar' && req.method === 'POST') {
        try {
            const body = await parseBody(req);
            const dias = Number(body.dias) || 14;
            const inicio = body.inicio || new Date().toISOString().split('T')[0];
            json(res, await autoAsignarPendientes({ dias, inicio }));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    // ============ NOTAS ============
    if (urlPath === '/api/produccion/notas' && req.method === 'GET') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return true; }
        try {
            const result = await query('SELECT * FROM prod_notas WHERE usuario_email = $1 ORDER BY fecha_creacion DESC', [userEmail]);
            json(res, result.rows);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (urlPath === '/api/produccion/notas' && req.method === 'POST') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return true; }
        const body = await parseBody(req);
        if (!body.nota || !body.nota.trim()) { json(res, { error: 'Nota requerida' }, 400); return true; }
        try {
            const result = await query("INSERT INTO prod_notas (usuario_email, nota, estado) VALUES ($1, $2, 'pendiente') RETURNING *", [userEmail, body.nota.trim()]);
            json(res, result.rows[0]);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (urlPath.match(/^\/api\/produccion\/notas\/\d+$/) && req.method === 'PUT') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return true; }
        const id = parseInt(urlPath.split('/').pop());
        const body = await parseBody(req);
        try {
            const result = body.estado === 'realizado'
                ? await query('UPDATE prod_notas SET estado = $1, fecha_completado = CURRENT_TIMESTAMP WHERE id = $2 AND usuario_email = $3 RETURNING *', [body.estado, id, userEmail])
                : await query('UPDATE prod_notas SET estado = $1, fecha_completado = NULL WHERE id = $2 AND usuario_email = $3 RETURNING *', [body.estado, id, userEmail]);
            if (result.rows.length === 0) { json(res, { error: 'Nota no encontrada' }, 404); return true; }
            json(res, result.rows[0]);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (urlPath.match(/^\/api\/produccion\/notas\/\d+$/) && req.method === 'DELETE') {
        const userEmail = req.headers['x-user-email'];
        if (!userEmail) { json(res, { error: 'Usuario requerido' }, 401); return true; }
        try {
            await query('DELETE FROM prod_notas WHERE id = $1 AND usuario_email = $2', [parseInt(urlPath.split('/').pop()), userEmail]);
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }

    return false;
};

module.exports = { handleProduccionPlanificacion };
