const { parseBody, json } = require('../middleware/parser');
const { query } = require('../config/database');
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

const handleProduccionCatalogos = async (req, res, urlPath, q) => {
    // ============ RECETAS BOM (NUEVA) ============
    if (urlPath === '/api/produccion/recetas-bom' && req.method === 'GET') {
        json(res, await catalogos.getRecetasBom());
        return true;
    }
    if (urlPath === '/api/produccion/recetas-bom' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.codigo_sap_padre || !body.materia_prima_id) {
            json(res, { error: 'Código SAP y materia prima requeridos' }, 400);
            return true;
        }
        json(res, await catalogos.crearRecetaBom(body));
        return true;
    }
    const rbId = idDeUrl(urlPath, '/api/produccion/recetas-bom');
    if (rbId && req.method === 'DELETE') {
        await catalogos.eliminarRecetaBom(rbId);
        json(res, { ok: true });
        return true;
    }

    // ============ RECETAS (ANTIGUA) ============
    if (urlPath === '/api/produccion/recetas/all' && req.method === 'DELETE') {
        if (!(await checkAdmin(req))) { json(res, { error: 'No autorizado' }, 403); return true; }
        json(res, { eliminados: await catalogos.eliminarTodasRecetasAntiguas() });
        return true;
    }
    if (urlPath === '/api/produccion/recetas/importar' && req.method === 'POST') {
        const body = await parseBody(req);
        let parsedRows = body.rows;
        if (!parsedRows && body.excel_data) {
            try {
                const XLSX = require('xlsx');
                const buffer = Buffer.from(body.excel_data, 'base64');
                const workbook = XLSX.read(buffer, { type: 'buffer' });
                parsedRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            } catch (e) { json(res, { error: 'Error al parsear Excel: ' + e.message }, 400); return true; }
        }
        if (!Array.isArray(parsedRows) || !parsedRows.length) {
            json(res, { error: 'No hay datos para importar' }, 400);
            return true;
        }
        json(res, await catalogos.importarRecetasAntiguas(parsedRows));
        return true;
    }
    if (urlPath === '/api/produccion/recetas' && req.method === 'GET') {
        json(res, await catalogos.getRecetasAntiguas());
        return true;
    }
    if (urlPath === '/api/produccion/recetas' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.codigo_sap_padre || !body.codigo_materia_prima) {
            json(res, { error: 'Código padre y materia prima requeridos' }, 400);
            return true;
        }
        try {
            json(res, await catalogos.crearRecetaAntigua(body), 201);
        } catch (e) { json(res, { error: 'Error al crear receta: ' + e.message }, 500); }
        return true;
    }
    const recId = idDeUrl(urlPath, '/api/produccion/recetas');
    if (recId && req.method === 'DELETE') {
        await catalogos.eliminarRecetaAntigua(recId);
        json(res, { ok: true });
        return true;
    }

    // ============ REGLAS EXTRAS ============
    if (urlPath === '/api/produccion/reglas-extras' && req.method === 'GET') {
        json(res, await catalogos.getReglasExtras());
        return true;
    }
    if (urlPath === '/api/produccion/reglas-extras' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.nombre_flag || !body.estacion_id) {
            json(res, { error: 'Flag y estación requeridos' }, 400);
            return true;
        }
        json(res, await catalogos.crearReglaExtra(body));
        return true;
    }
    const regId = idDeUrl(urlPath, '/api/produccion/reglas-extras');
    if (regId && req.method === 'PUT') {
        await catalogos.editarReglaExtra(regId, await parseBody(req));
        json(res, { ok: true });
        return true;
    }
    if (regId && req.method === 'DELETE') {
        await catalogos.eliminarReglaExtra(regId);
        json(res, { ok: true });
        return true;
    }

    // ============ TÉCNICOS ============
    if (urlPath === '/api/produccion/tecnicos' && req.method === 'GET') {
        json(res, await catalogos.getTecnicos());
        return true;
    }
    if (urlPath === '/api/produccion/tecnicos' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.nombre || !body.nombre.trim()) { json(res, { error: 'Nombre requerido' }, 400); return true; }
        try {
            json(res, await catalogos.crearTecnico(body.nombre));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    const tecId = idDeUrl(urlPath, '/api/produccion/tecnicos');
    if (tecId && req.method === 'PUT') {
        await catalogos.editarTecnico(tecId, await parseBody(req));
        json(res, { ok: true });
        return true;
    }
    if (tecId && req.method === 'DELETE') {
        await catalogos.eliminarTecnico(tecId);
        json(res, { ok: true });
        return true;
    }

    // ============ VENDEDORES ============
    if (urlPath === '/api/produccion/vendedores' && req.method === 'GET') {
        json(res, await catalogos.getVendedores());
        return true;
    }
    if (urlPath === '/api/produccion/vendedores' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.nombre || !body.nombre.trim()) { json(res, { error: 'Nombre requerido' }, 400); return true; }
        try {
            json(res, await catalogos.crearVendedor(body.nombre));
        } catch (e) { json(res, { error: e.message }, 500); }
        return true;
    }
    const venId = idDeUrl(urlPath, '/api/produccion/vendedores');
    if (venId && req.method === 'PUT') {
        await catalogos.editarVendedor(venId, await parseBody(req));
        json(res, { ok: true });
        return true;
    }
    if (venId && req.method === 'DELETE') {
        await catalogos.eliminarVendedor(venId);
        json(res, { ok: true });
        return true;
    }

    return false;
};

module.exports = { handleProduccionCatalogos };
