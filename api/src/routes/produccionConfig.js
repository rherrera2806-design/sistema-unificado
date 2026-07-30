const { parseBody, json } = require('../middleware/parser');
const { query } = require('../config/database');
const config = require('../services/produccionConfig');
const catalogos = require('../services/produccionCatalogos');

const checkAdmin = async (req) => {
    const userEmail = req.headers['x-user-email'];
    const userRes = await query('SELECT permisos FROM usuarios WHERE email = $1', [userEmail]);
    return userRes.rows.length > 0 && userRes.rows[0].permisos.includes('usuarios');
};

const idDeUrl = (urlPath, base) => {
    const m = urlPath.match(new RegExp('^' + base + '/(\\\\d+)$'));
    return m ? Number(m[1]) : null;
};

const handleProduccionConfig = async (req, res, urlPath, q) => {
    // ============ MÁQUINAS ============
    if (urlPath === '/api/produccion/maquinas/import' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!Array.isArray(body.maquinas) || body.maquinas.length === 0) {
            json(res, { error: 'No hay máquinas para importar' }, 400);
            return true;
        }
        json(res, await config.importarMaquinas(body.maquinas));
        return true;
    }
    if (urlPath === '/api/produccion/maquinas' && req.method === 'GET') {
        json(res, await config.getMaquinas());
        return true;
    }
    if (urlPath === '/api/produccion/maquinas' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.nombre || !body.codigo) { json(res, { error: 'Nombre y código requeridos' }, 400); return true; }
        try {
            json(res, await config.crearMaquina(body), 201);
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    const maqId = idDeUrl(urlPath, '/api/produccion/maquinas');
    if (maqId && req.method === 'PUT') {
        try {
            await config.editarMaquina(maqId, await parseBody(req));
            json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    if (maqId && req.method === 'DELETE') {
        await config.eliminarMaquina(maqId);
        json(res, { ok: true });
        return true;
    }

    // ============ CÓDIGOS SAP ============
    if (urlPath === '/api/produccion/codigos/all' && req.method === 'DELETE') {
        if (!(await checkAdmin(req))) { json(res, { error: 'Solo admin' }, 403); return true; }
        json(res, { ok: true, eliminados: await config.eliminarTodosCodigos() });
        return true;
    }
    if (urlPath === '/api/produccion/codigos/importar' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.excel_data) { json(res, { error: 'Datos del archivo requeridos' }, 400); return true; }
        try {
            const XLSX = require('xlsx');
            const buffer = Buffer.from(body.excel_data, 'base64');
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            if (!rows.length) { json(res, { error: 'Archivo vacio' }, 400); return true; }
            json(res, await config.importarCodigos(rows));
        } catch (e) { json(res, { error: 'Error al procesar: ' + e.message }, 500); }
        return true;
    }
    if (urlPath === '/api/produccion/codigos' && req.method === 'GET') {
        json(res, await config.getCodigos(q.search || '', parseInt(q.limit) || 0));
        return true;
    }
    if (urlPath === '/api/produccion/codigos' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.codigo) { json(res, { error: 'Codigo requerido' }, 400); return true; }
        try {
            json(res, await config.crearCodigo(body), 201);
        } catch (e) {
            if (e.code === '23505') { json(res, { error: 'El codigo ya existe' }, 400); return true; }
            json(res, { error: e.message }, 500);
        }
        return true;
    }
    const codId = idDeUrl(urlPath, '/api/produccion/codigos');
    if (codId && req.method === 'DELETE') {
        await config.eliminarCodigo(codId);
        json(res, { ok: true });
        return true;
    }

    // ============ ESTACIONES ============
    if (urlPath === '/api/produccion/estaciones' && req.method === 'GET') {
        json(res, await config.getEstaciones());
        return true;
    }
    if (urlPath === '/api/produccion/estaciones' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.nombre_estacion || !body.orden_secuencia_defecto) {
            json(res, { error: 'Nombre y orden requeridos' }, 400);
            return true;
        }
        json(res, await config.crearEstacion(body));
        return true;
    }
    const estId = idDeUrl(urlPath, '/api/produccion/estaciones');
    if (estId && req.method === 'PUT') {
        const result = await config.editarEstacion(estId, await parseBody(req));
        json(res, result || { error: 'No encontrado' }, result ? 200 : 404);
        return true;
    }
    if (estId && req.method === 'DELETE') {
        await config.eliminarEstacion(estId);
        json(res, { ok: true });
        return true;
    }

    // ============ FAMILIAS ============
    if (urlPath === '/api/produccion/familias' && req.method === 'GET') {
        json(res, await config.getFamilias());
        return true;
    }
    if (urlPath === '/api/produccion/familias' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.codigo_familia || !body.nombre_familia) {
            json(res, { error: 'Código y nombre requeridos' }, 400);
            return true;
        }
        json(res, await config.crearFamilia(body));
        return true;
    }
    const famId = idDeUrl(urlPath, '/api/produccion/familias');
    if (famId && req.method === 'PUT') {
        await config.editarFamilia(famId, await parseBody(req));
        json(res, { ok: true });
        return true;
    }
    if (famId && req.method === 'DELETE') {
        await config.eliminarFamilia(famId);
        json(res, { ok: true });
        return true;
    }

    // ============ MATERIAS PRIMAS ============
    if (urlPath === '/api/produccion/materias-primas' && req.method === 'GET') {
        json(res, await catalogos.getMateriasPrimas());
        return true;
    }
    if (urlPath === '/api/produccion/materias-primas' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.codigo_mp || !body.nombre) { json(res, { error: 'Código y nombre requeridos' }, 400); return true; }
        json(res, await catalogos.crearMateriaPrima(body));
        return true;
    }
    const mpId = idDeUrl(urlPath, '/api/produccion/materias-primas');
    if (mpId && req.method === 'PUT') {
        const result = await catalogos.editarMateriaPrima(mpId, await parseBody(req));
        json(res, result || { error: 'No encontrado' }, result ? 200 : 404);
        return true;
    }
    if (mpId && req.method === 'DELETE') {
        await catalogos.eliminarMateriaPrima(mpId);
        json(res, { ok: true });
        return true;
    }

    return false;
};

module.exports = { handleProduccionConfig };
