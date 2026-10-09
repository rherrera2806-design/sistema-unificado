const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');
const { sanitizeString } = require('../utils/helpers');

// ══════════════════════════════════════════════════════════════
// CONSTANTES Y HELPERS CANÓNICOS (exportados)
// ══════════════════════════════════════════════════════════════
// Son la fuente de verdad del módulo de inventario. Las rutas (p. ej.
// routes/catalogosInventario.js) deben usarlos en vez de reimplementar fórmulas.

const TIPOS_MOVIMIENTO = ['entrada', 'salida'];
const TIPOS_SALIDA = ['plancha_completa', 'trozo'];

// Límite por defecto y máximo de filas en getMovimientos (antes cargaba la tabla completa).
const LIMIT_MOVIMIENTOS_DEFECTO = 2000;
const LIMIT_MOVIMIENTOS_MAX = 10000;

/**
 * Fórmula canónica de KG: metros_cuadrados * espesor_mm * 2.5.
 * NO usar la fórmula antigua `m2 * 1.25 * espesor / 1000 * 2.5` (queda ~800 veces menor).
 * Uso: `KG_SQL('m.metros_cuadrados', 'mp.espesor_mm')` dentro de un SELECT.
 * @param {string} columnaM2 columna de metros cuadrados (acepta alias calificado)
 * @param {string} columnaEspesor columna del espesor en mm
 * @returns {string} expresión SQL canónica de kilos
 */
function KG_SQL(columnaM2 = 'metros_cuadrados', columnaEspesor = 'espesor') {
    // Solo se aceptan identificadores simples (o alias.calumnna) para evitar inyección SQL.
    const reId = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/;
    if (!reId.test(String(columnaM2)) || !reId.test(String(columnaEspesor))) {
        throw new Error('KG_SQL: nombre de columna inválido');
    }
    return `${columnaM2} * ${columnaEspesor} * 2.5`;
}

/**
 * Autonomía canónica del proyecto: meses = stock / consumoMensual, dias = meses * 30.
 * Devuelve SIEMPRE números (0 cuando no hay consumo que permita calcular).
 * El redondeo de presentación se hace en cada endpoint (meses → 1 decimal, días → entero).
 * @param {number|string} stock stock actual en planchas
 * @param {number|string} consumoMensual consumo promedio mensual en planchas
 * @returns {{meses: number, dias: number}}
 */
function calcularAutonomia(stock, consumoMensual) {
    const s = Number(stock);
    const c = Number(consumoMensual);
    const meses = (Number.isFinite(s) && Number.isFinite(c) && c > 0) ? s / c : 0;
    return { meses, dias: meses * 30 };
}

// ── Validación de parámetros ──────────────────────────────────
// Los errores llevan err.status para que la ruta los mapee a la respuesta HTTP.

function errorValidacion(mensaje) {
    const err = new Error(mensaje);
    err.status = 400;
    return err;
}

function errorNoEncontrado(mensaje) {
    const err = new Error(mensaje);
    err.status = 404;
    return err;
}

// Fecha de filtro: exige formato YYYY-MM-DD y una fecha real (rechaza 2024-13-40).
function validarFecha(valor, campo) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor));
    if (!m) throw errorValidacion(campo + ' debe tener formato YYYY-MM-DD');
    const anio = Number(m[1]), mes = Number(m[2]), dia = Number(m[3]);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    if (fecha.getUTCFullYear() !== anio || fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) {
        throw errorValidacion(campo + ' no es una fecha válida');
    }
    return m[0];
}

// Mes de filtro (analytics): exige formato YYYY-MM y mes 01-12.
function validarMes(valor, campo = 'mes') {
    const m = /^(\d{4})-(\d{2})$/.exec(String(valor));
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
        throw errorValidacion(campo + ' debe tener formato YYYY-MM');
    }
    return m[0];
}

function validarTipoMovimiento(valor) {
    const v = valor === null || valor === undefined ? '' : String(valor);
    if (!TIPOS_MOVIMIENTO.includes(v)) {
        throw errorValidacion("tipo_movimiento debe ser 'entrada' o 'salida'");
    }
    return v;
}

// Entero > 0 (cantidad_planchas, límites, ids). Evita NaN/0/negativos que llegaban a PostgreSQL crudos.
function parseEnteroPositivo(valor, campo) {
    const n = Number(valor);
    if (!Number.isInteger(n) || n <= 0) {
        throw errorValidacion(campo + ' debe ser un entero mayor a 0');
    }
    return n;
}

// Dimensión en mm (ancho/alto): número > 0; la columna es INTEGER por lo que se redondea.
function parseDimension(valor, campo) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) {
        throw errorValidacion(campo + ' debe ser un numero mayor a 0');
    }
    return Math.round(n);
}

// Espesor en mm: se conserva el decimal redondeado a 2 (6.35 se guarda 6.35).
// Antes parseInt() lo truncaba (6.35 → 6). Ausente o inválido → 0 (columna NOT NULL).
function parseEspesor(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100) / 100;
}

// Fecha y hora de un movimiento: valida que sea parseable y la guarda TAL CUAL
// (sin convertir a UTC) para no desplazar la fecha/hora local. Nunca escribe NULL explícito.
function parseFechaHora(valor) {
    const s = String(valor).trim();
    if (!s || isNaN(Date.parse(s))) throw errorValidacion('fecha_hora inválida');
    return s;
}

// Recorta al largo de la columna (tipo_cristal VARCHAR(50), proveedor VARCHAR(100), turno VARCHAR(10))
// para evitar errores crudos de "value too long" con nombres de materia_primas largos.
function recortar(valor, max) {
    if (valor === null || valor === undefined) return null;
    const s = String(valor);
    return s.length > max ? s.slice(0, max) : s;
}

/**
 * Tipo de salida en CREACIÓN (estricto):
 *  - 'salida' exige tipo_salida ∈ {'plancha_completa','trozo'}
 *  - 'entrada' exige tipo_salida null
 * REGLA DE SALIDAS (decisión del proyecto):
 *  - stock de PLANCHAS descuenta SOLO tipo_salida = 'plancha_completa'
 *  - stock en M² (y kg) descuenta TODAS las salidas (incluye trozos y salidas sin tipo)
 */
function normalizarTipoSalidaCrear(valor, tipoMovimiento) {
    const ts = valor === null || valor === undefined || valor === '' ? null : String(valor);
    if (tipoMovimiento === 'entrada') {
        if (ts !== null) throw errorValidacion('Las entradas no deben tener tipo de salida');
        return null;
    }
    if (ts === null || !TIPOS_SALIDA.includes(ts)) {
        throw errorValidacion("tipo_salida debe ser 'plancha_completa' o 'trozo' en las salidas");
    }
    return ts;
}

/**
 * Tipo de salida en EDICIÓN (parcial): se valida el valor presente con el mismo catálogo,
 * pero se permite limpiarlo a null (el formulario de edición ofrece "N/A" y existen filas
 * históricas con tipo_salida NULL que deben seguir siendo editables).
 */
function normalizarTipoSalidaEditar(valor) {
    const ts = valor === null || valor === undefined || valor === '' ? null : String(valor);
    if (ts !== null && !TIPOS_SALIDA.includes(ts)) {
        throw errorValidacion("tipo_salida debe ser 'plancha_completa', 'trozo' o null");
    }
    return ts;
}

/**
 * Lista de movimientos con filtros opcionales (tipo, cristal, fechaInicio, fechaFin).
 * IMPORTANTE: por defecto se limitan las filas a LIMIT_MOVIMIENTOS_DEFECTO (2000) para
 * no cargar la tabla completa; se puede ajustar con el parámetro `limit` (1..10000).
 * La respuesta sigue siendo el array de movimientos.
 */
async function getMovimientos(filtros = {}) {
    let sql = `SELECT m.*, u.nombre as usuario_nombre,
        mp.codigo_mp, mp.nombre as mp_nombre, mp.espesor_mm, mp.costo_unitario_mp, mp.codigo_sap
        FROM movimientos m 
        LEFT JOIN usuarios u ON m.usuario_id = u.id
        LEFT JOIN materias_primas mp ON m.materia_prima_id = mp.id`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.tipo) { conditions.push(`m.tipo_movimiento = $${idx++}`); params.push(filtros.tipo); }
    if (filtros.cristal) { conditions.push(`(mp.nombre ILIKE $${idx} OR m.tipo_cristal ILIKE $${idx})`); params.push('%' + filtros.cristal + '%'); idx++; }
    if (filtros.fechaInicio) { conditions.push(`m.fecha_hora >= $${idx++}`); params.push(validarFecha(filtros.fechaInicio, 'fechaInicio')); }
    if (filtros.fechaFin) {
        // Antes se concatenaba sin validar: un formato inválido llegaba a PostgreSQL y respondía 500.
        const fechaFin = validarFecha(filtros.fechaFin, 'fechaFin');
        conditions.push(`m.fecha_hora <= $${idx++}`);
        params.push(fechaFin + ' 23:59:59');
    }
    if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
    let limit = LIMIT_MOVIMIENTOS_DEFECTO;
    if (filtros.limit !== undefined && filtros.limit !== null && filtros.limit !== '') {
        limit = Math.min(parseEnteroPositivo(filtros.limit, 'limit'), LIMIT_MOVIMIENTOS_MAX);
    }
    sql += ' ORDER BY m.fecha_hora DESC LIMIT ' + limit;
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Crea un movimiento de inventario.
 * CONTRATO: el segundo parámetro (número o null) SIEMPRE define el usuario que firma el
 * movimiento; se ignora por completo data.usuario_id (la ruta lo pasa desde la sesión).
 */
async function crearMovimiento(data, usuarioId = null) {
    const usuarioFirmante = usuarioId === null || usuarioId === undefined ? null : Number(usuarioId);
    if (usuarioFirmante !== null && (!Number.isInteger(usuarioFirmante) || usuarioFirmante <= 0)) {
        throw errorValidacion('Usuario firmante inválido');
    }

    const campos = data && typeof data === 'object' ? data : {};
    const { tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, proveedor, turno, tipo_salida, observaciones, fecha_hora } = campos;

    // Validaciones de tipo y cantidad (antes: cantidad negativa → stock negativo;
    // undefined → NaN → error crudo de PostgreSQL).
    const tipoMovimientoFinal = validarTipoMovimiento(tipo_movimiento);
    const tipoSalidaFinal = normalizarTipoSalidaCrear(tipo_salida, tipoMovimientoFinal);
    const cantidadFinal = parseEnteroPositivo(cantidad_planchas, 'cantidad_planchas');

    let tipoCristalFinal = tipo_cristal;
    let espesorFinal = espesor;
    let anchoFinal = ancho;
    let altoFinal = alto;

    // Si se proporciona materia_prima_id, obtener datos de la materia prima
    let mpIdFinal = null;
    if (materia_prima_id !== undefined && materia_prima_id !== null && materia_prima_id !== '') {
        mpIdFinal = parseEnteroPositivo(materia_prima_id, 'materia_prima_id');
        const mpResult = await query('SELECT * FROM materias_primas WHERE id = $1', [mpIdFinal]);
        if (mpResult.rows.length > 0) {
            const mp = mpResult.rows[0];
            tipoCristalFinal = mp.nombre;
            espesorFinal = mp.espesor_mm;
            // Usar dimensiones de la materia prima si no se proporcionan
            // (las columnas reales son ancho_nal/alto_nal y ancho_imp/alto_imp;
            // antes se referenciaba mp.ancho/mp.alto que NO existen)
            if (!ancho || !alto) {
                anchoFinal = mp.ancho_nal || mp.ancho_imp || 0;
                altoFinal = mp.alto_nal || mp.alto_imp || 0;
            }
        }
    }

    const anchoInt = parseDimension(anchoFinal, 'Ancho');
    const altoInt = parseDimension(altoFinal, 'Alto');
    // Decimal redondeado a 2 decimales: antes parseInt() truncaba los espesores (6.35 → 6).
    const espesorNum = parseEspesor(espesorFinal);

    if (tipoCristalFinal === null || tipoCristalFinal === undefined || String(tipoCristalFinal).trim() === '') {
        throw errorValidacion('Tipo de cristal requerido');
    }

    const metros_cuadrados = (anchoInt * altoInt * cantidadFinal) / 1000000;

    // fecha_hora: si viene, debe ser válida; si no, se usa la hora actual.
    let fechaFinal = new Date().toISOString();
    if (fecha_hora !== undefined && fecha_hora !== null && fecha_hora !== '') {
        fechaFinal = parseFechaHora(fecha_hora);
    }

    // VALIDACIÓN DE STOCK EN EL BACKEND (antes solo la hacía el frontend:
    // dos salidas concurrentes dejaban stock negativo). Todo en una transacción
    // con lock sobre la materia prima para serializar movimientos simultáneos.
    return await transaction(async ({ query: q }) => {
        if (mpIdFinal) {
            await q('SELECT id FROM materias_primas WHERE id = $1 FOR UPDATE', [mpIdFinal]);
        }
        if (tipoMovimientoFinal === 'salida' && mpIdFinal) {
            if (tipoSalidaFinal === 'plancha_completa') {
                // Mismo criterio que getStockPorDimension / la UI:
                // stock = entradas - salidas plancha_completa, por medida.
                const stockRes = await q(`
                    SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN cantidad_planchas ELSE 0 END),0)
                         - COALESCE(SUM(CASE WHEN tipo_movimiento='salida' AND tipo_salida='plancha_completa' THEN cantidad_planchas ELSE 0 END),0) AS stock
                    FROM movimientos WHERE materia_prima_id = $1 AND ancho = $2 AND alto = $3`,
                    [mpIdFinal, anchoInt, altoInt]);
                const stockDisp = Number(stockRes.rows[0].stock) || 0;
                if (cantidadFinal > stockDisp) {
                    throw errorValidacion('Cantidad excede el stock disponible (' + stockDisp + ' planchas de ' + anchoInt + 'x' + altoInt + ' mm)');
                }
            } else if (tipoSalidaFinal === 'trozo') {
                // Regla del proyecto: el m2 descuenta TODAS las salidas.
                // Un trozo no puede exceder el m2 disponible de la materia prima.
                const m2Res = await q(`
                    SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN metros_cuadrados ELSE 0 END),0)
                         - COALESCE(SUM(CASE WHEN tipo_movimiento='salida' THEN metros_cuadrados ELSE 0 END),0) AS m2
                    FROM movimientos WHERE materia_prima_id = $1`,
                    [mpIdFinal]);
                const m2Disp = Number(m2Res.rows[0].m2) || 0;
                if (metros_cuadrados > m2Disp) {
                    throw errorValidacion('El trozo (' + metros_cuadrados.toFixed(2) + ' m2) excede el stock disponible de la materia prima (' + m2Disp.toFixed(2) + ' m2)');
                }
            }
        }

        const result = await q(
            `INSERT INTO movimientos (usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, turno, tipo_salida, observaciones, fecha_hora)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
            [usuarioFirmante, tipoMovimientoFinal, mpIdFinal, recortar(tipoCristalFinal, 50), espesorNum, anchoInt, altoInt, cantidadFinal, metros_cuadrados.toFixed(4),
             recortar(proveedor, 100) || null, recortar(turno, 10) || null, tipoSalidaFinal, observaciones ? String(observaciones) : null, fechaFinal]
        );
        return result.rows[0];
    });
}

async function eliminarMovimiento(id) {
    const result = await query('DELETE FROM movimientos WHERE id = $1', [id]);
    if (result.rowCount === 0) {
        // err.status = 404 para que la ruta responda 404 en vez de { ok: true }.
        throw errorNoEncontrado('Movimiento no encontrado');
    }
    return true;
}

/**
 * Actualización PARCIAL: solo se modifican los campos presentes en `data`.
 * Antes se reescribían todos los campos aunque no vinieran (un PUT parcial guardaba
 * nulls/ceros sobre datos reales) y `fecha_hora || null` escribía NULL explícito
 * (el movimiento desaparecía de los reportes mensuales).
 * Si el movimiento no existe lanza error con err.status = 404.
 * Valida igual que en creación (tipos, dimensiones y cantidad) y recalcula
 * metros_cuadrados si cambian ancho, alto o cantidad_planchas.
 */
async function editarMovimiento(id, data) {
    const idNum = Number(id);
    if (!Number.isInteger(idNum) || idNum <= 0) throw errorValidacion('id inválido');

    const actual = await query('SELECT * FROM movimientos WHERE id = $1', [idNum]);
    if (actual.rows.length === 0) throw errorNoEncontrado('Movimiento no encontrado');
    const fila = actual.rows[0];

    const campos = data && typeof data === 'object' ? data : {};
    const fields = [];
    const params = [];
    let idx = 1;
    const add = (col, val) => { fields.push(`${col} = $${idx++}`); params.push(val); };

    // Estado combinado (fila actual + cambios) para las validaciones cruzadas y el recálculo.
    let tipoMovimiento = fila.tipo_movimiento;
    let tipoSalida = fila.tipo_salida;
    let ancho = Number(fila.ancho) || 0;
    let alto = Number(fila.alto) || 0;
    let cantidad = Number(fila.cantidad_planchas) || 0;

    if (campos.tipo_movimiento !== undefined) {
        tipoMovimiento = validarTipoMovimiento(campos.tipo_movimiento);
        add('tipo_movimiento', tipoMovimiento);
    }
    if (campos.tipo_salida !== undefined) {
        tipoSalida = normalizarTipoSalidaEditar(campos.tipo_salida);
        add('tipo_salida', tipoSalida);
    }
    if (campos.ancho !== undefined) {
        ancho = parseDimension(campos.ancho, 'Ancho');
        add('ancho', ancho);
    }
    if (campos.alto !== undefined) {
        alto = parseDimension(campos.alto, 'Alto');
        add('alto', alto);
    }
    if (campos.cantidad_planchas !== undefined) {
        cantidad = parseEnteroPositivo(campos.cantidad_planchas, 'cantidad_planchas');
        add('cantidad_planchas', cantidad);
    }
    if (campos.espesor !== undefined) add('espesor', parseEspesor(campos.espesor));
    if (campos.proveedor !== undefined) add('proveedor', recortar(campos.proveedor, 100) || null);
    if (campos.turno !== undefined) add('turno', recortar(campos.turno, 10) || null);
    if (campos.observaciones !== undefined) add('observaciones', campos.observaciones ? String(campos.observaciones) : null);

    // fecha_hora: solo se actualiza si viene con un valor válido. Nunca se escribe NULL
    // explícito para no sacar el movimiento de los reportes mensuales.
    if (campos.fecha_hora !== undefined && campos.fecha_hora !== null && campos.fecha_hora !== '') {
        add('fecha_hora', parseFechaHora(campos.fecha_hora));
    }

    // Recálculo de m² con los valores combinados si cambia alguna dimensión o la cantidad.
    if (campos.ancho !== undefined || campos.alto !== undefined || campos.cantidad_planchas !== undefined) {
        if (!(ancho > 0 && alto > 0 && cantidad > 0)) {
            throw errorValidacion('Ancho, alto y cantidad_planchas deben ser mayores a 0 para recalcular metros cuadrados');
        }
        add('metros_cuadrados', ((ancho * alto * cantidad) / 1000000).toFixed(4));
    }

    // Regla cruzada sobre el estado combinado: las entradas no llevan tipo de salida.
    if (tipoMovimiento === 'entrada' && tipoSalida) {
        throw errorValidacion('Las entradas no deben tener tipo de salida');
    }

    // Sin campos presentes: no se toca la fila (se devuelve tal cual, sin escribir nulls).
    if (fields.length === 0) return fila;

    params.push(idNum);
    // VALIDACIÓN DE STOCK AL EDITAR (misma regla que en creación): si el
    // movimiento resultante es una SALIDA, no puede exceder el stock disponible.
    // El propio movimiento se EXCLUYE del cálculo (se está editando). Todo en
    // transacción con lock sobre la materia prima para serializar ediciones.
    return await transaction(async ({ query: q }) => {
        const mpId = fila.materia_prima_id ? Number(fila.materia_prima_id) : null;
        if (mpId) {
            await q('SELECT id FROM materias_primas WHERE id = $1 FOR UPDATE', [mpId]);
        }
        if (tipoMovimiento === 'salida' && mpId) {
            const nuevoM2 = (ancho * alto * cantidad) / 1000000;
            if (tipoSalida === 'plancha_completa') {
                const stockRes = await q(`
                    SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN cantidad_planchas ELSE 0 END),0)
                         - COALESCE(SUM(CASE WHEN tipo_movimiento='salida' AND tipo_salida='plancha_completa' THEN cantidad_planchas ELSE 0 END),0) AS stock
                    FROM movimientos WHERE materia_prima_id = $1 AND ancho = $2 AND alto = $3 AND id != $4`,
                    [mpId, ancho, alto, idNum]);
                const stockDisp = Number(stockRes.rows[0].stock) || 0;
                if (cantidad > stockDisp) {
                    throw errorValidacion('La cantidad excede el stock disponible (' + stockDisp + ' planchas de ' + ancho + 'x' + alto + ' mm)');
                }
            } else if (tipoSalida === 'trozo') {
                const m2Res = await q(`
                    SELECT COALESCE(SUM(CASE WHEN tipo_movimiento='entrada' THEN metros_cuadrados ELSE 0 END),0)
                         - COALESCE(SUM(CASE WHEN tipo_movimiento='salida' THEN metros_cuadrados ELSE 0 END),0) AS m2
                    FROM movimientos WHERE materia_prima_id = $1 AND id != $2`,
                    [mpId, idNum]);
                const m2Disp = Number(m2Res.rows[0].m2) || 0;
                if (nuevoM2 > m2Disp) {
                    throw errorValidacion('El trozo (' + nuevoM2.toFixed(2) + ' m2) excede el stock disponible de la materia prima (' + m2Disp.toFixed(2) + ' m2)');
                }
            }
        }

        const result = await q(
            `UPDATE movimientos SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
            params
        );
        return result.rows[0] || null;
    });
}

async function limpiarMovimientos() {
    const result = await query('DELETE FROM movimientos');
    return result.rowCount;
}

// ══════════════════════════════════════════════════════════════
// NOTA: Diferencia entre funciones de inventario
// ══════════════════════════════════════════════════════════════
// getInventario()        → Stock REAL por material+dimension. Solo muestra materiales
//                          que tienen movimientos (entradas registradas). Es la vista
//                          principal del módulo "Inventario".
//
// getAnalyticsInventario → Analytics para "Consumo y Autonomía". Muestra TODOS los
//                          materiales con consumo_promedio_mensual > 0, incluyendo
//                          los con stock 0. Usa LEFT JOIN desde materias_primas.
//
// /api/inv/reporte       → Reporte anual. Las alertas usan planchas (no m2) para
//                          calcular autonomía, igual que Consumo y Autonomía.
//                          Fórmula: stock_planchas / consumo_promedio_mensual.
//
// Fórmula de KG:         metros_cuadrados * espesor_mm * 2.5 (NO usar 1.25/1000)
//                        → usar el helper exportado KG_SQL(columnaM2, columnaEspesor)
//                          también en las rutas (routes/catalogosInventario.js).
//
// Autonomía:             helper exportado calcularAutonomia(stock, consumoMensual)
//                        → { meses, dias } con meses = stock / consumoMensual y
//                          dias = meses * 30. Úsese también en las rutas (antes había
//                          fórmulas ×21, ×30, ×4.33 y una que devolvía string).
//
// REGLA DE SALIDAS (decisión del proyecto, unificar m² con kg):
//   - stock de PLANCHAS: descuenta SOLO tipo_salida = 'plancha_completa'.
//   - stock en M² y en kg: descuenta TODAS las salidas (incluye trozos y salidas
//     sin tipo_salida). Es decir, m² y kg usan la misma semántica; las planchas no.
// ══════════════════════════════════════════════════════════════

async function getInventario(filtros = {}) {
    let sql = `SELECT 
        mp.codigo_mp,
        mp.codigo_sap,
        mp.nombre as tipo_cristal,
        mp.espesor_mm as espesor,
        mp.costo_unitario_mp,
        mp.costo_unitario_importado,
        mp.consumo_promedio_mensual,
        m.ancho,
        m.alto,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END), 0) as entradas,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END), 0) as salidas_plancha,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'trozo' THEN m.cantidad_planchas ELSE 0 END), 0) as trozos,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.metros_cuadrados ELSE 0 END), 0) as m2_entradas,
        -- REGLA DE SALIDAS: el stock en M² descuenta TODAS las salidas (incluye trozos),
        -- igual que el kg. El stock en planchas sigue descontando solo 'plancha_completa'.
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' THEN m.metros_cuadrados ELSE 0 END), 0) as m2_salidas
        FROM movimientos m
        LEFT JOIN materias_primas mp ON m.materia_prima_id = mp.id
        WHERE m.ancho IS NOT NULL AND m.alto IS NOT NULL`;
    const conditions = [];
    const params = [];
    let idx = 1;
    if (filtros.cristal) { conditions.push(`mp.nombre ILIKE $${idx}`); params.push('%' + filtros.cristal + '%'); idx++; }
    if (filtros.espesor) { conditions.push(`mp.espesor_mm = $${idx}`); params.push(filtros.espesor); idx++; }
    if (conditions.length > 0) sql += ' AND ' + conditions.join(' AND ');
    sql += ` GROUP BY mp.codigo_mp, mp.codigo_sap, mp.nombre, mp.espesor_mm, mp.costo_unitario_mp, mp.costo_unitario_importado, mp.consumo_promedio_mensual, m.ancho, m.alto
        HAVING COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END), 0) > 0
           OR COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END), 0) > 0
        ORDER BY mp.nombre, mp.espesor_mm, m.ancho, m.alto`;
    const result = await query(sql, params);
    
    // Calcular autonomia por codigo_mp (stock total del codigo / CPM)
    const stockPorCodigo = {};
    result.rows.forEach(r => {
        const cod = r.codigo_mp;
        if (!stockPorCodigo[cod]) stockPorCodigo[cod] = 0;
        stockPorCodigo[cod] += Number(r.entradas) - Number(r.salidas_plancha);
    });
    
    return result.rows.map(r => {
        const stock = Number(r.entradas) - Number(r.salidas_plancha);
        const cpm = Number(r.consumo_promedio_mensual) || 0;
        const stockTotalCodigo = stockPorCodigo[r.codigo_mp] || 0;
        // Autonomía canónica (helper exportado): meses = stock / consumoMensual, dias = meses * 30.
        const autonomia = calcularAutonomia(stockTotalCodigo, cpm);
        return {
            ...r, stock, entradas: Number(r.entradas), salidas_plancha: Number(r.salidas_plancha),
            trozos: Number(r.trozos), m2_entradas: Number(r.m2_entradas), m2_salidas: Number(r.m2_salidas),
            autonomia_meses: Math.round(autonomia.meses * 10) / 10,
            autonomia_dias: Math.round(autonomia.dias)
        };
    });
}

async function getEstadisticas() {
    const [total, entradas, salidas, stock] = await Promise.all([
        query('SELECT COUNT(*) as c FROM movimientos'),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'entrada'"),
        query("SELECT COUNT(*) as c FROM movimientos WHERE tipo_movimiento = 'salida'"),
        // REGLA DE SALIDAS (unificación m² ↔ kg): el stock en M² descuenta TODAS las
        // salidas (incluye trozos), igual que el kg. El stock en planchas se calcula
        // aparte y sigue descontando solo tipo_salida = 'plancha_completa'.
        query(`SELECT COALESCE(SUM(CASE WHEN tipo_movimiento = 'entrada' THEN metros_cuadrados ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN tipo_movimiento = 'salida' THEN metros_cuadrados ELSE 0 END), 0) as stock_m2 FROM movimientos`)
    ]);
    // Obtener tipos de cristal desde materias_primas
    const tiposResult = await query('SELECT DISTINCT nombre FROM materias_primas WHERE nombre IS NOT NULL ORDER BY nombre');
    return {
        totalMovimientos: Number(total.rows[0].c), totalEntradas: Number(entradas.rows[0].c),
        totalSalidas: Number(salidas.rows[0].c), tiposCristal: tiposResult.rows.map(r => r.nombre),
        stockM2: Number(stock.rows[0].stock_m2)
    };
}

async function getStockPorDimension(materiaPrimaId) {
    const result = await query(`
        SELECT m.ancho, m.alto,
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END), 0) as stock,
            ROUND((m.ancho * m.alto) / 1000000.0, 4) as m2_unitario
        FROM movimientos m
        WHERE m.materia_prima_id = $1 AND m.ancho IS NOT NULL AND m.alto IS NOT NULL
        GROUP BY m.ancho, m.alto
        HAVING SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.cantidad_planchas ELSE 0 END) -
               SUM(CASE WHEN m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa' THEN m.cantidad_planchas ELSE 0 END) > 0
        ORDER BY m.ancho, m.alto
    `, [materiaPrimaId]);
    return result.rows.map(r => ({
        ancho: Number(r.ancho), alto: Number(r.alto),
        stock: Number(r.stock), m2_unitario: Number(r.m2_unitario)
    }));
}

async function getEstadisticasPorTipo() {
    // REGLA DE SALIDAS (unificación m² ↔ kg): las salidas en M² suman TODAS las salidas
    // (incluye trozos), igual que el kg. El stock en planchas (getStockPorTipo en
    // catalogos.js) no cambia: sigue descontando solo 'plancha_completa'.
    const result = await query(`SELECT 
        mp.nombre as tipo,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'entrada' THEN m.metros_cuadrados ELSE 0 END), 0) as entradas_m2,
        COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'salida' THEN m.metros_cuadrados ELSE 0 END), 0) as salidas_m2
        FROM materias_primas mp
        LEFT JOIN movimientos m ON m.materia_prima_id = mp.id
        GROUP BY mp.id, mp.nombre ORDER BY mp.nombre`);
    return result.rows.map(r => ({
        tipo: r.tipo, entradas: Number(r.entradas_m2),
        salidas: Number(r.salidas_m2), stock: Number(r.entradas_m2) - Number(r.salidas_m2)
    }));
}

async function getAnalyticsInventario(meses = 6, mesFilter = null) {
    const mesesNum = parseInt(meses) || 6;
    const fechaDesde = new Date();
    fechaDesde.setMonth(fechaDesde.getMonth() - mesesNum);
    const fechaStr = fechaDesde.toISOString().split('T')[0];

    let rankingQuery, rankingParams;
    if (mesFilter) {
        // Validar formato YYYY-MM (antes un mes inválido llegaba crudo a PostgreSQL → 500).
        const [anio, mesNum] = validarMes(mesFilter, 'mes').split('-');
        const fechaMesInicio = anio + '-' + mesNum + '-01';
        const fechaMesFin = new Date(parseInt(anio), parseInt(mesNum), 0).toISOString().split('T')[0];
        rankingQuery = `
            SELECT mp.codigo_mp, mp.nombre, mp.espesor_mm,
                COUNT(*) FILTER (WHERE m.tipo_movimiento = 'salida') as total_salidas,
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as m2_salidos,
                COALESCE(SUM(m.cantidad_planchas) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as planchas_salidas,
                COALESCE(ROUND(SUM(m.metros_cuadrados * mp.espesor_mm * 2.5) FILTER (WHERE m.tipo_movimiento = 'salida'), 0), 0) as kg_salidos
            FROM movimientos m
            JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE m.fecha_hora >= $1 AND m.fecha_hora <= $2
            GROUP BY mp.id, mp.codigo_mp, mp.nombre, mp.espesor_mm
            HAVING SUM(CASE WHEN m.tipo_movimiento = 'salida' THEN m.metros_cuadrados ELSE 0 END) > 0
            ORDER BY m2_salidos DESC`;
        rankingParams = [fechaMesInicio, fechaMesFin + ' 23:59:59'];
    } else {
        rankingQuery = `
            SELECT mp.codigo_mp, mp.nombre, mp.espesor_mm,
                COUNT(*) FILTER (WHERE m.tipo_movimiento = 'salida') as total_salidas,
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as m2_salidos,
                COALESCE(SUM(m.cantidad_planchas) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as planchas_salidas,
                COALESCE(ROUND(SUM(m.metros_cuadrados * mp.espesor_mm * 2.5) FILTER (WHERE m.tipo_movimiento = 'salida'), 0), 0) as kg_salidos
            FROM movimientos m
            JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE m.fecha_hora >= $1
            GROUP BY mp.id, mp.codigo_mp, mp.nombre, mp.espesor_mm
            ORDER BY m2_salidos DESC`;
        rankingParams = [fechaStr];
    }

    const [rankingSalida, consumoMensual, planchasPorMes, stockActual, topDimensiones] = await Promise.all([
        // Ranking de MP con más salidas
        query(rankingQuery, rankingParams),

        // Consumo mensual por material
        query(`
            SELECT mp.codigo_mp, mp.nombre, mp.espesor_mm,
                TO_CHAR(m.fecha_hora, 'YYYY-MM') as mes,
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as m2_consumidos,
                COALESCE(SUM(m.cantidad_planchas) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as planchas_consumidas,
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'entrada'), 0) as m2_entradas
            FROM movimientos m
            JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE m.fecha_hora >= $1
            GROUP BY mp.codigo_mp, mp.nombre, mp.espesor_mm, TO_CHAR(m.fecha_hora, 'YYYY-MM')
            ORDER BY mp.nombre, mes
        `, [fechaStr]),

        // Planchas cortadas por mes (todas las salidas)
        query(`
            SELECT TO_CHAR(m.fecha_hora, 'YYYY-MM') as mes,
                COUNT(*) as total_movimientos,
                COALESCE(SUM(m.cantidad_planchas), 0) as total_planchas,
                COALESCE(SUM(m.metros_cuadrados), 0) as total_m2,
                COALESCE(ROUND(SUM(m.metros_cuadrados * mp.espesor_mm * 2.5), 0), 0) as total_kg
            FROM movimientos m
            JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE m.tipo_movimiento = 'salida' AND m.fecha_hora >= $1
            GROUP BY TO_CHAR(m.fecha_hora, 'YYYY-MM')
            ORDER BY mes
        `, [fechaStr]),

        // Stock actual por material (todos los materiales, incluso sin stock)
        query(`
            SELECT mp.codigo_mp, mp.nombre, mp.espesor_mm, mp.consumo_promedio_mensual,
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'entrada'), 0) as m2_entradas,
                -- REGLA DE SALIDAS: el stock en M² descuenta TODAS las salidas (incluye
                -- trozos), igual que el kg de kg_stock. Las planchas siguen con 'plancha_completa'.
                COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'salida'), 0) as m2_salidas,
                COALESCE(SUM(m.cantidad_planchas) FILTER (WHERE m.tipo_movimiento = 'entrada'), 0) as entradas,
                COALESCE(SUM(m.cantidad_planchas) FILTER (WHERE m.tipo_movimiento = 'salida' AND m.tipo_salida = 'plancha_completa'), 0) as salidas,
                -- kg_stock usa la misma semántica que el kg del reporte: descuenta TODAS las
                -- salidas (incluye trozos), igual que el stock en M². Fórmula canónica: m2 * espesor * 2.5.
                ROUND((COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'entrada'), 0) - COALESCE(SUM(m.metros_cuadrados) FILTER (WHERE m.tipo_movimiento = 'salida'), 0)) * mp.espesor_mm * 2.5, 1) as kg_stock
            FROM materias_primas mp
            LEFT JOIN movimientos m ON m.materia_prima_id = mp.id
            GROUP BY mp.id, mp.codigo_mp, mp.nombre, mp.espesor_mm, mp.consumo_promedio_mensual
            ORDER BY mp.nombre
        `),

        // Top dimensiones más cortadas
        query(`
            SELECT m.ancho, m.alto,
                mp.nombre as tipo_cristal,
                COUNT(*) as veces_cortada,
                COALESCE(SUM(m.cantidad_planchas), 0) as total_planchas,
                COALESCE(SUM(m.metros_cuadrados), 0) as total_m2
            FROM movimientos m
            JOIN materias_primas mp ON m.materia_prima_id = mp.id
            WHERE m.tipo_movimiento = 'salida' AND m.fecha_hora >= $1
            GROUP BY m.ancho, m.alto, mp.nombre
            ORDER BY total_m2 DESC
            LIMIT 10
        `, [fechaStr])
    ]);

    // Calcular autonomía por material (helper canónico: meses = stock / consumoMensual, dias = meses * 30)
    const stockConAutonomia = stockActual.rows.map(r => {
        const stock = Number(r.entradas) - Number(r.salidas);
        const cpm = Number(r.consumo_promedio_mensual) || 0;
        const autonomia = calcularAutonomia(stock, cpm);
        return {
            ...r, stock,
            consumo_promedio: cpm,
            autonomia_meses: Math.round(autonomia.meses * 10) / 10,
            autonomia_dias: Math.round(autonomia.dias)
        };
    });

    return {
        rankingSalida: rankingSalida.rows,
        consumoMensual: consumoMensual.rows,
        planchasPorMes: planchasPorMes.rows,
        stockActual: stockConAutonomia,
        topDimensiones: topDimensiones.rows
    };
}

module.exports = {
    getMovimientos, crearMovimiento, editarMovimiento, eliminarMovimiento, limpiarMovimientos,
    getInventario, getStockPorDimension, getEstadisticas, getEstadisticasPorTipo, getAnalyticsInventario,
    // Helpers canónicos exportados para que las rutas (y otros servicios) no dupliquen fórmulas:
    KG_SQL,           // expresión SQL de kg: m2 * espesor * 2.5
    calcularAutonomia // { meses, dias } con dias = meses * 30
};
