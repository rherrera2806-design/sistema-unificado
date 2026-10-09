const express = require('express');
const router = express.Router();
const multer = require('multer');
const { query } = require('../config/database');
// transaction() vive en dbPool (mismo pool que query): cada cambio de estado y su
// fila en pedido_historial se escriben dentro de la MISMA transacción para que,
// si algo falla, no quede el pedido cambiado sin su traza (o al revés).
const { transaction } = require('../config/dbPool');
const { requireAnyPerm, requireAdmin } = require('../middleware/permisos');

// ─────────────────────────────────────────────────────────────────────────────
// Subida de PDF: solo application/pdf, máximo 50 MB, en memoria (BYTEA).
// Cualquier otro binario se rechaza con 415/413 y mensaje claro (antes multer
// aceptaba cualquier archivo y un error de límite terminaba en un 500).
// ─────────────────────────────────────────────────────────────────────────────
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file && file.mimetype === 'application/pdf') return cb(null, true);
        const err = new Error('Solo se permiten archivos PDF (application/pdf)');
        err.status = 415;
        return cb(err);
    }
});

// Envuelve upload.single para traducir los errores de multer a 4xx con mensaje
// claro (413 archivo muy grande, 415 tipo no permitido, 400 campo inesperado).
function subirArchivoPdf(req, res, next) {
    upload.single('archivo_pdf')(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(413).json({ error: 'El archivo supera el maximo de 50 MB' });
            }
            return res.status(400).json({ error: 'Archivo invalido: ' + err.message });
        }
        return res.status(err.status || 415).json({ error: err.message || 'Archivo no permitido' });
    });
}

const MOD = 'pedidos';
// Permisos al estilo produccionConfig.js: el permiso base 'pedidos' es de SOLO
// LECTURA; crear/editar/eliminar exigen su sub-permiso.
// EXCEPCIÓN documentada (pedida por el usuario y ya alineada en el frontend):
// canCreate acepta también el permiso base 'pedidos', para que los vendedores
// solo con 'pedidos' puedan crear pedidos.
const canView   = requireAnyPerm(MOD);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`);
const canDelete = requireAnyPerm(`${MOD}.eliminar`);
// DELETE /:id/pdf forma parte del flujo de APROBACIÓN (PUT aprobado →
// download-pdf → DELETE /:id/pdf), así que debe aceptar permiso 'editar'
// y no solo 'eliminar' (antes respondía 403 silencioso al autorizador).
const canBorrarPdf = requireAnyPerm(`${MOD}.editar`, `${MOD}.eliminar`);

// Columnas expuestas en JSON. Se EXCLUYE archivo_pdf (BYTEA de hasta 50 MB):
// antes un SELECT * / RETURNING * serializaba el Buffer completo en cada
// respuesta. El frontend nunca lo lee del JSON: lo obtiene por /pdf y
// /download-pdf. El listado (GET /api/pedidos) tampoco lo incluye.
const COLS_PEDIDO = 'id, numero_pedido, cliente, vendedor, tipo_ov, estado, motivo_rechazo, ' +
    'fecha_subida, fecha_revision, revisado_por, archivo_url';

// Límites de los campos de texto. tipo_ov es VARCHAR(30) en BD y antes un valor
// más largo desbordaba a un 500 por error de PostgreSQL; el resto es TEXT pero
// se acota igual para no guardar basura.
const LIM = { numero_pedido: 50, cliente: 200, tipo_ov: 30, motivo_rechazo: 500 };

const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];

// ── Máquina de estados de PUT /api/pedidos/:id ───────────────────────────────
//   pendiente → pendiente   edición normal (sin cambio de estado)
//   pendiente → aprobado    aprobar
//   pendiente → rechazado   rechazar (motivo obligatorio)
//   aprobado  → pendiente   al editar: el pedido vuelve a revisión
//   aprobado  → rechazado   rechazar un aprobado (motivo obligatorio)
//   rechazado → pendiente   al editar: rescatar un rechazado
//   rechazado → aprobado    PROHIBIDO (409): primero debe volver a pendiente
// Cualquier otra transición o un estado desconocido → 400/409 con mensaje claro.
const TRANSICIONES = {
    pendiente: ['pendiente', 'aprobado', 'rechazado'],
    aprobado: ['pendiente', 'rechazado'],
    rechazado: ['pendiente']
};

// Id de la URL: entero positivo o 400 (antes un id no numérico llegaba a la
// query como NaN y terminaba en un 500).
function parseIdPedido(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Id de pedido invalido' });
        return null;
    }
    return id;
}

// Lee un campo de texto del body: null/undefined = ausente, string = trim,
// cualquier otro tipo = error de validación.
function textoDeBody(valor, campo) {
    if (valor === undefined || valor === null) return { ok: true, valor: undefined };
    if (typeof valor !== 'string') return { ok: false, error: `El campo '${campo}' debe ser texto` };
    return { ok: true, valor: valor.trim() };
}

// Valida una URL de PDF externa (campo archivo_url) antes de guardarla y antes
// de redirigir a ella: debe parsear, usar https (http solo contra localhost) y
// nunca un esquema peligroso (javascript:, data:, etc.) que el navegador
// ejecutaría desde el redirect (redirect abierto).
function validarArchivoUrl(valor) {
    const url = String(valor).trim();
    if (!url) return { ok: true, valor: '' };
    let parsed;
    try { parsed = new URL(url); } catch (e) {
        return { ok: false, error: 'archivo_url no es una URL valida' };
    }
    const host = (parsed.hostname || '').toLowerCase();
    const esLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
    if (parsed.protocol === 'https:') return { ok: true, valor: url };
    if (parsed.protocol === 'http:' && esLocal) return { ok: true, valor: url };
    return { ok: false, error: 'archivo_url debe usar https (http solo en localhost); se rechazan javascript:, data: y otros esquemas' };
}

// Nombre seguro para Content-Disposition: el numero_pedido lo escribe el
// usuario, así que se eliminan comillas, saltos de línea y separadores de ruta
// (evita inyección de headers y rutas).
function nombreArchivoPdf(numeroPedido) {
    const base = String(numeroPedido || 'pedido').replace(/[^\w.\-]/g, '_').slice(0, 80);
    return (base || 'pedido') + '.pdf';
}

// Mismo criterio de visibilidad que el listado GET /api/pedidos (identidad
// siempre desde la sesión): los usuarios del área 'ventas' solo ven sus propios
// pedidos (p.vendedor = su email) y el resto ve todos. Se aplica a los PDF y a
// los metadatos para que un vendedor no vea pedidos ajenos por su id.
function filtroVisibilidad(user) {
    const area = ((user && user.area) || '').toLowerCase();
    if (area === 'ventas') {
        return { where: ' AND vendedor = $2', params: [user.email || ''] };
    }
    return { where: '', params: [] };
}

router.get('/api/pedidos/dashboard', canView, async (req, res, next) => {
    try {
        const [total, pendientes, aprobados, rechazados] = await Promise.all([
            query('SELECT COUNT(*) as c FROM pedidos'),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'pendiente'"),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'aprobado'"),
            query("SELECT COUNT(*) as c FROM pedidos WHERE estado = 'rechazado'")
        ]);
        res.json({
            total: Number(total.rows[0].c),
            pendientes: Number(pendientes.rows[0].c),
            aprobados: Number(aprobados.rows[0].c),
            rechazados: Number(rechazados.rows[0].c)
        });
    } catch (e) { next(e); }
});

router.get('/api/pedidos', canView, async (req, res, next) => {
    try {
        // Identidad y área desde la sesión (BD), nunca desde los headers del
        // cliente: antes se leía 'x-user-area' y cualquier usuario podía ver
        // todos los pedidos mandando otro valor en ese header.
        const userEmail = (req.user && req.user.email) || '';
        const userArea = (req.user && req.user.area) || '';
        const esVentas = userArea.toLowerCase() === 'ventas';
        const joinQuery = `SELECT p.id, p.numero_pedido, p.cliente, p.vendedor, p.tipo_ov, p.estado, p.motivo_rechazo,
            p.fecha_subida, p.fecha_revision, p.revisado_por, p.archivo_url,
            v.nombre AS vendedor_nombre, r.nombre AS revisor_nombre
            FROM pedidos p LEFT JOIN usuarios v ON v.email = p.vendedor
            LEFT JOIN usuarios r ON r.email = p.revisado_por`;
        const result = esVentas
            ? await query(joinQuery + ' WHERE p.vendedor = $1 ORDER BY p.fecha_subida DESC', [userEmail])
            : await query(joinQuery + ' ORDER BY p.fecha_subida DESC');
        res.json(result.rows);
    } catch (e) { next(e); }
});

router.post('/api/pedidos', canCreate, subirArchivoPdf, async (req, res, next) => {
    try {
        const body = req.body || {};
        const numero = textoDeBody(body.numero_pedido, 'numero_pedido');
        const cliente = textoDeBody(body.cliente, 'cliente');
        const tipo = textoDeBody(body.tipo_ov, 'tipo_ov');
        const url = textoDeBody(body.archivo_url, 'archivo_url');
        for (const c of [numero, cliente, tipo, url]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }
        if (!numero.valor) return res.status(400).json({ error: 'Numero de pedido es requerido' });
        if (!cliente.valor) return res.status(400).json({ error: 'Cliente es requerido' });
        if (numero.valor.length > LIM.numero_pedido) {
            return res.status(400).json({ error: `El numero de pedido no puede superar ${LIM.numero_pedido} caracteres` });
        }
        if (cliente.valor.length > LIM.cliente) {
            return res.status(400).json({ error: `El cliente no puede superar ${LIM.cliente} caracteres` });
        }
        const tipoOv = tipo.valor ? tipo.valor : 'Normal';
        if (tipoOv.length > LIM.tipo_ov) {
            return res.status(400).json({ error: `El tipo_ov no puede superar ${LIM.tipo_ov} caracteres` });
        }
        const urlOk = validarArchivoUrl(url.valor || '');
        if (!urlOk.ok) return res.status(400).json({ error: urlOk.error });

        // El vendedor es el usuario de la sesión: el que llega en el body lo
        // controla el cliente y permitiría atribuir un pedido a otra persona.
        const vendedor = (req.user && req.user.email) || '';
        const pdfBuffer = req.file ? req.file.buffer : null;

        const resultado = await transaction(async (tx) => {
            const dup = await tx.query('SELECT id FROM pedidos WHERE numero_pedido = $1 LIMIT 1', [numero.valor]);
            if (dup.rows.length > 0) return { codigo: 409, error: 'Ya existe un pedido con este numero' };
            const ins = await tx.query(
                `INSERT INTO pedidos (numero_pedido, cliente, tipo_ov, vendedor, archivo_url, archivo_pdf, estado)
                 VALUES ($1, $2, $3, $4, $5, $6, 'pendiente') RETURNING ${COLS_PEDIDO}`,
                [numero.valor, cliente.valor, tipoOv, vendedor, urlOk.valor, pdfBuffer]
            );
            const pedido = ins.rows[0];
            // Historial: creación del pedido y, si vino adjunto, su subida de PDF.
            await tx.query(
                'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                [pedido.id, 'Creación', '{}', JSON.stringify(pedido), vendedor]
            );
            if (pdfBuffer) {
                await tx.query(
                    'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                    [pedido.id, 'Subida de PDF',
                     JSON.stringify({ archivo_pdf: null }),
                     JSON.stringify({ archivo_pdf: 'PDF adjunto' }),
                     vendedor]
                );
            }
            return { codigo: 201, pedido };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.status(201).json(resultado.pedido);
    } catch (e) {
        // 23505 = violación del UNIQUE de numero_pedido que agrega el esquema de
        // BD en paralelo: convive con la validación previa y responde igual (409).
        if (e && e.code === '23505') return res.status(409).json({ error: 'Ya existe un pedido con este numero' });
        next(e);
    }
});

// Reporte de pedidos por anio
router.get('/api/pedidos/reporte', canView, async (req, res, next) => {
    try {
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const result = await query(`
            SELECT
                EXTRACT(MONTH FROM p.fecha_subida)::int as mes,
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE p.estado = 'pendiente')::int as pendientes,
                COUNT(*) FILTER (WHERE p.estado = 'aprobado')::int as aprobados,
                COUNT(*) FILTER (WHERE p.estado = 'rechazado')::int as rechazados,
                COALESCE(NULLIF(COALESCE(u.nombre, p.vendedor), ''), 'Sin asignar') as vendedor,
                COALESCE(NULLIF(p.cliente,''), 'Sin cliente') as cliente,
                COALESCE(NULLIF(p.tipo_ov,''), 'Normal') as tipo_ov
            FROM pedidos p
            LEFT JOIN usuarios u ON u.email = p.vendedor
            WHERE EXTRACT(YEAR FROM p.fecha_subida) = $1
            GROUP BY EXTRACT(MONTH FROM p.fecha_subida), u.nombre, p.vendedor, p.cliente, p.tipo_ov
            ORDER BY mes
        `, [anio]);

        const motivoResult = await query(`
            SELECT COALESCE(NULLIF(motivo_rechazo,''), 'Sin motivo') as motivo, COUNT(*)::int as total
            FROM pedidos WHERE EXTRACT(YEAR FROM fecha_subida) = $1 AND estado = 'rechazado' AND motivo_rechazo IS NOT NULL AND motivo_rechazo != ''
            GROUP BY motivo_rechazo ORDER BY total DESC LIMIT 8
        `, [anio]);

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const porMes = {};
        const porVendedor = {};
        const porCliente = {};
        const porTipo = {};

        for (const row of result.rows) {
            const idx = row.mes - 1;
            if (!porMes[idx]) porMes[idx] = { total:0, pendientes:0, aprobados:0, rechazados:0 };
            porMes[idx].total += row.total;
            porMes[idx].pendientes += row.pendientes;
            porMes[idx].aprobados += row.aprobados;
            porMes[idx].rechazados += row.rechazados;

            const vend = (row.vendedor || '').trim() || 'Sin asignar';
            porVendedor[vend] = (porVendedor[vend] || 0) + row.total;

            const cli = (row.cliente || '').trim() || 'Sin cliente';
            porCliente[cli] = (porCliente[cli] || 0) + row.total;

            const tipo = (row.tipo_ov || 'Normal').trim();
            porTipo[tipo] = (porTipo[tipo] || 0) + row.total;
        }

        const mesesData = meses.map((nombre, i) => ({
            nombre,
            ...(porMes[i] || { total:0, pendientes:0, aprobados:0, rechazados:0 })
        }));

        const totalGeneral = result.rows.reduce((s, r) => s + r.total, 0);
        const totalAprobados = mesesData.reduce((s, m) => s + m.aprobados, 0);
        const totalRechazados = mesesData.reduce((s, m) => s + m.rechazados, 0);

        res.json({
            anio,
            meses: mesesData,
            vendedores: Object.entries(porVendedor).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total),
            clientes: Object.entries(porCliente).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total).slice(0, 10),
            tipos: Object.entries(porTipo).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total),
            motivos: motivoResult.rows,
            totalGeneral,
            totalAprobados,
            totalRechazados
        });
    } catch (e) {
        // next(e) consistente con el resto de las rutas: el handler global
        // registra el error y responde 500 sin exponer e.message al cliente.
        next(e);
    }
});

// Sirve el PDF del pedido (inline para vista previa, attachment para descargar).
// Exige canView Y el mismo filtro de área/vendedor que el listado: antes
// cualquier usuario autenticado (requireAuth) veía cualquier PDF.
function crearRutaPdf(disposition) {
    return async (req, res, next) => {
        try {
            const id = parseIdPedido(req, res);
            if (id === null) return;
            const vis = filtroVisibilidad(req.user);
            const result = await query(
                `SELECT archivo_pdf, archivo_url, numero_pedido FROM pedidos WHERE id = $1${vis.where}`,
                [id, ...vis.params]
            );
            if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
            const row = result.rows[0];
            if (row.archivo_pdf) {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `${disposition}; filename="${nombreArchivoPdf(row.numero_pedido)}"`);
                // private: el PDF tiene datos de clientes, no debe quedar en caché compartida
                res.setHeader('Cache-Control', 'private, max-age=3600');
                return res.end(row.archivo_pdf);
            }
            if (row.archivo_url) {
                // Solo se redirige a URLs válidas: filas antiguas podrían tener
                // javascript:/data: guardados y el redirect sería un vector XSS.
                const urlOk = validarArchivoUrl(row.archivo_url);
                if (urlOk.ok && urlOk.valor) return res.redirect(urlOk.valor);
            }
            res.status(404).json({ error: 'PDF no disponible' });
        } catch (e) { next(e); }
    };
}

router.get('/api/pedidos/:id/pdf', canView, crearRutaPdf('inline'));
router.get('/api/pedidos/:id/download-pdf', canView, crearRutaPdf('attachment'));

router.delete('/api/pedidos/:id/pdf', canBorrarPdf, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        const user = (req.user && req.user.email) || '';
        // Flujo de aprobación: PUT {estado:'aprobado'} → GET :id/download-pdf →
        // DELETE /:id/pdf. Se limpian BYTEA y archivo_url: si quedara la URL, el
        // PDF seguiría disponible vía GET /:id/pdf. La eliminación queda en el
        // historial. Idempotente: si no hay PDF responde ok igual.
        const resultado = await transaction(async (tx) => {
            const before = await tx.query(
                'SELECT id, numero_pedido, (archivo_pdf IS NOT NULL) AS tiene_pdf, archivo_url FROM pedidos WHERE id = $1 FOR UPDATE',
                [id]
            );
            if (before.rows.length === 0) return { codigo: 404, error: 'Pedido no encontrado' };
            const previo = before.rows[0];
            if (!previo.tiene_pdf && !previo.archivo_url) return { codigo: 200, ok: true };
            await tx.query('UPDATE pedidos SET archivo_pdf = NULL, archivo_url = NULL WHERE id = $1', [id]);
            await tx.query(
                'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                [id, 'Eliminación de PDF',
                 JSON.stringify({ archivo_pdf: previo.tiene_pdf ? 'PDF adjunto' : null, archivo_url: previo.archivo_url || null }),
                 JSON.stringify({ archivo_pdf: null, archivo_url: null }),
                 user]
            );
            return { codigo: 200, ok: true };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Re-subir el PDF de un pedido existente (rescate de pedidos rechazados o
// reemplazo del documento). Permiso de EDICIÓN porque es parte del flujo de
// revisión. El BYTEA queda como fuente de verdad: se limpia archivo_url.
router.post('/api/pedidos/:id/pdf', canUpdate, subirArchivoPdf, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        if (!req.file || !req.file.buffer) return res.status(400).json({ error: 'Archivo PDF requerido' });
        const user = (req.user && req.user.email) || '';
        const vis = filtroVisibilidad(req.user);
        const resultado = await transaction(async (tx) => {
            const before = await tx.query(
                `SELECT id, numero_pedido, (archivo_pdf IS NOT NULL) AS tiene_pdf, archivo_url FROM pedidos WHERE id = $1${vis.where} FOR UPDATE`,
                [id, ...vis.params]
            );
            if (before.rows.length === 0) return { codigo: 404, error: 'Pedido no encontrado' };
            const previo = before.rows[0];
            await tx.query('UPDATE pedidos SET archivo_pdf = $1, archivo_url = NULL WHERE id = $2', [req.file.buffer, id]);
            await tx.query(
                'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                [id, 'Subida de PDF',
                 JSON.stringify({ archivo_pdf: previo.tiene_pdf ? 'PDF adjunto' : null, archivo_url: previo.archivo_url || null }),
                 JSON.stringify({ archivo_pdf: 'PDF adjunto', archivo_url: null }),
                 user]
            );
            return { codigo: 200, ok: true };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

router.get('/api/pedidos/:id', canView, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        // Columnas sin archivo_pdf y con el mismo aislamiento que el listado.
        const vis = filtroVisibilidad(req.user);
        const result = await query(
            `SELECT ${COLS_PEDIDO} FROM pedidos WHERE id = $1${vis.where}`,
            [id, ...vis.params]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

router.get('/api/pedidos/:id/historial', canView, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        const vis = filtroVisibilidad(req.user);
        const pedido = await query(`SELECT id FROM pedidos WHERE id = $1${vis.where}`, [id, ...vis.params]);
        if (pedido.rows.length === 0) return res.status(404).json({ error: 'Pedido no encontrado' });
        const result = await query(
            'SELECT id, accion, campos_antes, campos_despues, usuario, created_at FROM pedido_historial WHERE pedido_id = $1 ORDER BY created_at DESC, id DESC',
            [id]
        );
        res.json(result.rows);
    } catch (e) { next(e); }
});

router.post('/api/pedidos/cleanup-pdf', canDelete, requireAdmin, async (req, res, next) => {
    try {
        // Borrado masivo de PDFs de pedidos ya resueltos (mantención de espacio).
        // Por ser destructivo e irreversible exige además rol admin, no solo el
        // permiso 'pedidos.eliminar'. Cada borrado deja su fila de historial.
        const user = (req.user && req.user.email) || '';
        const result = await transaction(async (tx) => {
            await tx.query(
                `INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario)
                 SELECT id, 'Eliminación de PDF', jsonb_build_object('archivo_pdf', 'PDF adjunto'),
                        jsonb_build_object('archivo_pdf', NULL), $1
                 FROM pedidos WHERE estado != 'pendiente' AND archivo_pdf IS NOT NULL`,
                [user]
            );
            return tx.query("UPDATE pedidos SET archivo_pdf = NULL WHERE estado != 'pendiente' AND archivo_pdf IS NOT NULL");
        });
        res.json({ ok: true, cleaned: result.rowCount });
    } catch (e) { next(e); }
});

router.put('/api/pedidos/:id', canUpdate, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        const body = req.body || {};
        // Quien revisa/aprueba es el usuario de la sesión: el body lo controla el
        // cliente y permitiría firmar la revisión como otra persona.
        const user = (req.user && req.user.email) || '';

        // ── Validación manual ──
        // El schema zod (validate.js) NO se conecta como middleware porque el PUT
        // es parcial y exigiría todos los campos; aquí se validan solo los que
        // llegan, con los mismos límites que refleja pedidosSchema.
        const numero = textoDeBody(body.numero_pedido, 'numero_pedido');
        const cliente = textoDeBody(body.cliente, 'cliente');
        const tipo = textoDeBody(body.tipo_ov, 'tipo_ov');
        const url = textoDeBody(body.archivo_url, 'archivo_url');
        const motivo = textoDeBody(body.motivo_rechazo, 'motivo_rechazo');
        const estadoBody = textoDeBody(body.estado, 'estado');
        for (const c of [numero, cliente, tipo, url, motivo, estadoBody]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }
        if (numero.valor !== undefined && !numero.valor) {
            return res.status(400).json({ error: 'El numero de pedido no puede quedar vacio' });
        }
        if (numero.valor !== undefined && numero.valor.length > LIM.numero_pedido) {
            return res.status(400).json({ error: `El numero de pedido no puede superar ${LIM.numero_pedido} caracteres` });
        }
        if (cliente.valor !== undefined && !cliente.valor) {
            return res.status(400).json({ error: 'El cliente no puede quedar vacio' });
        }
        if (cliente.valor !== undefined && cliente.valor.length > LIM.cliente) {
            return res.status(400).json({ error: `El cliente no puede superar ${LIM.cliente} caracteres` });
        }
        const tipoFinal = tipo.valor === undefined ? undefined : (tipo.valor || 'Normal');
        if (tipoFinal !== undefined && tipoFinal.length > LIM.tipo_ov) {
            return res.status(400).json({ error: `El tipo_ov no puede superar ${LIM.tipo_ov} caracteres` });
        }
        let urlFinal;
        if (url.valor !== undefined) {
            const urlOk = validarArchivoUrl(url.valor);
            if (!urlOk.ok) return res.status(400).json({ error: urlOk.error });
            urlFinal = urlOk.valor;
        }
        if (motivo.valor !== undefined && motivo.valor.length > LIM.motivo_rechazo) {
            return res.status(400).json({ error: `El motivo de rechazo no puede superar ${LIM.motivo_rechazo} caracteres` });
        }
        const estadoPedido = estadoBody.valor;
        if (estadoPedido !== undefined && !ESTADOS.includes(estadoPedido)) {
            return res.status(400).json({ error: `Estado desconocido '${estadoPedido}'. Estados validos: ${ESTADOS.join(', ')}` });
        }
        const hayCampos = [numero.valor, cliente.valor, tipoFinal, urlFinal].some(v => v !== undefined);
        if (estadoPedido === undefined && !hayCampos && motivo.valor === undefined) {
            return res.status(400).json({ error: 'No hay datos para actualizar' });
        }

        const resultado = await transaction(async (tx) => {
            const sel = await tx.query(
                `SELECT ${COLS_PEDIDO}, (archivo_pdf IS NOT NULL) AS tiene_pdf FROM pedidos WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (sel.rows.length === 0) return { codigo: 404, error: 'Pedido no encontrado' };
            const before = sel.rows[0];
            const estadoActual = before.estado;
            if (!ESTADOS.includes(estadoActual)) {
                return { codigo: 400, error: `El pedido tiene un estado desconocido '${estadoActual}'; corrijalo antes de operar` };
            }

            // Estado destino: el que envía el cliente; si no envía estado pero sí
            // edita campos, el pedido vuelve a 'pendiente' (editar = volver a
            // revisión / rescatar un rechazado); si no, se mantiene el estado.
            let destino = estadoActual;
            if (estadoPedido !== undefined) destino = estadoPedido;
            else if (hayCampos) destino = 'pendiente';

            // ── Máquina de estados ──
            const permitidas = TRANSICIONES[estadoActual] || [];
            if (!permitidas.includes(destino)) {
                if (estadoActual === 'rechazado' && destino === 'aprobado') {
                    return { codigo: 409, error: 'No se puede aprobar un pedido rechazado directamente: edite el pedido para volverlo a pendiente y luego apruebelo' };
                }
                if (estadoActual === destino) {
                    return { codigo: 409, error: `El pedido ya esta ${destino}; para modificarlo vuelvalo a pendiente primero` };
                }
                return { codigo: 409, error: `Transicion no permitida: ${estadoActual} -> ${destino}. Desde '${estadoActual}' solo: ${permitidas.join(', ')}` };
            }
            if (destino === 'rechazado' && !motivo.valor) {
                return { codigo: 400, error: 'El motivo de rechazo es obligatorio' };
            }
            // La aprobación y el rechazo son acciones puras de estado: no aceptan
            // ediciones de datos mezcladas en el mismo request (por contrato,
            // editar exige volver el pedido a 'pendiente' y luego re-aprobarlo).
            if (hayCampos && (destino === 'aprobado' || destino === 'rechazado')) {
                return { codigo: 400, error: 'Para editar los datos del pedido vuelvalo a pendiente primero; no mezcle ediciones con la aprobacion o el rechazo' };
            }
            if (destino === estadoActual && !hayCampos) {
                return { codigo: 400, error: 'No hay datos para actualizar' };
            }

            // ── UPDATE según el destino ──
            let result;
            if (destino === 'rechazado') {
                // Rechazo: además del estado y el motivo se ELIMINA el PDF (BYTEA
                // y archivo_url) para que el documento rechazado no siga disponible.
                result = await tx.query(
                    `UPDATE pedidos SET estado = 'rechazado', motivo_rechazo = $1, revisado_por = $2,
                        fecha_revision = CURRENT_TIMESTAMP, archivo_pdf = NULL, archivo_url = NULL
                     WHERE id = $3 RETURNING ${COLS_PEDIDO}`,
                    [motivo.valor || null, user, id]
                );
            } else if (destino === 'aprobado') {
                result = await tx.query(
                    `UPDATE pedidos SET estado = 'aprobado', motivo_rechazo = NULL, revisado_por = $1,
                        fecha_revision = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${COLS_PEDIDO}`,
                    [user, id]
                );
            } else {
                // 'pendiente': edición normal, rescate de un rechazado o vuelta a
                // pendiente desde aprobado. Se limpian los datos de la revisión.
                const fields = ["estado = 'pendiente'", 'motivo_rechazo = NULL', 'revisado_por = NULL', 'fecha_revision = NULL'];
                const values = [];
                let idx = 1;
                if (numero.valor !== undefined) { fields.push('numero_pedido = $' + idx++); values.push(numero.valor); }
                if (cliente.valor !== undefined) { fields.push('cliente = $' + idx++); values.push(cliente.valor); }
                if (tipoFinal !== undefined) { fields.push('tipo_ov = $' + idx++); values.push(tipoFinal); }
                if (urlFinal !== undefined) { fields.push('archivo_url = $' + idx++); values.push(urlFinal); }
                values.push(id);
                result = await tx.query(
                    `UPDATE pedidos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${COLS_PEDIDO}`,
                    values
                );
            }
            const after = result.rows[0];

            // ── Historial del cambio (misma transacción que el UPDATE) ──
            const changes = {};
            for (const key of ['numero_pedido', 'cliente', 'tipo_ov', 'estado', 'motivo_rechazo', 'revisado_por', 'archivo_url']) {
                if (before[key] !== after[key]) {
                    changes[key] = { antes: before[key], despues: after[key] };
                }
            }
            if (Object.keys(changes).length > 0) {
                let accion = 'Edición';
                if (before.estado !== after.estado) {
                    if (after.estado === 'aprobado') accion = 'Aprobado';
                    else if (after.estado === 'rechazado') accion = 'Rechazado';
                    else if (after.estado === 'pendiente') accion = 'Vuelto a pendiente';
                }
                await tx.query(
                    'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                    [id, accion, JSON.stringify(before), JSON.stringify(changes), user]
                );
            }
            // Si el rechazo borró un PDF, queda además su propio evento en el historial.
            if (destino === 'rechazado' && (before.tiene_pdf || before.archivo_url)) {
                await tx.query(
                    'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                    [id, 'Eliminación de PDF',
                     JSON.stringify({ archivo_pdf: before.tiene_pdf ? 'PDF adjunto' : null, archivo_url: before.archivo_url || null }),
                     JSON.stringify({ archivo_pdf: null, archivo_url: null }),
                     user]
                );
            }
            return { codigo: 200, pedido: after };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json(resultado.pedido);
    } catch (e) {
        // 23505 = UNIQUE de numero_pedido en BD: convive con la validación previa.
        if (e && e.code === '23505') return res.status(409).json({ error: 'Ya existe un pedido con este numero' });
        next(e);
    }
});

router.delete('/api/pedidos/:id', canDelete, async (req, res, next) => {
    try {
        const id = parseIdPedido(req, res);
        if (id === null) return;
        const user = (req.user && req.user.email) || '';
        const resultado = await transaction(async (tx) => {
            const sel = await tx.query(
                `SELECT ${COLS_PEDIDO}, (archivo_pdf IS NOT NULL) AS tiene_pdf FROM pedidos WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (sel.rows.length === 0) return { codigo: 404, error: 'Pedido no encontrado' };
            // Fila final del historial con acción 'Eliminación' ANTES del delete.
            // OJO: pedido_historial referencia pedidos(id) ON DELETE CASCADE en el
            // esquema actual (dbSchema.js), así que esta fila se borra junto con el
            // pedido; si el esquema conserva el historial (sin CASCADE) queda como
            // registro final de la eliminación.
            await tx.query(
                'INSERT INTO pedido_historial (pedido_id, accion, campos_antes, campos_despues, usuario) VALUES ($1, $2, $3, $4, $5)',
                [id, 'Eliminación', JSON.stringify(sel.rows[0]), '{}', user]
            );
            await tx.query('DELETE FROM pedidos WHERE id = $1', [id]);
            return { codigo: 200, ok: true };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

module.exports = router;
