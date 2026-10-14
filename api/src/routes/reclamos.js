const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
// transaction() vive en dbPool (mismo pool que query): el INSERT/UPDATE de un
// reclamo y su fila en reclamos_historial se escriben dentro de la MISMA
// transacción para que, si algo falla, no quede el reclamo cambiado sin su
// traza (o al revés). Antes el historial era un .catch(()=>{}) "fire and forget".
const { transaction } = require('../config/dbPool');
const { crudPerms, requireAdmin } = require('../middleware/permisos');

const MOD = 'reclamos';
const perms = crudPerms(MOD);

// ═══════════════════════════════════════════════════════
// DOMINIO: estados, resoluciones y máquina de estados
// ═══════════════════════════════════════════════════════

// Estados REALES del negocio: SOLO 3. 'EN PROCESO' NO existe en el flujo
// (pertenecía al vocabulario anterior; ver ESTADOS_LEGACY).
const ESTADOS = ['PENDIENTE', 'EN REVISION', 'FINALIZADO'];

// LEGACY: estado del vocabulario anterior que puede seguir existiendo en filas
// viejas de la BD. Se acepta SOLO como estado de ORIGEN (para no romper la
// operación de esos reclamos) y como valor de FILTRO del listado (para poder
// ubicarlos); NUNCA como destino nuevo.
// OJO: el CHECK de dominio de la BD (dbSchema.js) incluye 'EN PROCESO' y está
// bien así: un CHECK amplio no invalida filas legadas al migrar. El vocabulario
// de la APP es más estricto (3 estados) y se valida aquí, en la capa de
// aplicación. No tocar dbSchema.js por esto.
const ESTADOS_LEGACY = ['EN PROCESO'];
const ESTADOS_TODOS = [...ESTADOS, ...ESTADOS_LEGACY];

// resolucion: '' = sin resolver todavía. Solo se permite (y se exige) al FINALIZADO.
const RESOLUCIONES = ['Aceptada Fabricacion nueva', 'Aceptada Reproceso', 'Rechazada'];

// ── Máquina de estados de PUT /api/reclamos/:id/estado ───────────────────────
//   PENDIENTE   → EN REVISION    pasar a revisión (sella fecha_revision)
//   EN REVISION → FINALIZADO     cerrar el reclamo (requiere 'resolucion',
//                                sella fecha_fin)
//   EN REVISION → PENDIENTE      devolver a pendiente (limpia las etapas)
//   FINALIZADO  → EN REVISION    REABRIR un reclamo cerrado (limpia fecha_fin,
//                                las marcas LEGACY de proceso y la resolución:
//                                vuelve a quedar sin resolver)
//   LEGACY (solo como ORIGEN): una fila antigua con estado 'EN PROCESO' puede
//   transicionar a EN REVISION, PENDIENTE o FINALIZADO; pero 'EN PROCESO' NUNCA
//   se acepta como destino (400).
// Cualquier otra transición (incluido "cambiar" al mismo estado) → 409.
// Estado destino desconocido o NULL → 400. Estado actual desconocido (fuera de
// ESTADOS_TODOS) o NULL → 400.
const TRANSICIONES = {
    'PENDIENTE':   ['EN REVISION'],
    'EN REVISION': ['FINALIZADO', 'PENDIENTE'],
    'FINALIZADO':  ['EN REVISION'],
    // LEGACY: solo como estado de origen (nunca como destino)
    'EN PROCESO':  ['EN REVISION', 'PENDIENTE', 'FINALIZADO'],
};

// Orden cronológico de las etapas (incluye la LEGACY) SOLO para saber qué
// limpiar al retroceder:
//   PENDIENTE=0, EN REVISION=1, EN PROCESO(legacy)=2, FINALIZADO=3
const ORDEN_ESTADO = { 'PENDIENTE': 0, 'EN REVISION': 1, 'EN PROCESO': 2, 'FINALIZADO': 3 };

// Columnas de tracking por etapa que se SELLAN al llegar (las del flujo real).
// Al llegar a una etapa se sella su fecha y su responsable; al retroceder se
// limpian las etapas posteriores al destino (y la resolución, que solo vive en
// FINALIZADO) para no dejar marcas de pasos que ya no son ciertos. La limpieza
// cubre las 3 etapas del flujo nuevo (PENDIENTE=0 → se limpia todo al volver).
const ETAPAS = {
    'EN REVISION': { orden: 1, fecha: 'fecha_revision', resp: 'responsable_revision' },
    'FINALIZADO':  { orden: 3, fecha: 'fecha_fin',      resp: 'responsable_fin' },
};

// LEGACY: columnas de la etapa 'EN PROCESO' del vocabulario anterior. Siguen
// EXISTIENDO en la BD (no se borran) pero dejan de POBLARSE: solo se LIMPIAN
// junto a las demás etapas al retroceder, para no dejar marcas de un paso que
// ya no existe en el flujo.
const ETAPAS_LEGACY = [
    { orden: 2, fecha: 'fecha_proceso', resp: 'responsable_proceso' }
];

// ═══════════════════════════════════════════════════════
// COLUMNAS EXPUESTAS EN JSON
// ═══════════════════════════════════════════════════════
// El listado (GET /api/reclamos) y las mutaciones NO traen 'fotos': son JSONB
// base64 de hasta 15 MB y arrastrarlos en cada listado mataba el rendimiento.
// Solo GET /api/reclamos/:id (edición) devuelve el reclamo completo con fotos.
const COLS_RECLAMO =
    'id, numero_reclamo, fecha_ingreso, responsable_ingreso, correo_electronico, ' +
    'cliente, numero_orden, items, descripcion, detalle_reclamo, estado, ' +
    'responsable_falla, motivo, observacion_analisis, resolucion, ' +
    'fecha_revision, responsable_revision, fecha_proceso, responsable_proceso, ' +
    'fecha_fin, responsable_fin, costo_total, created_at, updated_at';
const COLS_RECLAMO_DETALLE = COLS_RECLAMO + ', fotos';

// Límites de los campos de texto (antes un valor largo desbordaba VARCHAR(n) y
// terminaba en un 500 de PostgreSQL).
const LIM = {
    cliente: 200,
    numero_orden: 50,
    descripcion: 2000,
    detalle_reclamo: 5000,
    motivo: 200,
    observacion_analisis: 2000,
    responsable_falla: 100,
    observacion: 2000,
    buscar: 200,
    resp_matriz: 100,
    motivo_matriz: 200,
    item_texto: 50,
    item_descripcion: 500
};
const MAX_ITEMS = 100;
const MAX_CANTIDAD = 1000000;
const MAX_FOTOS = 10;
const MAX_FOTO_BYTES = 5 * 1024 * 1024;   // 5 MB por foto (binario decodificado)
const MAX_FOTOS_BYTES = 15 * 1024 * 1024; // 15 MB en total

// Foto válida: data URL de imagen jpeg/png/webp con payload base64.
const FOTO_RE = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/;

// ═══════════════════════════════════════════════════════
// MIGRACIÓN DE ESQUEMA (una sola vez por proceso)
// ═══════════════════════════════════════════════════════
// ANTES ensureColumns() corría DDL + varios UPDATE masivos sobre TODA la tabla
// en cada request de ~13 endpoints (y el UPDATE masivo de costo_total además
// pisaba el costo en cada listado). Ahora:
//   - la migración corre UNA vez por proceso (flag _esquemaListo),
//   - los ALTER solo se ejecutan si falta la columna (chequeo barato),
//   - el UPDATE masivo de costo_total quedó ELIMINADO: el costo se calcula con
//     la fórmula canónica al guardar y en la propia query del reporte.
let _esquemaListo = false;

// Tablas base del módulo. IF NOT EXISTS: idempotente. OJO: reclamos_historial
// se crea con ON DELETE SET NULL (reclamo_id NULLABLE) para que la fila final
// 'Eliminación' sobreviva al borrado del reclamo; si la tabla ya existe con
// ON DELETE CASCADE (esquema viejo), la convierte el agente de esquema
// (dbSchema.js) — aquí no se toca una tabla ya creada.
async function asegurarTablas() {
    await query(`
        CREATE TABLE IF NOT EXISTS matriz_responsables_motivos (
            id SERIAL PRIMARY KEY,
            responsable VARCHAR(100) NOT NULL,
            motivo VARCHAR(200) NOT NULL,
            activo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        )`);
    await query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_resp_motivo_unique
        ON matriz_responsables_motivos(responsable, motivo) WHERE activo = TRUE`);

    await query(`
        CREATE TABLE IF NOT EXISTS reclamos_devoluciones (
            id SERIAL PRIMARY KEY,
            numero_reclamo SERIAL,
            fecha_ingreso TIMESTAMP DEFAULT NOW(),
            responsable_ingreso VARCHAR(200) DEFAULT '',
            cliente VARCHAR(200) DEFAULT '',
            numero_orden VARCHAR(50) DEFAULT '',
            items JSONB DEFAULT '[]',
            descripcion TEXT DEFAULT '',
            detalle_reclamo TEXT DEFAULT '',
            fotos JSONB DEFAULT '[]',
            estado VARCHAR(30) DEFAULT 'PENDIENTE',
            responsable_falla VARCHAR(100) DEFAULT '',
            motivo VARCHAR(200) DEFAULT '',
            observacion_analisis TEXT DEFAULT '',
            resolucion VARCHAR(50) DEFAULT '',
            fecha_revision TIMESTAMP,
            responsable_revision VARCHAR(200) DEFAULT '',
            fecha_proceso TIMESTAMP,
            responsable_proceso VARCHAR(200) DEFAULT '',
            fecha_fin TIMESTAMP,
            responsable_fin VARCHAR(200) DEFAULT '',
            correo_electronico VARCHAR(255) DEFAULT '',
            costo_total NUMERIC DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON reclamos_devoluciones(estado)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON reclamos_devoluciones(fecha_ingreso)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos_devoluciones(cliente)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reclamos_numero ON reclamos_devoluciones(numero_reclamo)`);

    await query(`
        CREATE TABLE IF NOT EXISTS reclamos_historial (
            id SERIAL PRIMARY KEY,
            reclamo_id INTEGER REFERENCES reclamos_devoluciones(id) ON DELETE SET NULL,
            accion VARCHAR(100) NOT NULL,
            estado_antes VARCHAR(30),
            estado_despues VARCHAR(30),
            responsable VARCHAR(200) DEFAULT '',
            observacion TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT NOW()
        )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_reclamos_hist_id ON reclamos_historial(reclamo_id)`);
}

// Columnas agregadas a lo largo del tiempo: solo se ALTERea lo que falta.
async function migrarColumnas() {
    const cols = await query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='reclamos_devoluciones'`
    );
    const existing = cols.rows.map(r => r.column_name);
    if (existing.length === 0) return; // la tabla no existe todavía: la crea asegurarTablas()
    if (!existing.includes('items')) {
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN items JSONB DEFAULT '[]'`);
    }
    if (!existing.includes('fecha_revision')) {
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN fecha_revision TIMESTAMP`);
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN responsable_revision VARCHAR(200) DEFAULT ''`);
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN fecha_proceso TIMESTAMP`);
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN responsable_proceso VARCHAR(200) DEFAULT ''`);
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN fecha_fin TIMESTAMP`);
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN responsable_fin VARCHAR(200) DEFAULT ''`);
    }
    if (!existing.includes('correo_electronico')) {
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN correo_electronico VARCHAR(255) DEFAULT ''`);
    }
    if (!existing.includes('costo_total')) {
        await query(`ALTER TABLE reclamos_devoluciones ADD COLUMN costo_total NUMERIC DEFAULT 0`);
    }
}

// Migraciones perezosas de DATOS. Son UPDATEs con condición (idempotentes) y
// corren UNA vez por proceso; en cada request era un ataque a la tabla.
// IMPORTANTE: ya NO se recalcula costo_total masivamente aquí.
async function migrarDatos() {
    // 1) responsable_ingreso guardado como email → nombre del usuario
    const tableCheck = await query(
        `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='usuarios')`
    );
    if (tableCheck.rows[0].exists) {
        await query(`
            UPDATE reclamos_devoluciones r
            SET responsable_ingreso = u.nombre
            FROM usuarios u
            WHERE r.responsable_ingreso = u.email
              AND r.responsable_ingreso LIKE '%@%'
              AND u.nombre IS NOT NULL
              AND u.nombre != ''
        `);
        // 2) backfill de correo_electronico para registros existentes
        await query(`
            UPDATE reclamos_devoluciones r
            SET correo_electronico = u.email
            FROM usuarios u
            WHERE r.responsable_ingreso = u.nombre
              AND (r.correo_electronico IS NULL OR r.correo_electronico = '')
              AND u.email IS NOT NULL
              AND u.email != ''
        `);
    }
    // 3) si responsable_ingreso aún tiene un email directo, usarlo como correo
    await query(`
        UPDATE reclamos_devoluciones
        SET correo_electronico = responsable_ingreso
        WHERE (correo_electronico IS NULL OR correo_electronico = '')
          AND responsable_ingreso LIKE '%@%'
    `);
    // 4) RAIZ: normaliza el catalogo matriz (responsables en Titulo, motivos en
    // Frase). Los desplegables del formulario nacen de este catalogo: si esta en
    // MAYUSCULAS, todo lo que se seleccione se guarda gritado. Los duplicados
    // que quedan iguales tras normalizar se fusionan (se desactiva el repetido;
    // el indice unico es parcial WHERE activo).
    const matriz = await query('SELECT id, responsable, motivo FROM matriz_responsables_motivos');
    for (const f of matriz.rows) {
        const resp = tituloTexto(f.responsable || '');
        const mot = fraseTexto(f.motivo || '');
        if (resp === (f.responsable || '') && mot === (f.motivo || '')) continue;
        const dup = await query(
            'SELECT id FROM matriz_responsables_motivos WHERE LOWER(responsable) = LOWER($1) AND LOWER(motivo) = LOWER($2) AND id <> $3 AND activo = TRUE LIMIT 1',
            [resp, mot, f.id]
        );
        if (dup.rows.length > 0) {
            await query('UPDATE matriz_responsables_motivos SET activo = FALSE WHERE id = $1', [f.id]);
        } else {
            await query('UPDATE matriz_responsables_motivos SET responsable = $1, motivo = $2 WHERE id = $3', [resp, mot, f.id]);
        }
    }
}

async function ensureColumns() {
    if (_esquemaListo) return;
    try {
        await asegurarTablas();
        await migrarColumnas();
        await migrarDatos();
        _esquemaListo = true;
    } catch (e) {
        // Si falla (BD caída, permisos) NO se marca como listo: se reintenta en el
        // próximo request. La migración nunca rompe el request.
        console.error('ensureColumns error:', e.message);
    }
}

// ═══════════════════════════════════════════════════════
// HELPERS DE VALIDACIÓN (manual, al estilo pedidos.js)
// El schema zod de validate.js (reclamosSchema) es solo de REFERENCIA: el PUT
// es parcial y aquí se validan únicamente los campos que llegan.
// ═══════════════════════════════════════════════════════

// Id de la URL: entero positivo o 400 (antes un id no numérico llegaba a la
// query como NaN y terminaba en un 500 de PostgreSQL).
function parseIdReclamo(req, res) {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: 'Id de reclamo invalido' });
        return null;
    }
    return id;
}

// Campo de texto del body: null/undefined = ausente, string = trim + largo
// máximo, cualquier otro tipo = error de validación.
function textoDeBody(valor, campo, max, modo) {
    if (valor === undefined || valor === null) return { ok: true, valor: undefined };
    if (typeof valor !== 'string') return { ok: false, error: `El campo '${campo}' debe ser texto` };
    let t = valor.trim();
    if (t.length > max) return { ok: false, error: `El campo '${campo}' no puede superar ${max} caracteres` };
    if (modo === 'titulo') t = tituloTexto(t);
    else if (modo === 'frase') t = fraseTexto(t);
    return { ok: true, valor: t };
}

// Presentacion normalizada SIN inventar acentos:
//   tituloTexto('FABRICACION MALFRED') -> 'Fabricacion Malfred'
//   fraseTexto('DEFECTO DE FABRICACION') -> 'Defecto de fabricacion'
function tituloTexto(s) { return String(s || '').toLowerCase().replace(/\b[a-záéíóúñü]/g, ch => ch.toUpperCase()); }
function fraseTexto(s) { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); }

// Fecha de filtro (query string): string parseable o 400.
function fechaDeQuery(valor, campo) {
    if (typeof valor !== 'string' || valor.length > 30 || Number.isNaN(Date.parse(valor))) {
        return { ok: false, error: `El filtro '${campo}' debe ser una fecha valida (ej: 2026-01-31)` };
    }
    return { ok: true, valor };
}

// Número de un item (dimensiones): ausente → porDefecto, numérico finito en
// [0, MAX_CANTIDAD] o error.
function numeroDeItem(valor, campo, n, porDefecto) {
    if (valor === undefined || valor === null || valor === '') return { ok: true, valor: porDefecto };
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0 || num > MAX_CANTIDAD) {
        return { ok: false, error: `Item ${n}: '${campo}' debe ser un numero entre 0 y ${MAX_CANTIDAD}` };
    }
    return { ok: true, valor: num };
}

// items: array de máximo MAX_ITEMS objetos. Cada item puede traer
// { item, codigo, descripcion, cantidad, ancho, alto, espesor, m2, kg,
//   valor_unitario } y se reconstruye SOLO con esas claves (sin basura).
//   cantidad         entera > 0 o ausente (ausente → 1)
//   valor_unitario   numérico >= 0 o ausente (ausente → 0)
//   textos           con largo máximo
function validarItems(valor) {
    if (valor === undefined || valor === null) return { ok: true, items: undefined };
    if (!Array.isArray(valor)) return { ok: false, error: "El campo 'items' debe ser un arreglo" };
    if (valor.length > MAX_ITEMS) {
        return { ok: false, error: `El campo 'items' no puede tener mas de ${MAX_ITEMS} elementos` };
    }
    const items = [];
    for (let i = 0; i < valor.length; i++) {
        const it = valor[i];
        const n = i + 1;
        if (!it || typeof it !== 'object' || Array.isArray(it)) {
            return { ok: false, error: `Item ${n}: debe ser un objeto` };
        }
        const txt = [
            textoDeBody(it.item, `item ${n}: item`, LIM.item_texto),
            textoDeBody(it.codigo, `item ${n}: codigo`, LIM.item_texto),
            textoDeBody(it.descripcion, `item ${n}: descripcion`, LIM.item_descripcion)
        ];
        for (const c of txt) if (!c.ok) return c;

        // cantidad: entera > 0 o ausente
        let cantidad = 1;
        if (it.cantidad !== undefined && it.cantidad !== null && it.cantidad !== '') {
            const c = Number(it.cantidad);
            if (!Number.isInteger(c) || c <= 0 || c > MAX_CANTIDAD) {
                return { ok: false, error: `Item ${n}: 'cantidad' debe ser un entero mayor que 0` };
            }
            cantidad = c;
        }
        // valor_unitario: numérico >= 0 o ausente (0)
        let valorUnitario = 0;
        if (it.valor_unitario !== undefined && it.valor_unitario !== null && it.valor_unitario !== '') {
            const v = Number(it.valor_unitario);
            if (!Number.isFinite(v) || v < 0) {
                return { ok: false, error: `Item ${n}: 'valor_unitario' debe ser un numero mayor o igual a 0` };
            }
            valorUnitario = v;
        }
        const dims = {};
        for (const campo of ['ancho', 'alto', 'espesor', 'm2', 'kg']) {
            const d = numeroDeItem(it[campo], campo, n, 0);
            if (!d.ok) return d;
            dims[campo] = d.valor;
        }
        items.push({
            item: txt[0].valor || '',
            codigo: txt[1].valor || '',
            descripcion: txt[2].valor || '',
            cantidad,
            ancho: dims.ancho,
            alto: dims.alto,
            espesor: dims.espesor,
            m2: dims.m2,
            kg: dims.kg,
            valor_unitario: valorUnitario
        });
    }
    return { ok: true, items };
}

// Tamaño aproximado en bytes del payload base64 de una foto.
function bytesDeBase64(b64) {
    const padding = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
    return Math.floor((b64.length * 3) / 4) - padding;
}

// fotos: array de máximo MAX_FOTOS data-URLs de imagen (jpeg/png/webp) en
// base64, cada una <= 5 MB y el total <= 15 MB. Antes entraba cualquier string.
function validarFotos(valor) {
    if (valor === undefined || valor === null) return { ok: true, fotos: undefined };
    if (!Array.isArray(valor)) return { ok: false, error: "El campo 'fotos' debe ser un arreglo" };
    if (valor.length > MAX_FOTOS) {
        return { ok: false, error: `El campo 'fotos' no puede tener mas de ${MAX_FOTOS} imagenes` };
    }
    let total = 0;
    for (let i = 0; i < valor.length; i++) {
        const f = valor[i];
        const n = i + 1;
        if (typeof f !== 'string') return { ok: false, error: `Foto ${n}: debe ser texto base64` };
        const m = FOTO_RE.exec(f);
        if (!m) {
            return { ok: false, error: `Foto ${n}: formato invalido; se aceptan solo imagenes data:image/(jpeg|png|webp);base64,...` };
        }
        const bytes = bytesDeBase64(m[2]);
        if (bytes > MAX_FOTO_BYTES) return { ok: false, error: `Foto ${n}: supera el maximo de 5 MB` };
        total += bytes;
    }
    if (total > MAX_FOTOS_BYTES) {
        return { ok: false, error: 'El total de las fotos no puede superar 15 MB' };
    }
    return { ok: true, fotos: valor };
}

// ═══════════════════════════════════════════════════════
// COSTO TOTAL - FÓRMULA CANÓNICA (única en todo el módulo)
//   costo_total = cantidad * valor_unitario
//   cantidad       NULL o 0 (o no numérica) → 1
//   valor_unitario no numérico → 0
// Se aplica al INSERT (POST), al UPDATE (PUT) y su equivalente SQL en el
// reporte. ANTES había 3 fórmulas distintas (JS con ||, SQL con COALESCE y un
// backfill N+1 "fire and forget" en el reporte).
// ═══════════════════════════════════════════════════════
function costoTotalDeItems(items) {
    return (Array.isArray(items) ? items : []).reduce((sum, it) => {
        const vu = Number(it && it.valor_unitario);
        const valorUnitario = Number.isFinite(vu) ? vu : 0;
        const c = Number(it && it.cantidad);
        const cantidad = (Number.isFinite(c) && c !== 0) ? c : 1;
        return sum + valorUnitario * cantidad;
    }, 0);
}

// Equivalente SQL de la fórmula canónica para UN item. El regexp evita que una
// fila vieja con basura no numérica reviente el cast a numeric (en ese caso el
// valor cuenta como 0 / cantidad 1, igual que en JS).

// Identidad SIEMPRE desde la sesión (req.user lo deja el middleware de
// permisos). Los headers X-User-* y el body son controlados por el cliente y
// permitirían firmar un reclamo como otra persona.
function identidad(req) {
    const email = (req.user && req.user.email) || '';
    const nombre = (req.user && req.user.nombre) || email;
    return { email, nombre };
}

// items JSONB puede venir como string según el driver: lo normaliza a arreglo.
function parseItems(valor) {
    if (typeof valor === 'string') {
        try { return JSON.parse(valor); } catch (e) { return []; }
    }
    return Array.isArray(valor) ? valor : [];
}

// ═══════════════════════════════════════════════════════
// SETUP - endpoint de MANTENIMIENTO (solo admin)
// Crea tablas, índices y carga la matriz inicial. ANTES estaba SIN
// autenticación: cualquiera podía ejecutar DDL y UPDATEs masivos contra la BD.
// Ahora exige rol admin (requireAdmin) y ya no hace UPDATE masivo de
// costo_total. No forma parte del flujo normal del módulo.
// ═══════════════════════════════════════════════════════
router.get('/api/reclamos/setup', requireAdmin, async (req, res, next) => {
    try {
        await asegurarTablas();
        await migrarColumnas();
        await query(`
            INSERT INTO matriz_responsables_motivos (responsable, motivo) VALUES
                ('CORTE', 'MAL CORTADO'), ('CORTE', 'DIMENSION INCORRECTA'), ('CORTE', 'ESQUINA ROTA'),
                ('PULIDO', 'MAL PULIDO'), ('PULIDO', 'ESCALLA'), ('PULIDO', 'RAYA'), ('PULIDO', 'BORDE IRREGULAR'),
                ('TEMPLE', 'ROTO EN TEMPLE'), ('TEMPLE', 'DEFORME'), ('TEMPLE', 'TENSION INCORRECTA'),
                ('LAMINADO', 'BURBUJA'), ('LAMINADO', 'DELAMINACION'), ('LAMINADO', 'MAL ALINEADO'),
                ('TRANSPORTE', 'GOLPE EN TRANSPORTE'), ('TRANSPORTE', 'RAYA EN TRANSPORTE'), ('TRANSPORTE', 'ROTO EN TRANSPORTE'),
                ('INSTALACION', 'MAL INSTALADO'), ('INSTALACION', 'DAÑO EN OBRA'),
                ('CLIENTE', 'ERROR DE MEDIDA CLIENTE'), ('CLIENTE', 'NO CONFORME CLIENTE'),
                ('PRODUCCION', 'DEFECTO DE FABRICACION'), ('PRODUCCION', 'MATERIAL DEFECTUOSO')
            ON CONFLICT DO NOTHING
        `);
        res.json({ ok: true, message: 'Tablas creadas, workflow configurado' });
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════
// RECLAMOS Y DEVOLUCIONES
// ═══════════════════════════════════════════════════════

// Listar todos (con filtros opcionales). SIN fotos (ver COLS_RECLAMO).
router.get('/api/reclamos', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const { estado, buscar, fecha_inicio, fecha_fin } = req.query;
        for (const [campo, valor] of Object.entries({ estado, buscar, fecha_inicio, fecha_fin })) {
            if (valor !== undefined && typeof valor !== 'string') {
                return res.status(400).json({ error: `El filtro '${campo}' debe ser texto` });
            }
        }
        let sql = `SELECT ${COLS_RECLAMO} FROM reclamos_devoluciones`;
        const conditions = [];
        const params = [];
        let idx = 1;

        if (estado && estado !== 'TODOS') {
            // El filtro ACEPTA también el estado legacy 'EN PROCESO' (solo para
            // poder ubicar filas antiguas); el vocabulario estricto de 3 estados
            // se aplica a los DESTINOS de PUT /:id/estado.
            if (!ESTADOS_TODOS.includes(estado)) {
                return res.status(400).json({ error: `Estado de filtro invalido '${estado}'. Estados validos: ${ESTADOS_TODOS.join(', ')} (o TODOS; 'EN PROCESO' solo como filtro de datos legados)` });
            }
            conditions.push(`estado = $${idx++}`);
            params.push(estado);
        }
        if (fecha_inicio) {
            const f = fechaDeQuery(fecha_inicio, 'fecha_inicio');
            if (!f.ok) return res.status(400).json({ error: f.error });
            conditions.push(`fecha_ingreso >= $${idx++}::date`);
            params.push(f.valor);
        }
        if (fecha_fin) {
            const f = fechaDeQuery(fecha_fin, 'fecha_fin');
            if (!f.ok) return res.status(400).json({ error: f.error });
            // El rango es INCLUSIVO hasta el final del día: con
            // 'fecha_ingreso <= fecha_fin' (medianoche) se perdía el día final.
            conditions.push(`fecha_ingreso < ($${idx++}::date + INTERVAL '1 day')`);
            params.push(f.valor);
        }
        if (buscar) {
            if (buscar.length > LIM.buscar) {
                return res.status(400).json({ error: `El filtro 'buscar' no puede superar ${LIM.buscar} caracteres` });
            }
            conditions.push(`(cliente ILIKE $${idx} OR numero_orden ILIKE $${idx} OR descripcion ILIKE $${idx} OR CAST(numero_reclamo AS TEXT) ILIKE $${idx} OR items::text ILIKE $${idx})`);
            params.push('%' + buscar + '%');
            idx++;
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY numero_reclamo DESC';

        const result = await query(sql, params);
        const rows = result.rows.map(r => { r.items = parseItems(r.items); return r; });
        res.json(rows);
    } catch (e) { next(e); }
});

// Dashboard stats
router.get('/api/reclamos/dashboard/stats', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const result = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE estado = 'PENDIENTE') as pendientes,
                COUNT(*) FILTER (WHERE estado = 'EN REVISION') as en_revision,
                COUNT(*) FILTER (WHERE estado = 'FINALIZADO') as finalizados,
                COUNT(*) FILTER (WHERE resolucion = 'Aceptada Fabricacion nueva') as fab_nueva,
                COUNT(*) FILTER (WHERE resolucion = 'Aceptada Reproceso') as reproceso,
                COUNT(*) FILTER (WHERE resolucion = 'Rechazada') as rechazadas
            FROM reclamos_devoluciones
        `);
        res.json(result.rows[0]);
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════
// MATRIZ DE RESPONSABLES Y MOTIVOS
// PERMISOS (documentado): la matriz reutiliza los permisos del módulo
// 'reclamos' (reclamos.agregar para crear, reclamos.eliminar para quitar,
// reclamos para leer). No tiene permisos propios.
// ═══════════════════════════════════════════════════════

// Listar todos los responsables únicos
router.get('/api/reclamos/responsables/lista', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const result = await query(
            "SELECT DISTINCT responsable FROM matriz_responsables_motivos WHERE activo = TRUE ORDER BY responsable"
        );
        res.json(result.rows.map(r => r.responsable));
    } catch (e) { next(e); }
});

// Listar motivos por responsable
router.get('/api/reclamos/motivos/:responsable', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const responsable = String(req.params.responsable || '');
        if (responsable.length > LIM.resp_matriz) {
            return res.status(400).json({ error: `El responsable no puede superar ${LIM.resp_matriz} caracteres` });
        }
        const result = await query(
            "SELECT id, motivo FROM matriz_responsables_motivos WHERE responsable = $1 AND activo = TRUE ORDER BY motivo",
            [responsable]
        );
        res.json(result.rows);
    } catch (e) { next(e); }
});

// Listar toda la matriz
router.get('/api/reclamos/matriz', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const result = await query(
            "SELECT * FROM matriz_responsables_motivos WHERE activo = TRUE ORDER BY responsable, motivo"
        );
        res.json(result.rows);
    } catch (e) { next(e); }
});

// Agregar responsable/motivo
router.post('/api/reclamos/matriz', perms.create, async (req, res, next) => {
    try {
        await ensureColumns();
        const responsable = textoDeBody((req.body || {}).responsable, 'responsable', LIM.resp_matriz, 'titulo');
        const motivo = textoDeBody((req.body || {}).motivo, 'motivo', LIM.motivo_matriz, 'frase');
        for (const c of [responsable, motivo]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }
        if (!responsable.valor || !motivo.valor) {
            return res.status(400).json({ error: 'Responsable y motivo requeridos' });
        }
        const result = await query(
            'INSERT INTO matriz_responsables_motivos (responsable, motivo) VALUES ($1, $2) RETURNING *',
            [responsable.valor.toUpperCase(), motivo.valor.toUpperCase()]
        );
        res.json(result.rows[0]);
    } catch (e) {
        // 23505 = duplicado en el índice único (responsable, motivo)
        if (e && e.code === '23505') return res.status(400).json({ error: 'Ya existe esta combinación' });
        next(e);
    }
});

// Eliminar responsable/motivo (soft delete)
router.delete('/api/reclamos/matriz/:id', perms.delete, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const result = await query(
            'UPDATE matriz_responsables_motivos SET activo = FALSE WHERE id = $1 RETURNING id',
            [id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Buscar códigos de producción (para autocomplete en items)
router.get('/api/reclamos/codigos', perms.view, async (req, res, next) => {
    try {
        const search = req.query.search;
        if (search !== undefined && typeof search !== 'string') {
            return res.status(400).json({ error: "El filtro 'search' debe ser texto" });
        }
        const term = (search || '').trim();
        if (term.length > LIM.buscar) {
            return res.status(400).json({ error: `El filtro 'search' no puede superar ${LIM.buscar} caracteres` });
        }

        // Si la tabla de producción no existe todavía, el autocomplete se queda
        // sin sugerencias (no es un error del módulo de reclamos).
        const tableCheck = await query(
            `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='produccion_codigos')`
        );
        if (!tableCheck.rows[0].exists) return res.json([]);

        let sql = 'SELECT * FROM produccion_codigos';
        const params = [];
        if (term) {
            sql += ' WHERE codigo ILIKE $1 OR descripcion ILIKE $1 OR grupo ILIKE $1';
            params.push('%' + term + '%');
            sql += ' ORDER BY codigo LIMIT 50';
        } else {
            // Sin búsqueda, un tope: antes devolvía TODA la tabla.
            sql += ' ORDER BY codigo LIMIT 200';
        }
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (e) { next(e); }
});

// Reporte de reclamos por año
router.get('/api/reclamos/reporte', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        let anio;
        if (req.query.anio !== undefined) {
            anio = Number(req.query.anio);
            if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
                return res.status(400).json({ error: 'El filtro anio debe ser un año entre 2000 y 2100' });
            }
        } else {
            anio = new Date().getFullYear();
        }
        // Rango sargable [año-01-01, año+1-01-01) en vez de
        // EXTRACT(YEAR FROM fecha_ingreso) = $1 (no usa índices).
        const desde = `${anio}-01-01`;
        const hasta = `${anio + 1}-01-01`;
        // Filas legadas pueden tener fecha_ingreso NULL: se considera created_at
    // como respaldo (cada rama mantiene el rango sargable por índice).
    const rango = '((r.fecha_ingreso >= $1::date AND r.fecha_ingreso < $2::date) OR (r.fecha_ingreso IS NULL AND r.created_at >= $1::date AND r.created_at < $2::date))';
        const params = [desde, hasta];

        // El costo se calcula desde los items en la MISMA query (fórmula
        // canónica). ANTES había un backfill N+1 "fire and forget" que recorría
        // TODA la tabla y reescribía costo_total en cada request del reporte.
        const result = await query(`
            SELECT
                EXTRACT(MONTH FROM COALESCE(r.fecha_ingreso, r.created_at))::int as mes,
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE r.estado = 'PENDIENTE')::int as pendientes,
                COUNT(*) FILTER (WHERE r.estado = 'EN REVISION')::int as en_revision,
                -- LEGACY: cuenta las filas antiguas con estado 'EN PROCESO'
                -- (vocabulario anterior) para que los totales por mes cuadren
                COUNT(*) FILTER (WHERE r.estado = 'EN PROCESO')::int as en_proceso,
                COUNT(*) FILTER (WHERE r.estado = 'FINALIZADO')::int as finalizados,
                COUNT(*) FILTER (WHERE r.resolucion = 'Aceptada Fabricacion nueva')::int as fab_nueva,
                COUNT(*) FILTER (WHERE r.resolucion = 'Aceptada Reproceso')::int as reproceso,
                COUNT(*) FILTER (WHERE r.resolucion = 'Rechazada')::int as rechazadas,
                COALESCE(NULLIF(COALESCE(r.responsable_falla,''), ''), 'Sin asignar') as responsable
            FROM reclamos_devoluciones r
            WHERE ${rango}
            GROUP BY EXTRACT(MONTH FROM COALESCE(r.fecha_ingreso, r.created_at)), r.responsable_falla
            ORDER BY mes
        `, params);

        const motivoResult = await query(`
            SELECT r.motivo as motivo, COUNT(*)::int as total
            FROM reclamos_devoluciones r
            WHERE ${rango} AND r.motivo != ''
            GROUP BY r.motivo ORDER BY total DESC LIMIT 10
        `, params);

        const resolucionResult = await query(`
            SELECT
                COALESCE(NULLIF(r.resolucion,''), 'Sin resolver') as resolucion,
                COUNT(*)::int as total
            FROM reclamos_devoluciones r
            WHERE ${rango}
            GROUP BY r.resolucion
        `, params);

        // Costo calculado en JS desde los items: tolera CUALQUIER formato de la
        // columna items (arreglo jsonb, objeto o string legado). Las queries SQL
        // con jsonb_array_elements reventaban con items no-arreglo y con la
        // columna de tipo texto ("character varying ->> unknown") -> reporte vacio.
        const costoRows = await query(`
            SELECT EXTRACT(MONTH FROM COALESCE(r.fecha_ingreso, r.created_at))::int as mes,
                   COALESCE(NULLIF(COALESCE(r.responsable_falla,''), ''), 'Sin asignar') as responsable,
                   r.items
            FROM reclamos_devoluciones r
            WHERE ${rango}
        `, params);
        const costoPorMes = {};
        const costoPorResp = {};
        let costoTotalNum = 0;
        for (const row of costoRows.rows) {
            const costo = Number(costoTotalDeItems(parseItems(row.items))) || 0;
            if (!costo) continue;
            costoTotalNum += costo;
            const idx = (row.mes || 1) - 1;
            costoPorMes[idx] = (costoPorMes[idx] || 0) + costo;
            const respCosto = (row.responsable || '').trim() || 'Sin asignar';
            costoPorResp[respCosto] = (costoPorResp[respCosto] || 0) + costo;
        }

        // Top clientes
        const clienteResult = await query(`
            SELECT COALESCE(NULLIF(r.cliente,''), 'Sin cliente') as cliente, COUNT(*)::int as total
            FROM reclamos_devoluciones r
            WHERE ${rango}
            GROUP BY r.cliente ORDER BY total DESC LIMIT 8
        `, params);

        // (El costo por responsable se agrega en JS junto al costo por mes.)

        // Reclamos por día de semana (0=Dom, 1=Lun...)
        const diaSemanaResult = await query(`
            SELECT EXTRACT(DOW FROM COALESCE(r.fecha_ingreso, r.created_at))::int as dia, COUNT(*)::int as total
            FROM reclamos_devoluciones r
            WHERE ${rango}
            GROUP BY EXTRACT(DOW FROM COALESCE(r.fecha_ingreso, r.created_at))
            ORDER BY dia
        `, params);

        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        const porMes = {};
        const porResponsable = {};

        for (const row of result.rows) {
            const idx = row.mes - 1;
            if (!porMes[idx]) porMes[idx] = { total:0, pendientes:0, en_revision:0, en_proceso:0, finalizados:0, fab_nueva:0, reproceso:0, rechazadas:0, costo:0 };
            porMes[idx].total += row.total;
            porMes[idx].pendientes += row.pendientes;
            porMes[idx].en_revision += row.en_revision;
            porMes[idx].en_proceso += row.en_proceso;
            porMes[idx].finalizados += row.finalizados;
            porMes[idx].fab_nueva += row.fab_nueva;
            porMes[idx].reproceso += row.reproceso;
            porMes[idx].rechazadas += row.rechazadas;

            const resp = (row.responsable || '').trim() || 'Sin asignar';
            porResponsable[resp] = (porResponsable[resp] || 0) + row.total;
        }

        for (const [idxMes, costoMes] of Object.entries(costoPorMes)) {
            if (porMes[idxMes]) porMes[idxMes].costo = costoMes;
        }

        const mesesData = meses.map((nombre, i) => ({
            nombre,
            ...(porMes[i] || { total:0, pendientes:0, en_revision:0, en_proceso:0, finalizados:0, fab_nueva:0, reproceso:0, rechazadas:0, costo:0 })
        }));

        const totalGeneral = result.rows.reduce((s, r) => s + r.total, 0);
        const totalFinalizados = mesesData.reduce((s, m) => s + m.finalizados, 0);
        const costoTotal = costoTotalNum;

        // Mapear días de semana
        const diasSemana = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];
        const diasData = diasSemana.map((nombre, i) => {
            const found = diaSemanaResult.rows.find(r => r.dia === i);
            return { nombre, total: found ? found.total : 0 };
        });

        res.json({
            anio,
            meses: mesesData,
            responsables: Object.entries(porResponsable).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total - a.total),
            motivos: motivoResult.rows,
            resoluciones: resolucionResult.rows,
            clientes: clienteResult.rows,
            costoPorResponsable: Object.entries(costoPorResp).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 8),
            diasSemana: diasData,
            totalGeneral,
            totalFinalizados,
            costoTotal: Math.round(costoTotal)
        });
    } catch (e) { next(e); }
});

// ═══════════════════════════════════════════════════════
// RECLAMOS - CRUD (después de rutas nombradas)
// ═══════════════════════════════════════════════════════

// Obtener uno por ID. ÚNICO endpoint que incluye fotos (el frontend las pide
// al editar); el listado no las trae.
router.get('/api/reclamos/:id', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const result = await query(`SELECT ${COLS_RECLAMO_DETALLE} FROM reclamos_devoluciones WHERE id = $1`, [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        const row = result.rows[0];
        row.items = parseItems(row.items);
        res.json(row);
    } catch (e) { next(e); }
});

// Crear nuevo reclamo. El reclamo nace siempre en PENDIENTE y sin resolver:
// 'estado', 'resolucion', 'fecha_ingreso', 'costo_total' e identidad que lleguen
// en el body se IGNORAN (el estado/resolución se manejan en PUT /:id/estado,
// el costo se calcula con la fórmula canónica y la identidad viene de la sesión).
router.post('/api/reclamos', perms.create, async (req, res, next) => {
    try {
        await ensureColumns();
        const d = req.body || {};
        const { email, nombre } = identidad(req);

        const cliente = textoDeBody(d.cliente, 'cliente', LIM.cliente, 'titulo');
        const numeroOrden = textoDeBody(d.numero_orden, 'numero_orden', LIM.numero_orden);
        const descripcion = textoDeBody(d.descripcion, 'descripcion', LIM.descripcion);
        const detalle = textoDeBody(d.detalle_reclamo, 'detalle_reclamo', LIM.detalle_reclamo);
        const respFalla = textoDeBody(d.responsable_falla, 'responsable_falla', LIM.responsable_falla, 'titulo');
        const motivo = textoDeBody(d.motivo, 'motivo', LIM.motivo, 'frase');
        const obsAnalisis = textoDeBody(d.observacion_analisis, 'observacion_analisis', LIM.observacion_analisis);
        for (const c of [cliente, numeroOrden, descripcion, detalle, respFalla, motivo, obsAnalisis]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }
        const items = validarItems(d.items);
        if (!items.ok) return res.status(400).json({ error: items.error });
        const fotos = validarFotos(d.fotos);
        if (!fotos.ok) return res.status(400).json({ error: fotos.error });

        const itemsFinal = items.items || [];
        const costoTotal = costoTotalDeItems(itemsFinal);

        // INSERT + fila 'Creación' del historial en la MISMA transacción
        const resultado = await transaction(async (tx) => {
            const ins = await tx.query(
                `INSERT INTO reclamos_devoluciones (
                    responsable_ingreso, correo_electronico, cliente, numero_orden, items,
                    descripcion, detalle_reclamo, fotos, estado, costo_total,
                    responsable_falla, motivo, observacion_analisis
                ) VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, 'PENDIENTE', $9,
                    $10, $11, $12
                ) RETURNING ${COLS_RECLAMO}`,
                [
                    nombre, email, cliente.valor || '', numeroOrden.valor || '',
                    JSON.stringify(itemsFinal), descripcion.valor || '', detalle.valor || '',
                    JSON.stringify(fotos.fotos || []), costoTotal,
                    respFalla.valor || '', motivo.valor || '', obsAnalisis.valor || ''
                ]
            );
            const reclamo = ins.rows[0];
            await tx.query(
                'INSERT INTO reclamos_historial (reclamo_id, accion, estado_despues, responsable) VALUES ($1, $2, $3, $4)',
                [reclamo.id, 'Creación', 'PENDIENTE', nombre]
            );
            return reclamo;
        });
        res.status(201).json(resultado);
    } catch (e) { next(e); }
});

// Actualizar datos de un reclamo (edición de campos, SIN cambio de estado).
// RECHAZA con 400 los campos que pertenecen al flujo de estado:
//   'estado', 'resolucion', 'responsable_falla', 'responsable_ingreso'
// → los cambios de estado/análisis van por PUT /:id/estado (con historial) y la
// identidad se toma de la sesión. 'fecha_ingreso' y 'costo_total' del body se
// ignoran (el costo se recalcula SIEMPRE desde items con la fórmula canónica).
router.put('/api/reclamos/:id', perms.update, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const d = req.body || {};

        const prohibidos = ['estado', 'resolucion', 'responsable_falla', 'responsable_ingreso']
            .filter(c => d[c] !== undefined);
        if (prohibidos.length > 0) {
            return res.status(400).json({
                error: `Los campos ${prohibidos.map(c => `'${c}'`).join(', ')} no se editan por aqui: ` +
                    'el estado, la resolución y el análisis se cambian con PUT /api/reclamos/:id/estado ' +
                    '(queda en el historial) y la identidad se toma de la sesión'
            });
        }

        const cliente = textoDeBody(d.cliente, 'cliente', LIM.cliente, 'titulo');
        const numeroOrden = textoDeBody(d.numero_orden, 'numero_orden', LIM.numero_orden);
        const descripcion = textoDeBody(d.descripcion, 'descripcion', LIM.descripcion);
        const detalle = textoDeBody(d.detalle_reclamo, 'detalle_reclamo', LIM.detalle_reclamo);
        const motivo = textoDeBody(d.motivo, 'motivo', LIM.motivo, 'frase');
        const obsAnalisis = textoDeBody(d.observacion_analisis, 'observacion_analisis', LIM.observacion_analisis);
        for (const c of [cliente, numeroOrden, descripcion, detalle, motivo, obsAnalisis]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }
        const items = validarItems(d.items);
        if (!items.ok) return res.status(400).json({ error: items.error });
        const fotos = validarFotos(d.fotos);
        if (!fotos.ok) return res.status(400).json({ error: fotos.error });

        const cambios = {
            cliente: cliente.valor,
            numero_orden: numeroOrden.valor,
            items: items.items,
            descripcion: descripcion.valor,
            detalle_reclamo: detalle.valor,
            fotos: fotos.fotos,
            motivo: motivo.valor,
            observacion_analisis: obsAnalisis.valor
        };
        const hayDatos = Object.values(cambios).some(v => v !== undefined);
        if (!hayDatos) return res.status(400).json({ error: 'No hay datos para actualizar' });

        const { nombre } = identidad(req);

        // UPDATE + historial 'Edición' en la MISMA transacción
        const resultado = await transaction(async (tx) => {
            const sel = await tx.query(
                `SELECT ${COLS_RECLAMO} FROM reclamos_devoluciones WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (sel.rows.length === 0) return { codigo: 404, error: 'No encontrado' };
            const before = sel.rows[0];

            // Costo canónico: con los items nuevos si vienen, o con los
            // guardados si solo se editan otros campos (nunca se toma del body).
            const itemsFinales = cambios.items !== undefined ? cambios.items : parseItems(before.items);
            const costoTotal = costoTotalDeItems(itemsFinales);

            const fields = [];
            const params = [];
            let idx = 1;
            for (const [campo, valor] of Object.entries(cambios)) {
                if (valor === undefined) continue;
                const serializado = (campo === 'items' || campo === 'fotos') ? JSON.stringify(valor) : valor;
                fields.push(`${campo} = $${idx++}`);
                params.push(serializado);
            }
            fields.push(`costo_total = $${idx++}`);
            params.push(costoTotal);
            fields.push('updated_at = NOW()');
            params.push(id);

            const upd = await tx.query(
                `UPDATE reclamos_devoluciones SET ${fields.join(', ')} WHERE id = $${idx} RETURNING ${COLS_RECLAMO}`,
                params
            );
            const after = upd.rows[0];

            // Traza de lo editado (solo los campos que cambiaron)
            const tocados = Object.keys(cambios).filter(c => {
                if (c === 'items' || c === 'fotos') {
                    return JSON.stringify(parseItems(before[c])) !== JSON.stringify(cambios[c]);
                }
                return (before[c] || '') !== (cambios[c] || '');
            });
            if (tocados.length > 0) {
                await tx.query(
                    'INSERT INTO reclamos_historial (reclamo_id, accion, estado_antes, estado_despues, responsable, observacion) VALUES ($1, $2, $3, $4, $5, $6)',
                    [id, 'Edición', after.estado, after.estado, nombre, 'Campos modificados: ' + tocados.join(', ')]
                );
            }
            return { codigo: 200, reclamo: after };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json(resultado.reclamo);
    } catch (e) { next(e); }
});

// Eliminar reclamo (hard delete). ANTES el delete borraba también el historial
// por el ON DELETE CASCADE: ahora se registra la fila final 'Eliminación' en
// reclamos_historial dentro de la MISMA transacción. Con la FK en SET NULL del
// esquema esa fila SOBREVIVE al borrado (queda como traza de auditoría, con
// reclamo_id = NULL); con el esquema viejo (ON DELETE CASCADE) se borra junto
// con el reclamo.
router.delete('/api/reclamos/:id', perms.delete, async (req, res, next) => {
    try {
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const { nombre } = identidad(req);
        const resultado = await transaction(async (tx) => {
            const sel = await tx.query(
                `SELECT ${COLS_RECLAMO} FROM reclamos_devoluciones WHERE id = $1 FOR UPDATE`,
                [id]
            );
            if (sel.rows.length === 0) return { codigo: 404, error: 'No encontrado' };
            const antes = sel.rows[0];
            await tx.query(
                'INSERT INTO reclamos_historial (reclamo_id, accion, estado_antes, responsable, observacion) VALUES ($1, $2, $3, $4, $5)',
                [id, 'Eliminación', antes.estado, nombre,
                 `Reclamo #${antes.numero_reclamo} (id ${id}) eliminado (cliente: ${antes.cliente || 's/n'}, estado: ${antes.estado || 's/e'})`]
            );
            await tx.query('DELETE FROM reclamos_devoluciones WHERE id = $1', [id]);
            return { codigo: 200, ok: true };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Cambiar estado (máquina de estados + historial).
//   - estado: requerido, del catálogo ESTADOS de 3 estados (NULL, desconocido o
//     el legacy 'EN PROCESO' como destino → 400)
//   - transición fuera del árbol TRANSICIONES → 409 con mensaje claro
//   - resolucion: REQUERIDA y solo permitida al pasar a FINALIZADO (decisión
//     documentada: un reclamo cerrado sin resolución deja el reporte sin
//     clasificar; al retroceder/reabrir se limpia)
//   - responsable_falla / motivo / observacion_analisis: análisis del reclamo,
//     opcionales (se validan y quedan junto al cambio de estado en historial)
//   - sella fecha/responsable de la etapa destino y limpia las etapas
//     posteriores al retroceder (incluidas las columnas LEGACY de proceso)
router.put('/api/reclamos/:id/estado', perms.update, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const d = req.body || {};
        const { email, nombre } = identidad(req);

        // Estado destino: requerido y del catálogo estricto de 3 estados. Nunca
        // NULL y nunca el legacy 'EN PROCESO' (ese solo puede ser origen).
        const estadoBody = textoDeBody(d.estado, 'estado', 30);
        if (!estadoBody.ok) return res.status(400).json({ error: estadoBody.error });
        const estado = estadoBody.valor;
        if (!estado) return res.status(400).json({ error: 'El campo estado es requerido' });
        if (!ESTADOS.includes(estado)) {
            return res.status(400).json({ error: `Estado invalido '${estado}'. Estados validos: ${ESTADOS.join(', ')} (el estado legacy 'EN PROCESO' no se acepta como destino)` });
        }

        const observacion = textoDeBody(d.observacion, 'observacion', LIM.observacion);
        const respFalla = textoDeBody(d.responsable_falla, 'responsable_falla', LIM.responsable_falla, 'titulo');
        const motivo = textoDeBody(d.motivo, 'motivo', LIM.motivo, 'frase');
        const obsAnalisis = textoDeBody(d.observacion_analisis, 'observacion_analisis', LIM.observacion_analisis);
        for (const c of [observacion, respFalla, motivo, obsAnalisis]) {
            if (!c.ok) return res.status(400).json({ error: c.error });
        }

        // resolucion: solo al FINALIZADO y obligatoria ahí.
        let resolucion;
        if (d.resolucion !== undefined && d.resolucion !== null) {
            const r = textoDeBody(d.resolucion, 'resolucion', 50);
            if (!r.ok) return res.status(400).json({ error: r.error });
            resolucion = r.valor;
        }
        if (estado === 'FINALIZADO') {
            if (!resolucion || !RESOLUCIONES.includes(resolucion)) {
                return res.status(400).json({
                    error: `Para FINALIZAR el reclamo debe indicar la resolucion (${RESOLUCIONES.join(', ')})`
                });
            }
        } else if (resolucion) {
            return res.status(400).json({ error: 'La resolucion solo se permite al pasar a FINALIZADO' });
        }

        const resultado = await transaction(async (tx) => {
            const before = await tx.query(
                'SELECT estado FROM reclamos_devoluciones WHERE id = $1 FOR UPDATE',
                [id]
            );
            if (before.rows.length === 0) return { codigo: 404, error: 'No encontrado' };
            const estadoAntes = before.rows[0].estado;
            // El estado ACTUAL puede ser el legacy 'EN PROCESO' (ESTADOS_TODOS):
            // esos reclamos se dejan operar para no romper su flujo.
            if (!estadoAntes || !ESTADOS_TODOS.includes(estadoAntes)) {
                return { codigo: 400, error: `El reclamo tiene un estado invalido '${estadoAntes}'; corrijalo antes de operar` };
            }

            // ── Máquina de estados ──
            const permitidas = TRANSICIONES[estadoAntes] || [];
            if (!permitidas.includes(estado)) {
                if (estadoAntes === estado) {
                    return { codigo: 409, error: `El reclamo ya esta en estado '${estadoAntes}'` };
                }
                return { codigo: 409, error: `Transicion no permitida: ${estadoAntes} -> ${estado}. Desde '${estadoAntes}' solo: ${permitidas.join(', ')}` };
            }

            // ── UPDATE según el destino ──
            const sets = ['estado = $1', 'updated_at = NOW()'];
            const params = [estado];
            let idx = 2;

            // Etapa destino: sellar fecha y responsable (quién pasó el reclamo).
            // Solo el flujo nuevo de 3 estados tiene etapa sellable; 'EN PROCESO'
            // nunca es destino, así que sus columnas ya no se pueblan.
            const etapaDestino = ETAPAS[estado];
            const ordenDestino = ORDEN_ESTADO[estado] || 0; // PENDIENTE = 0
            if (etapaDestino) {
                sets.push(`${etapaDestino.fecha} = NOW()`, `${etapaDestino.resp} = $${idx++}`);
                params.push(nombre);
            }
            // Al retroceder se limpian las etapas POSTERIORES al destino (no
            // dejar marcas de pasos que ya no son ciertos). La limpieza cubre
            // las etapas del flujo nuevo (revision/fin) y las columnas LEGACY
            // de 'EN PROCESO' (fecha_proceso/responsable_proceso), que ya no se
            // poblans pero siguen existiendo en la BD.
            for (const etapa of [...Object.values(ETAPAS), ...ETAPAS_LEGACY]) {
                if (etapa.orden > ordenDestino) {
                    sets.push(`${etapa.fecha} = NULL`, `${etapa.resp} = ''`);
                }
            }
            // resolucion: se define al FINALIZADO y se limpia al salir de él
            if (estado === 'FINALIZADO') {
                sets.push(`resolucion = $${idx++}`);
                params.push(resolucion);
            } else {
                sets.push(`resolucion = ''`);
            }
            // Campos de análisis (opcionales: solo se tocan si vienen)
            if (respFalla.valor !== undefined) { sets.push(`responsable_falla = $${idx++}`); params.push(respFalla.valor); }
            if (motivo.valor !== undefined) { sets.push(`motivo = $${idx++}`); params.push(motivo.valor); }
            if (obsAnalisis.valor !== undefined) { sets.push(`observacion_analisis = $${idx++}`); params.push(obsAnalisis.valor); }

            params.push(id);
            const result = await tx.query(
                `UPDATE reclamos_devoluciones SET ${sets.join(', ')} WHERE id = $${idx} RETURNING ${COLS_RECLAMO}`,
                params
            );

            // Historial del cambio (misma transacción que el UPDATE)
            await tx.query(
                'INSERT INTO reclamos_historial (reclamo_id, accion, estado_antes, estado_despues, responsable, observacion) VALUES ($1, $2, $3, $4, $5, $6)',
                [id, `Cambio a ${estado}`, estadoAntes, estado, nombre, observacion.valor || '']
            );
            return { codigo: 200, reclamo: result.rows[0] };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json(resultado.reclamo);
    } catch (e) { next(e); }
});

// Registrar envío por mail (solo la traza: el envío lo hace el frontend)
router.post('/api/reclamos/:id/enviar-mail', perms.update, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const { nombre } = identidad(req);
        const resultado = await transaction(async (tx) => {
            const sel = await tx.query(
                'SELECT id FROM reclamos_devoluciones WHERE id = $1 FOR UPDATE',
                [id]
            );
            if (sel.rows.length === 0) return { codigo: 404, error: 'No encontrado' };
            await tx.query(
                'INSERT INTO reclamos_historial (reclamo_id, accion, responsable, observacion) VALUES ($1, $2, $3, $4)',
                [id, 'Envío por mail', nombre, 'Informe enviado por correo electrónico']
            );
            return { codigo: 200, ok: true };
        });
        if (resultado.error) return res.status(resultado.codigo).json({ error: resultado.error });
        res.json({ ok: true });
    } catch (e) { next(e); }
});

// Historial de un reclamo. Sin chequeo de existencia del reclamo: una consulta
// vacía no es un error (tras un DELETE el historial queda como traza huérfana
// con reclamo_id = NULL y ya no es consultable por este endpoint).
router.get('/api/reclamos/:id/historial', perms.view, async (req, res, next) => {
    try {
        await ensureColumns();
        const id = parseIdReclamo(req, res);
        if (id === null) return;
        const result = await query(
            'SELECT id, reclamo_id, accion, estado_antes, estado_despues, responsable, observacion, created_at FROM reclamos_historial WHERE reclamo_id = $1 ORDER BY created_at ASC, id ASC',
            [id]
        );
        res.json(result.rows);
    } catch (e) { next(e); }
});

module.exports = router;
