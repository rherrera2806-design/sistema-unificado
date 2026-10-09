// ═════════════════════════════════════════════════════════════════════════════
// VitroFlow · Esquema de base de datos (PostgreSQL vía `pg`)
//
// El esquema se define en código con CREATE TABLE IF NOT EXISTS + ALTERs
// incrementales, pensado para correr tanto contra una base HEREDADA (que ya
// tiene las tablas/columnas) como contra una base nueva.
//
// Reglas de este archivo:
//  * Solo DDL aditivo: nada de DROP TABLE/COLUMN ni TRUNCATE. La base de
//    producción ya existe y arrastra historia.
//  * initDB ejecuta las sentencias agrupadas en FASES transaccionales
//    (ver runFase): 1) creación de tablas, 2) columnas (ALTERs aditivos),
//    3) índices, 4) datos / migraciones de datos / seeds. Una fase se ejecuta
//    completa o se revierte completa (ROLLBACK), nunca queda la base a medias.
//  * Las sentencias "defensivas" pasan por safe(): solo se ignoran errores
//    esperados de idempotencia (columna/tabla/objeto duplicado: SQLSTATE
//    42701 / 42P07 / 42710 / 42P06) y cualquier otro error se registra con
//    console.warn. Nada de `.catch(() => {})` ni `catch(e) {}` silenciosos.
//
// ORDEN DE DEPENDENCIAS entre tablas de producción (ver faseTablas):
//    estaciones_maestras ─┬─> familia_estaciones_base <─ familias_producto
//                         ├─> reglas_procesos_extras
//                         ├─> cola_produccion_pasos <─ produccion_ordenes
//                         └─> mermas ──> (FK mermas desde produccion_ordenes)
//    materias_primas + familias_producto ─> recetas_bom
//    produccion_maquinas ──(ALTER maquina_id)──> cola_produccion_pasos
//
// VOCABULARIO DE ESTADOS (documentado a propósito; NO se agregan constraints
// CHECK sobre columnas con datos existentes porque podrían fallar al validar
// valores históricos — ÚNICA excepción: pedidos.estado, cuyo CHECK se agrega
// en forma CONDICIONAL en faseColumnas, solo después de verificar que NO haya
// valores fuera del vocabulario; si los hay, se omite el CHECK y se deja
// constancia en el log):
//  * produccion_ordenes.estado_programacion: 'PENDIENTE' | 'PROGRAMADO' |
//      'EN PRODUCCIÓN' / 'EN PRODUCCION' | 'COMPLETADA' | 'CERRADO' /
//      'CERRADA' | 'CANCELADA'  (services/planificacion*.js,
//      services/produccionOrdenes.js, middleware/validate.js)
//  * cola_produccion_pasos.estado y produccion_pasos.estado: 'PENDIENTE' |
//      'PAUSADO' | 'TERMINADO' | 'COMPLETADO'  (services/taller.js)
//  * instalaciones.estado / instalaciones_dias.estado: 'PROGRAMADA' |
//      'EN_CAMINO' | 'EN_CURSO' | 'COMPLETADA' | 'CON_NOVEDADES' |
//      'CANCELADA'  (services/instalaciones.js)
//  * pedidos.estado: 'pendiente' | 'aprobado' | 'rechazado'
//      (routes/pedidos.js, middleware/validate.js). Máquina de estados:
//        pendiente → aprobado | rechazado
//        aprobado  → rechazado | pendiente
//        rechazado → pendiente
//      La validación de las transiciones se hace en routes/pedidos.js; este
//      archivo solo documenta el dominio y crea el CHECK pedidos_estado_check
//      cuando los datos existentes lo permiten (ver faseColumnas).
//  * mermas.causa: texto libre definido por el usuario (services/taller.js)
//  * movimientos.tipo_movimiento: 'entrada' | 'salida'
//      (services/inventario.js, middleware/validate.js)
//  * movimientos.tipo_salida (solo aplica a salidas; NULL en entradas):
//      'plancha_completa' | 'trozo'  (web/public/inv-js/modules/movimientos.js,
//      services/inventario.js)
//  * REGLA DE STOCK del inventario: las PLANCHAS descuentan solo las salidas
//      con tipo_salida = 'plancha_completa' (un trozo no consume una plancha
//      entera); los M² y los KG descuentan TODAS las salidas sin importar
//      tipo_salida (services/inventario.js, services/catalogos.js,
//      routes/catalogosInventario.js).
//  * movimientos.espesor / catalogo_tipos_cristal.espesor /
//      catalogo_espesores.valor: DECIMAL(6,2) desde la corrección de este
//      archivo (antes INTEGER no admitía espesores reales como 4.76 o 6.35;
//      ver faseColumnas). materias_primas.espesor_mm siempre fue DECIMAL(6,2).
//
// AUDITORÍA DE PEDIDOS (pedido_historial): las filas de historial NO se
// destruyen junto con su pedido. pedido_id es anulable y su FK es
// ON DELETE SET NULL (ver faseTablas y la migración condicional de
// faseColumnas): al eliminar un pedido, sus filas de historial quedan con
// pedido_id = NULL y conservan el snapshot del pedido en campos_antes /
// campos_despues (routes/pedidos.js registra la fila de 'Eliminación' antes
// del DELETE, justamente para que esa auditoría sobreviva).
// ═════════════════════════════════════════════════════════════════════════════

const { query, pool } = require('./dbPool');
const { hashPassword } = require('./dbAuth');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de ejecución tolerante de DDL
// ─────────────────────────────────────────────────────────────────────────────

// SQLSTATE de errores de idempotencia que es SEGURO ignorar al re-ejecutar DDL
// contra una base que ya tiene las columnas/tablas/objetos:
//   42701 duplicate_column · 42P07 duplicate_table ("relation already exists")
//   42710 duplicate_object · 42P06 duplicate_schema
const CODIGOS_ERROR_IDEMPOTENCIA = new Set(['42701', '42P07', '42710', '42P06']);

function esErrorIdempotencia(e) {
    if (!e) return false;
    if (CODIGOS_ERROR_IDEMPOTENCIA.has(e.code)) return true;
    const msg = String(e.message || '');
    return /already exists/i.test(msg)
        || /duplicate column/i.test(msg)
        || /duplicate object/i.test(msg)
        || /duplicate table/i.test(msg);
}

/**
 * Ejecuta una fase del esquema dentro de una transacción.
 * La función `fn` recibe:
 *   q(sql, params)          sentencia crítica: un error revierte la fase entera.
 *   safe(sql, etiqueta, params)  sentencia tolerante: se ejecuta dentro de un
 *                           SAVEPOINT para no abortar la transacción; solo se
 *                           ignoran errores de idempotencia y el resto se
 *                           registra con console.warn.
 *   client                  conexión (ya en transacción) para bloques que
 *                           necesiten armar sus propios SAVEPOINTs (ver
 *                           runMigrations). No usar fuera de fn.
 * Si algo falla, la fase se revierte COMPLETA y el error real se relanza.
 */
async function runFase(nombre, fn) {
    const client = await pool.connect();
    const q = (text, params = []) => client.query(text, params);
    let contadorSavepoints = 0;
    const safe = async (sql, etiqueta = '', params = []) => {
        const punto = `ddl_safe_${++contadorSavepoints}`;
        await client.query(`SAVEPOINT ${punto}`);
        try {
            const resultado = await client.query(sql, params);
            await client.query(`RELEASE SAVEPOINT ${punto}`);
            return resultado;
        } catch (e) {
            await client.query(`ROLLBACK TO SAVEPOINT ${punto}`);
            await client.query(`RELEASE SAVEPOINT ${punto}`);
            if (esErrorIdempotencia(e)) return null;
            console.warn(`[DB] Sentencia omitida (fase "${nombre}"${etiqueta ? ' · ' + etiqueta : ''}): ${e.message}`);
            return null;
        }
    };
    try {
        await client.query('BEGIN');
        await fn({ q, safe, client });
        await client.query('COMMIT');
    } catch (e) {
        try { await client.query('ROLLBACK'); } catch (eRollback) { /* conexión ya caída */ }
        console.error(`[DB] Fase "${nombre}" revertida completa: ${e.message}`);
        throw e;
    } finally {
        client.release();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// initDB: orquesta las fases y luego migraciones históricas / seeds
// ─────────────────────────────────────────────────────────────────────────────
async function initDB() {
    await runFase('creacion-tablas', faseTablas);
    await runFase('columnas', faseColumnas);
    await runFase('indices', faseIndices);
    await runFase('datos-y-seeds', faseDatos);

    const mtCount = await query('SELECT COUNT(*) as c FROM machine_types');
    if (Number(mtCount.rows[0].c) === 0) await seedSigma();
    await runMigrations();
    await resetSequences();
    await seedBusinessData();
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 1 · Creación de tablas
// El orden respeta las dependencias: cada CREATE ocurre DESPUÉS de las tablas
// a las que hace referencia (antes mermas se creaba antes que
// produccion_ordenes / cola_produccion_pasos / estaciones_maestras y en una
// base nueva fallaba con "relation does not exist").
// ─────────────────────────────────────────────────────────────────────────────
async function faseTablas({ q }) {
    await q(`CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'usuario',
        permisos TEXT[] DEFAULT '{}',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // espesor: DECIMAL(6,2) para admitir espesores reales (4.76, 6.35 mm);
    // era INTEGER. Ver conversión de bases existentes en faseColumnas.
    await q(`CREATE TABLE IF NOT EXISTS catalogo_tipos_cristal (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        espesor DECIMAL(6,2) NOT NULL DEFAULT 0,
        codigo_sap VARCHAR(50) DEFAULT '',
        stock_critico INTEGER DEFAULT 0,
        consumo_mensual_aprox INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // valor: DECIMAL(6,2) (coherente con movimientos.espesor /
    // catalogo_tipos_cristal.espesor; era INTEGER).
    await q(`CREATE TABLE IF NOT EXISTS catalogo_espesores (
        id SERIAL PRIMARY KEY,
        valor DECIMAL(6,2) UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await q(`CREATE TABLE IF NOT EXISTS machine_types (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL)`);
    await q(`CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY, codigo TEXT, nombre TEXT NOT NULL,
        tipo_id INTEGER, marca TEXT, modelo TEXT, numero_serie TEXT,
        ubicacion TEXT, fecha_compra TEXT, estado_operativo TEXT DEFAULT 'Operativo',
        observaciones TEXT
    )`);
    await q(`CREATE TABLE IF NOT EXISTS components (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT)`);
    await q(`CREATE TABLE IF NOT EXISTS component_type_links (id SERIAL PRIMARY KEY, tipo_id INTEGER, componente_id INTEGER)`);
    await q(`CREATE TABLE IF NOT EXISTS preventive_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        frecuencia_diaria INTEGER DEFAULT 0, frecuencia_semanal INTEGER DEFAULT 0,
        frecuencia_mensual INTEGER DEFAULT 0, frecuencia_trimestral INTEGER DEFAULT 0,
        frecuencia_semestral INTEGER DEFAULT 0, frecuencia_anual INTEGER DEFAULT 0,
        fecha_programada TEXT, fecha_ejecutada TEXT, tecnico TEXT DEFAULT 'Pendiente',
        estado TEXT DEFAULT 'Programada', observaciones TEXT
    )`);
    await q(`CREATE TABLE IF NOT EXISTS corrective_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        fecha_falla TEXT, descripcion_falla TEXT, diagnostico TEXT,
        accion_correctiva TEXT, repuestos_utilizados TEXT,
        horas_detencion REAL, responsable TEXT
    )`);
    await q(`CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY, codigo TEXT, descripcion TEXT,
        componente_id INTEGER, stock_actual INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0, proveedor TEXT, ubicacion_bodega TEXT
    )`);
    await q(`CREATE TABLE IF NOT EXISTS machine_components (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        UNIQUE(maquina_id, componente_id)
    )`);
    await q(`CREATE TABLE IF NOT EXISTS proveedores (
        id SERIAL PRIMARY KEY, nombre VARCHAR(200) NOT NULL, rut VARCHAR(20),
        telefono VARCHAR(30), email VARCHAR(150), direccion TEXT,
        persona_contacto VARCHAR(150), especialidad TEXT, observaciones TEXT,
        estado VARCHAR(20) DEFAULT 'Activo', fecha_registro DATE DEFAULT CURRENT_DATE
    )`);
    await q(`CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY, tecnico TEXT, nota TEXT, fecha TEXT, hora TEXT
    )`);
    await q(`CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL, numero INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'espera', fecha DATE DEFAULT CURRENT_DATE,
        hora_creacion TIME DEFAULT CURRENT_TIME, hora_llamada TIME, hora_fin TIME
    )`);
    await q(`CREATE TABLE IF NOT EXISTS entregas (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id),
        cliente_nombre VARCHAR(100) NOT NULL, descripcion TEXT, pedidos TEXT,
        factura VARCHAR(50), tipo VARCHAR(30) DEFAULT 'Retira',
        estado VARCHAR(20) DEFAULT 'pendiente', fecha DATE DEFAULT CURRENT_DATE,
        hora_registrada TIME DEFAULT CURRENT_TIME, hora_entregada TIME
    )`);
    await q(`CREATE TABLE IF NOT EXISTS turnos_adjuntos (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL, archivo BYTEA, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS turnos_estados_log (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id) ON DELETE CASCADE,
        entrega_id INTEGER, estado VARCHAR(30) NOT NULL,
        fecha_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP, fecha_salida TIMESTAMP,
        duracion_segundos INTEGER, usuario VARCHAR(200) DEFAULT ''
    )`);
    await q(`CREATE TABLE IF NOT EXISTS tecnicos_almacen (
        id SERIAL PRIMARY KEY, nombre VARCHAR(200) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await q(`CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id),
        tipo_movimiento VARCHAR(20) NOT NULL, tipo_cristal VARCHAR(50) NOT NULL,
        espesor DECIMAL(6,2) NOT NULL, ancho INTEGER NOT NULL, alto INTEGER NOT NULL,
        cantidad_planchas INTEGER NOT NULL, metros_cuadrados DECIMAL(10,4) NOT NULL,
        proveedor VARCHAR(100), tipo_salida VARCHAR(20), observaciones TEXT,
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // pedidos: numero_pedido es UNIQUE en la definición (base fresca nace con
    // el UNIQUE). En una base EXISTENTE que ya tiene la tabla sin UNIQUE, este
    // CREATE es no-op y el índice único se crea en faseIndices de forma
    // CONDICIONAL (solo si no hay numero_pedido duplicados) — ver ese bloque.
    await q(`CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY, numero_pedido TEXT NOT NULL UNIQUE, cliente TEXT NOT NULL,
        vendedor TEXT NOT NULL, archivo_url TEXT, archivo_pdf BYTEA,
        estado TEXT NOT NULL DEFAULT 'pendiente', motivo_rechazo TEXT,
        fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_revision TIMESTAMP, revisado_por TEXT
    )`);
    // pedido_historial: pedido_id ANULABLE + ON DELETE SET NULL (antes NOT NULL
    // + ON DELETE CASCADE, lo que borraba la auditoría junto con el pedido).
    // La fila de historial sobrevive a la eliminación del pedido y conserva su
    // snapshot en campos_antes / campos_despues. En bases existentes la FK se
    // recrea en faseColumnas (bloque DO condicional sobre pg_constraint).
    await q(`CREATE TABLE IF NOT EXISTS pedido_historial (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER REFERENCES pedidos(id) ON DELETE SET NULL,
        accion VARCHAR(100) NOT NULL,
        campos_antes JSONB,
        campos_despues JSONB,
        usuario VARCHAR(200) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── Producción: sin dependencias ──────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS estaciones_maestras (
        id SERIAL PRIMARY KEY, nombre_estacion VARCHAR(50) UNIQUE NOT NULL,
        orden_secuencia_defecto INTEGER UNIQUE NOT NULL,
        activa BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS familias_producto (
        id SERIAL PRIMARY KEY, codigo_familia VARCHAR(30) UNIQUE NOT NULL,
        nombre_familia VARCHAR(100) NOT NULL, costo_hh DECIMAL(12,2) DEFAULT 0,
        costo_energia DECIMAL(12,2) DEFAULT 0, activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS materias_primas (
        id SERIAL PRIMARY KEY, codigo_mp VARCHAR(30) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL, espesor_mm DECIMAL(6,2) DEFAULT 0,
        costo_unitario_mp DECIMAL(12,2) DEFAULT 0, observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // produccion_maquinas se crea sin FK; su columna estacion_id (FK a
    // estaciones_maestras) se agrega en faseColumnas, ya con la tabla creada.
    await q(`CREATE TABLE IF NOT EXISTS produccion_maquinas (
        id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(20) UNIQUE NOT NULL, estado VARCHAR(20) DEFAULT 'ACTIVA',
        capacidad_max_m2_dia DECIMAL(8,2) DEFAULT 0, tipo_proceso VARCHAR(50),
        num_operacion INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS produccion_recetas_bom (
        id SERIAL PRIMARY KEY, codigo_sap_padre VARCHAR(30) NOT NULL,
        codigo_materia_prima VARCHAR(30) NOT NULL, descripcion TEXT,
        espesor INTEGER, cantidad INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS tecnicos (
        id SERIAL PRIMARY KEY, nombre VARCHAR(150) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS vendedores (
        id SERIAL PRIMARY KEY, nombre VARCHAR(150) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── Producción: dependen de estaciones_maestras / familias_producto ──────
    await q(`CREATE TABLE IF NOT EXISTS familia_estaciones_base (
        id SERIAL PRIMARY KEY,
        familia_id INTEGER NOT NULL REFERENCES familias_producto(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        UNIQUE(familia_id, estacion_id)
    )`);
    await q(`CREATE TABLE IF NOT EXISTS recetas_bom (
        id SERIAL PRIMARY KEY, codigo_sap_padre VARCHAR(30) NOT NULL,
        materia_prima_id INTEGER NOT NULL REFERENCES materias_primas(id) ON DELETE CASCADE,
        familia_id INTEGER REFERENCES familias_producto(id) ON DELETE SET NULL,
        cantidad DECIMAL(10,4) DEFAULT 1,
        procesos_especificos_json JSONB DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS reglas_procesos_extras (
        id SERIAL PRIMARY KEY, nombre_flag VARCHAR(50) UNIQUE NOT NULL,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        activa BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── Producción: dependen de produccion_ordenes ───────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS produccion_ordenes (
        id SERIAL PRIMARY KEY, pedido_sap_id VARCHAR(30), cliente TEXT,
        codigo_producto VARCHAR(30) NOT NULL, descripcion TEXT,
        ancho INTEGER NOT NULL, alto INTEGER NOT NULL,
        metros_cuadrados DECIMAL(10,4), es_compuesto BOOLEAN DEFAULT FALSE,
        bom_padre_id INTEGER, fecha_ingreso_sap TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega_pactada DATE, estado_programacion VARCHAR(20) DEFAULT 'PENDIENTE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_nombre VARCHAR(50) NOT NULL, orden_secuencia INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'PENDIENTE', hora_inicio TIMESTAMP,
        hora_fin TIMESTAMP, operario_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS produccion_codigos (
        id SERIAL PRIMARY KEY, codigo VARCHAR(30) UNIQUE NOT NULL,
        descripcion TEXT, grupo VARCHAR(100), familia VARCHAR(100),
        bloqueo_tela BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS cola_produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id),
        orden_secuencia INTEGER NOT NULL, estado VARCHAR(20) DEFAULT 'PENDIENTE',
        hora_inicio TIMESTAMP, hora_fin TIMESTAMP, operario_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    // mermas referencia produccion_ordenes, cola_produccion_pasos y
    // estaciones_maestras: se crea DESPUÉS que las tres (antes estaba antes y
    // en una base nueva fallaba con "relation does not exist").
    await q(`CREATE TABLE IF NOT EXISTS mermas (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        paso_id INTEGER REFERENCES cola_produccion_pasos(id) ON DELETE SET NULL,
        estacion_id INTEGER REFERENCES estaciones_maestras(id),
        causa VARCHAR(100) NOT NULL, cantidad INTEGER DEFAULT 1,
        observacion TEXT DEFAULT '', m2_mermados DECIMAL(10,4) DEFAULT 0,
        costo_materia_prima DECIMAL(12,2) DEFAULT 0,
        creado_por VARCHAR(200) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS produccion_capacidad_grupo (
        id SERIAL PRIMARY KEY, grupo VARCHAR(100) UNIQUE NOT NULL,
        capacidad_kg_dia DECIMAL(10,2) DEFAULT 0, activo BOOLEAN DEFAULT TRUE,
        color VARCHAR(20) DEFAULT '#3b82f6', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS prod_notas (
        id SERIAL PRIMARY KEY, usuario_email VARCHAR(255) NOT NULL,
        nota TEXT NOT NULL, estado VARCHAR(20) DEFAULT 'pendiente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_completado TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // ── Calendario e instalaciones ───────────────────────────────────────────
    await q(`CREATE TABLE IF NOT EXISTS calendario_produccion (
        id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL,
        es_laboral BOOLEAN DEFAULT TRUE, motivo TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS instalaciones (
        id SERIAL PRIMARY KEY, cliente VARCHAR(200) NOT NULL, direccion TEXT NOT NULL,
        descripcion TEXT DEFAULT '', fecha_programada DATE NOT NULL,
        hora_programada TIME DEFAULT '09:00', tecnico VARCHAR(200) DEFAULT '',
        estado VARCHAR(30) DEFAULT 'PROGRAMADA', notas_previas TEXT DEFAULT '',
        notas_cierre TEXT DEFAULT '', firma_cliente TEXT DEFAULT '',
        creado_por VARCHAR(200) DEFAULT '', cerrado_por VARCHAR(200) DEFAULT '',
        fecha_cierre TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS instalaciones_historial (
        id SERIAL PRIMARY KEY,
        instalacion_id INTEGER REFERENCES instalaciones(id) ON DELETE CASCADE,
        accion VARCHAR(100) NOT NULL, detalle TEXT DEFAULT '',
        usuario VARCHAR(200) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS instalaciones_fotos (
        id SERIAL PRIMARY KEY,
        instalacion_id INTEGER REFERENCES instalaciones(id) ON DELETE CASCADE,
        foto BYTEA, descripcion TEXT DEFAULT '', orden INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await q(`CREATE TABLE IF NOT EXISTS instalaciones_dias (
        id SERIAL PRIMARY KEY,
        instalacion_id INTEGER REFERENCES instalaciones(id) ON DELETE CASCADE,
        fecha DATE NOT NULL,
        dia_numero INTEGER NOT NULL,
        estado VARCHAR(30) DEFAULT 'PROGRAMADA',
        notas TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 2 · Columnas (ALTERs aditivos / IF NOT EXISTS)
// Todos los ALTER ocurren DESPUÉS de la creación de su tabla y de las tablas
// referenciadas por sus FK (antes varios corrían antes que sus tablas).
// ─────────────────────────────────────────────────────────────────────────────
async function faseColumnas({ q, safe }) {
    // ── usuarios ─────────────────────────────────────────────────────────────
    await safe(`DO $$ BEGIN ALTER TABLE usuarios ADD COLUMN permisos TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN null; END $$`, 'usuarios.permisos');
    await safe(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_plain TEXT DEFAULT ''`, 'usuarios.password_plain');
    await safe(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area TEXT DEFAULT ''`, 'usuarios.area');

    // ── catalogo_tipos_cristal ───────────────────────────────────────────────
    await safe(`ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0`, 'catalogo_tipos_cristal.stock_critico');
    await safe(`ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0`, 'catalogo_tipos_cristal.consumo_mensual_aprox');
    await safe(`ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS espesor DECIMAL(6,2) DEFAULT 0`, 'catalogo_tipos_cristal.espesor');
    await safe(`ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS codigo_sap VARCHAR(50) DEFAULT ''`, 'catalogo_tipos_cristal.codigo_sap');
    await safe(`ALTER TABLE catalogo_tipos_cristal ALTER COLUMN consumo_mensual_aprox TYPE INTEGER USING consumo_mensual_aprox::INTEGER`, 'catalogo_tipos_cristal.consumo_mensual_aprox tipo');
    // Estas dos restricciones UNIQUE se reemplazan por el índice parcial
    // idx_tipos_cristal_nombre_espesor (ver faseIndices). DROP CONSTRAINT IF
    // EXISTS es idempotente y es de los únicos DROP que conserva este archivo
    // (el otro es la recreación de la FK de pedido_historial más abajo, también
    // condicional e idempotente). DROP TABLE/COLUMN y TRUNCATE siguen vetados.
    // (Antes había una tercera sentencia con dos nombres en una sola acción,
    //  `DROP CONSTRAINT IF EXISTS a, b`, que es un syntax error y generaba un
    //  warn permanente en cada arranque: era redundante con las dos anteriores
    //  y se eliminó.)
    await safe(`ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_key`, 'catalogo_tipos_cristal drop unique');
    await safe(`ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_espesor_key`, 'catalogo_tipos_cristal drop unique');

    // ── espesores: INTEGER → DECIMAL(6,2) ───────────────────────────────────
    // Las columnas de espesor nacieron como INTEGER y no admiten espesores
    // reales del rubro (4.76, 6.35 mm). La conversión es SEGURA en la base
    // existente: los valores enteros se preservan exactamente (entero → decimal
    // es inyectivo, no se pierde ni redondea nada) y el USING es explícito.
    // El DO $$ solo ejecuta el ALTER si la columna sigue siendo 'integer', así
    // en una base fresca (que ya nace con DECIMAL(6,2)) y en cada arranque
    // posterior no se repite el rewrite de la tabla. Sin DROP, solo conversión
    // de tipo. Ver documentación de vocabulario en la cabecera del archivo.
    await safe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='movimientos' AND column_name='espesor' AND data_type='integer') THEN
            ALTER TABLE movimientos ALTER COLUMN espesor TYPE DECIMAL(6,2) USING espesor::DECIMAL(6,2);
        END IF;
    END $$`, 'movimientos.espesor tipo integer->decimal');
    await safe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogo_tipos_cristal' AND column_name='espesor' AND data_type='integer') THEN
            ALTER TABLE catalogo_tipos_cristal ALTER COLUMN espesor TYPE DECIMAL(6,2) USING espesor::DECIMAL(6,2);
        END IF;
    END $$`, 'catalogo_tipos_cristal.espesor tipo integer->decimal');
    await safe(`DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='catalogo_espesores' AND column_name='valor' AND data_type='integer') THEN
            ALTER TABLE catalogo_espesores ALTER COLUMN valor TYPE DECIMAL(6,2) USING valor::DECIMAL(6,2);
        END IF;
    END $$`, 'catalogo_espesores.valor tipo integer->decimal');

    // ── mantención ───────────────────────────────────────────────────────────
    await safe(`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0`, 'preventive_maintenance.horas_ocupadas');
    await safe(`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS checklist TEXT`, 'preventive_maintenance.checklist');
    await safe(`ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'`, 'preventive_maintenance.turno');
    await safe(`ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0`, 'corrective_maintenance.horas_ocupadas');
    await safe(`ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'En Mantención'`, 'corrective_maintenance.estado');
    await safe(`ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS fecha_reparacion TEXT`, 'corrective_maintenance.fecha_reparacion');
    await safe(`ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'`, 'corrective_maintenance.turno');
    await safe(`ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS imagenes TEXT`, 'corrective_maintenance.imagenes');

    await safe(`ALTER TABLE notas ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT FALSE`, 'notas.leido');

    // ── turnos / entregas ────────────────────────────────────────────────────
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='rut') THEN ALTER TABLE turnos ADD COLUMN rut VARCHAR(20) DEFAULT ''; END IF; END $$`, 'turnos.rut');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='patente') THEN ALTER TABLE turnos ADD COLUMN patente VARCHAR(10) DEFAULT ''; END IF; END $$`, 'turnos.patente');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='motivo') THEN ALTER TABLE turnos ADD COLUMN motivo VARCHAR(20) DEFAULT 'Retirar'; END IF; END $$`, 'turnos.motivo');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='rut_empresa') THEN ALTER TABLE turnos ADD COLUMN rut_empresa VARCHAR(20) DEFAULT ''; END IF; END $$`, 'turnos.rut_empresa');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='tecnico_almacen_id') THEN ALTER TABLE entregas ADD COLUMN tecnico_almacen_id INTEGER; END IF; END $$`, 'entregas.tecnico_almacen_id');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='observaciones_almacen') THEN ALTER TABLE entregas ADD COLUMN observaciones_almacen TEXT DEFAULT ''; END IF; END $$`, 'entregas.observaciones_almacen');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='numero_factura') THEN ALTER TABLE entregas ADD COLUMN numero_factura VARCHAR(50) DEFAULT ''; END IF; END $$`, 'entregas.numero_factura');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='monto_factura') THEN ALTER TABLE entregas ADD COLUMN monto_factura DECIMAL(12,2) DEFAULT 0; END IF; END $$`, 'entregas.monto_factura');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_verificada') THEN ALTER TABLE entregas ADD COLUMN hora_verificada TIME; END IF; END $$`, 'entregas.hora_verificada');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_cargada') THEN ALTER TABLE entregas ADD COLUMN hora_cargada TIME; END IF; END $$`, 'entregas.hora_cargada');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_facturada') THEN ALTER TABLE entregas ADD COLUMN hora_facturada TIME; END IF; END $$`, 'entregas.hora_facturada');

    // ── pedidos ──────────────────────────────────────────────────────────────
    await safe(`ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_ov VARCHAR(30) DEFAULT 'Normal'`, 'pedidos.tipo_ov');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='archivo_pdf') THEN ALTER TABLE pedidos ADD COLUMN archivo_pdf BYTEA; END IF; END $$`, 'pedidos.archivo_pdf');

    // pedidos.estado: DEFAULT + NOT NULL seguros para base existente.
    // El UPDATE es ACOTADO (solo filas con estado IS NULL) e idempotente: la
    // segunda corrida no encuentra filas y no toca nada. Va ANTES del
    // SET NOT NULL y en la misma fase para que el ALTER no falle con datos
    // heredados. (En base fresca la columna ya nace NOT NULL DEFAULT
    // 'pendiente' en faseTablas; estos tres sentencias son no-op.)
    await safe(`ALTER TABLE pedidos ALTER COLUMN estado SET DEFAULT 'pendiente'`, 'pedidos.estado default');
    await safe(`UPDATE pedidos SET estado = 'pendiente' WHERE estado IS NULL`, 'pedidos.estado backfill NULL');
    await safe(`ALTER TABLE pedidos ALTER COLUMN estado SET NOT NULL`, 'pedidos.estado not null');
    // CHECK de dominio SOLO si los datos existentes respetan el vocabulario
    // ('pendiente' | 'aprobado' | 'rechazado', ver cabecera). Se verifican los
    // valores ANTES de crearlo: si hay valores fuera del conjunto (o vacíos),
    // NO se agrega el CHECK y se deja constancia en el log — el arranque nunca
    // se rompe por datos históricos. Idempotente: el bloque DO solo crea la
    // constraint si no existe.
    const estadosPedidos = await q(`SELECT DISTINCT estado FROM pedidos WHERE estado IS NOT NULL`);
    const fueraDeVocabulario = estadosPedidos.rows
        .map((fila) => fila.estado)
        .filter((valor) => !['pendiente', 'aprobado', 'rechazado'].includes(valor));
    if (fueraDeVocabulario.length === 0) {
        await safe(`DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'pedidos_estado_check' AND conrelid = 'pedidos'::regclass
            ) THEN
                ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check
                    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado'));
            END IF;
        END $$`, 'pedidos.estado check');
    } else {
        console.warn(`[DB] pedidos.estado tiene ${fueraDeVocabulario.length} valor(es) fuera del vocabulario (${fueraDeVocabulario.join(', ')}); se OMITE el CHECK pedidos_estado_check hasta normalizar esos datos.`);
    }

    // pedido_historial: la FK debe ser ON DELETE SET NULL (antes CASCADE, que
    // destruía la auditoría al borrar el pedido) y pedido_id debe aceptar NULL
    // para que la fila de historial sobreviva con el snapshot en
    // campos_antes / campos_despues. El bloque DO es CONDICIONAL e idempotente:
    //  * busca la FK actual en pg_constraint por identidad de tablas (el nombre
    //    autogenerado típico es pedido_historial_pedido_id_fkey, pero no se
    //    depende del nombre);
    //  * si no existe FK, la crea directo con ON DELETE SET NULL;
    //  * si existe pero su ON DELETE no es SET NULL ('n'; 'c' es el CASCADE
    //    heredado), la elimina y la recrea con SET NULL conservando su nombre
    //    (ON DELETE no es modificable in place). DROP CONSTRAINT + ADD
    //    CONSTRAINT idempotente: en corridas posteriores ya es 'n' y no hace
    //    nada;
    //  * por último quita el NOT NULL de pedido_id (condicional sobre
    //    information_schema; no falla si ya es anulable).
    await safe(`DO $$
    DECLARE
        v_conname TEXT;
        v_deltype TEXT;
    BEGIN
        SELECT con.conname, con.confdeltype::text
          INTO v_conname, v_deltype
        FROM pg_constraint con
        WHERE con.conrelid = 'pedido_historial'::regclass
          AND con.confrelid = 'pedidos'::regclass
          AND con.contype = 'f'
        LIMIT 1;

        IF v_conname IS NULL THEN
            ALTER TABLE pedido_historial
                ADD CONSTRAINT pedido_historial_pedido_id_fkey
                FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL;
        ELSIF v_deltype <> 'n' THEN
            EXECUTE format('ALTER TABLE pedido_historial DROP CONSTRAINT %I', v_conname);
            EXECUTE format('ALTER TABLE pedido_historial ADD CONSTRAINT %I FOREIGN KEY (pedido_id) REFERENCES pedidos(id) ON DELETE SET NULL', v_conname);
        END IF;

        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = current_schema()
              AND table_name = 'pedido_historial'
              AND column_name = 'pedido_id'
              AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE pedido_historial ALTER COLUMN pedido_id DROP NOT NULL;
        END IF;
    END $$`, 'pedido_historial FK ON DELETE SET NULL + pedido_id anulable');

    // ── produccion_maquinas / cola_produccion_pasos ──────────────────────────
    await safe(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS tipo_proceso VARCHAR(50)`, 'produccion_maquinas.tipo_proceso');
    await safe(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS num_operacion INTEGER`, 'produccion_maquinas.num_operacion');
    // FK a estaciones_maestras: por eso esta fase corre después de faseTablas.
    await safe(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS estacion_id INTEGER REFERENCES estaciones_maestras(id)`, 'produccion_maquinas.estacion_id');
    // FK a produccion_maquinas: por eso va después de crear produccion_maquinas.
    await safe(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS maquina_id INTEGER REFERENCES produccion_maquinas(id)`, 'cola_produccion_pasos.maquina_id');
    await safe(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS fecha_programada DATE`, 'cola_produccion_pasos.fecha_programada');
    await safe(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS m2_asignados DECIMAL(10,2) DEFAULT 0`, 'cola_produccion_pasos.m2_asignados');
    // Antes: DO $$ ... ALTER COLUMN estado SET DEFAULT 'PENDIENTE' condicionado
    // a que la columna NO existiera (no-op, porque el CREATE ya la define).
    await safe(`ALTER TABLE cola_produccion_pasos ALTER COLUMN estado SET DEFAULT 'PENDIENTE'`, 'cola_produccion_pasos.estado default');

    // ── produccion_ordenes ───────────────────────────────────────────────────
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(30) DEFAULT 'Normal'`, 'produccion_ordenes.tipo_venta');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS pintado BOOLEAN DEFAULT FALSE`, 'produccion_ordenes.pintado');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS perforaciones INTEGER DEFAULT 0`, 'produccion_ordenes.perforaciones');
    // item_numero se creó originalmente SIN DEFAULT; ver más abajo el SET DEFAULT.
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER`, 'produccion_ordenes.item_numero');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cerrado_nota TEXT`, 'produccion_ordenes.cerrado_nota');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`, 'produccion_ordenes.cantidad');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_ordenes' AND column_name='es_reposicion') THEN ALTER TABLE produccion_ordenes ADD COLUMN es_reposicion BOOLEAN DEFAULT FALSE; END IF; END $$`, 'produccion_ordenes.es_reposicion');
    // FK circular con mermas: mermas ya fue creada en faseTablas, así que esta
    // columna puede referenciarla (antes el ALTER corría antes que mermas).
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_ordenes' AND column_name='merma_original_id') THEN ALTER TABLE produccion_ordenes ADD COLUMN merma_original_id INTEGER REFERENCES mermas(id); END IF; END $$`, 'produccion_ordenes.merma_original_id');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id)`, 'produccion_ordenes.familia_id');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_hh DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.costo_hh');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_energia DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.costo_energia');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_materia_prima DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.costo_materia_prima');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_total_estimado DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.costo_total_estimado');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS precio_unitario_sap DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.precio_unitario_sap');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS margen_estimado DECIMAL(12,2) DEFAULT 0`, 'produccion_ordenes.margen_estimado');
    // NOTA: tipo_venta se declara dos veces (VARCHAR(30) arriba y VARCHAR(50)
    // aquí). ADD COLUMN IF NOT EXISTS es no-op si ya existe, por lo que el
    // primer ancho es el que queda en bases ya creadas; se conserva la línea
    // por compatibilidad con bases creadas con la segunda variante.
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(50) DEFAULT 'Normal'`, 'produccion_ordenes.tipo_venta (variante VARCHAR(50))');
    // No-op si la columna ya existe (fue creada arriba sin DEFAULT); el
    // DEFAULT efectivo se fija con el ALTER COLUMN ... SET DEFAULT de más abajo.
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER DEFAULT 1`, 'produccion_ordenes.item_numero (variante DEFAULT 1)');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`, 'produccion_ordenes.cantidad (variante DEFAULT 1)');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS codigo_padre VARCHAR(30)`, 'produccion_ordenes.codigo_padre');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS nota TEXT`, 'produccion_ordenes.nota');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS posicion VARCHAR(100)`, 'produccion_ordenes.posicion');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS orden_compra VARCHAR(50)`, 'produccion_ordenes.orden_compra');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_entrega VARCHAR(20) DEFAULT 'Despacho'`, 'produccion_ordenes.tipo_entrega');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS kilos DECIMAL(10,2) DEFAULT 0`, 'produccion_ordenes.kilos');
    // Columna que INSERTA services/produccionBomExplosion.js y que el esquema
    // nunca creaba (fallaba el INSERT en bases nuevas).
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS reglas_extras_json JSONB`, 'produccion_ordenes.reglas_extras_json');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS grupo VARCHAR(100)`, 'produccion_ordenes.grupo');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS fecha_programada DATE`, 'produccion_ordenes.fecha_programada');
    await safe(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS espesor_mm NUMERIC(5,2) DEFAULT 6`, 'produccion_ordenes.espesor_mm');
    await safe(`ALTER TABLE produccion_ordenes ALTER COLUMN espesor_mm TYPE NUMERIC(5,2) USING espesor_mm::NUMERIC`, 'produccion_ordenes.espesor_mm tipo');
    // item_numero se usaba sin DEFAULT: cualquier INSERT sin la columna
    // dejaba NULL. El "re-agregar" con DEFAULT 1 era no-op si la columna ya
    // existía, por eso se fija el DEFAULT explícitamente.
    await safe(`ALTER TABLE produccion_ordenes ALTER COLUMN item_numero SET DEFAULT 1`, 'produccion_ordenes.item_numero default');

    // ── estaciones_maestras ──────────────────────────────────────────────────
    await safe(`ALTER TABLE estaciones_maestras ADD COLUMN IF NOT EXISTS cap_max DECIMAL(10,2) DEFAULT 100`, 'estaciones_maestras.cap_max');
    await safe(`ALTER TABLE estaciones_maestras ADD COLUMN IF NOT EXISTS cuello_botella BOOLEAN DEFAULT FALSE`, 'estaciones_maestras.cuello_botella');

    // ── recetas_bom / materias_primas ────────────────────────────────────────
    await safe(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id) ON DELETE SET NULL`, 'recetas_bom.familia_id');
    await safe(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS procesos_especificos_json JSONB DEFAULT NULL`, 'recetas_bom.procesos_especificos_json');
    await safe(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL`, 'recetas_bom.ancho');
    await safe(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL`, 'recetas_bom.alto');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS costo_unitario_importado DECIMAL(12,2) DEFAULT 0`, 'materias_primas.costo_unitario_importado');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS hojas_por_paquete_nal INTEGER DEFAULT 0`, 'materias_primas.hojas_por_paquete_nal');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS ancho_nal DECIMAL(10,2) DEFAULT 0`, 'materias_primas.ancho_nal');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS alto_nal DECIMAL(10,2) DEFAULT 0`, 'materias_primas.alto_nal');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS paquetes_por_camion INTEGER DEFAULT 0`, 'materias_primas.paquetes_por_camion');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS hojas_por_paquete_imp INTEGER DEFAULT 0`, 'materias_primas.hojas_por_paquete_imp');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS ancho_imp DECIMAL(10,2) DEFAULT 0`, 'materias_primas.ancho_imp');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS alto_imp DECIMAL(10,2) DEFAULT 0`, 'materias_primas.alto_imp');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS paquetes_por_contenedor INTEGER DEFAULT 0`, 'materias_primas.paquetes_por_contenedor');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS consumo_promedio_mensual INTEGER DEFAULT 0`, 'materias_primas.consumo_promedio_mensual');
    await safe(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS mpa NUMERIC(5,2) DEFAULT 0`, 'materias_primas.mpa');
    await safe(`ALTER TABLE materias_primas ALTER COLUMN mpa TYPE NUMERIC(5,2)`, 'materias_primas.mpa tipo');

    // ── produccion_codigos: migración histórica bloque_tela -> bloqueo_tela ──
    await safe(`ALTER TABLE produccion_codigos ADD COLUMN IF NOT EXISTS bloqueo_tela BOOLEAN DEFAULT FALSE`, 'produccion_codigos.bloqueo_tela');
    // Antes era un RENAME COLUMN directo que fallaba (y se tragaba) en cada
    // arranque posterior al primero. Ahora es condicional: solo renombra si la
    // columna vieja existe y la nueva no.
    await safe(`DO $mig$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_codigos' AND column_name='bloque_tela')
               AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_codigos' AND column_name='bloqueo_tela') THEN
                ALTER TABLE produccion_codigos RENAME COLUMN bloque_tela TO bloqueo_tela;
            END IF;
        END $mig$`, 'produccion_codigos rename bloque_tela');
    // Conversión de la columna legada VARCHAR('si'/'no') a BOOLEAN.
    await safe(`DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_codigos' AND column_name='bloqueo_tela' AND data_type='character varying') THEN
                UPDATE produccion_codigos SET bloqueo_tela = CASE WHEN bloqueo_tela IN ('si','s','1','true','Si','SI') THEN 'true'::boolean ELSE 'false'::boolean END;
                ALTER TABLE produccion_codigos ALTER COLUMN bloqueo_tela TYPE BOOLEAN USING bloqueo_tela::text::boolean;
            END IF;
        END $$`, 'produccion_codigos bloqueo_tela varchar->boolean');

    // ── instalaciones (antes estos ALTER corrían ANTES del CREATE) ───────────
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='numero_orden') THEN ALTER TABLE instalaciones ADD COLUMN numero_orden VARCHAR(50) DEFAULT ''; END IF; END $$`, 'instalaciones.numero_orden');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='vendedor') THEN ALTER TABLE instalaciones ADD COLUMN vendedor VARCHAR(200) DEFAULT ''; END IF; END $$`, 'instalaciones.vendedor');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='tipo') THEN ALTER TABLE instalaciones ADD COLUMN tipo VARCHAR(30) DEFAULT 'INSTALACION'; END IF; END $$`, 'instalaciones.tipo');
    await safe(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='duracion_dias') THEN ALTER TABLE instalaciones ADD COLUMN duracion_dias INTEGER DEFAULT 1; END IF; END $$`, 'instalaciones.duracion_dias');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 3 · Índices
// Corre después de faseColumnas: idx_cola_pasos_estacion_fecha indexa
// cola_produccion_pasos.fecha_programada, columna que antes se agregaba
// DESPUÉS de crear el índice (en una base nueva el índice fallaba).
// ─────────────────────────────────────────────────────────────────────────────
async function faseIndices({ q, safe }) {
    await q(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_cristal_nombre_espesor ON catalogo_tipos_cristal (nombre, espesor) WHERE activo = TRUE`);
    await q('CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_types_nombre ON machine_types(nombre)');
    await q('CREATE UNIQUE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)');
    await q('CREATE UNIQUE INDEX IF NOT EXISTS idx_component_type_links_unique ON component_type_links(tipo_id, componente_id)');

    await q('CREATE INDEX IF NOT EXISTS idx_pm_fecha ON preventive_maintenance(fecha_programada)');
    await q('CREATE INDEX IF NOT EXISTS idx_pm_estado ON preventive_maintenance(estado)');
    await q('CREATE INDEX IF NOT EXISTS idx_pm_maquina ON preventive_maintenance(maquina_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_cm_fecha ON corrective_maintenance(fecha_falla)');
    await q('CREATE INDEX IF NOT EXISTS idx_cm_estado ON corrective_maintenance(estado)');
    await q('CREATE INDEX IF NOT EXISTS idx_cm_maquina ON corrective_maintenance(maquina_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_machines_codigo ON machines(codigo)');

    // ── pedidos / pedido_historial ───────────────────────────────────────────
    // Confirmado el hallazgo: el índice de pedido_historial(pedido_id) YA
    // existía (idx_pedido_historial_pedido). Se agrega además el compuesto
    // (pedido_id, created_at DESC) que cubre el ORDER BY created_at DESC del
    // historial de un pedido (routes/pedidos.js).
    await q('CREATE INDEX IF NOT EXISTS idx_pedido_historial_pedido ON pedido_historial(pedido_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_pedido_historial_pedido_fecha ON pedido_historial(pedido_id, created_at DESC)');
    // Índices elegidos según las queries reales de routes/pedidos.js:
    //  - idx_pedidos_numero: chequeo de unicidad previo al INSERT
    //    (SELECT id FROM pedidos WHERE numero_pedido = $1 LIMIT 1).
    await q('CREATE INDEX IF NOT EXISTS idx_pedidos_numero ON pedidos(numero_pedido)');
    //  - idx_pedidos_estado: conteos del dashboard (WHERE estado = ...), los
    //    FILTER del reporte y cleanup-pdf (WHERE estado != 'pendiente').
    await q('CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado)');
    //  - idx_pedidos_vendedor: listado del área de ventas (WHERE p.vendedor = $1).
    await q('CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor ON pedidos(vendedor)');
    //  - idx_pedidos_fecha_subida: ORDER BY p.fecha_subida DESC del listado y
    //    columna REAL del filtro por año del reporte. Nota: el filtro del
    //    reporte es EXTRACT(YEAR FROM fecha_subida) = $1, que NO es sargable,
    //    así que hoy el índice sirve para el orden y para rangos de fecha; la
    //    corrección de esa query es aparte (aquí solo índices).
    await q('CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_subida ON pedidos(fecha_subida)');
    //  - idx_pedidos_fecha_revision: pedido por el reporte/auditoría de
    //    revisiones. Hoy las queries solo seleccionan esa columna (el reporte
    //    filtra por fecha_subida), pero es el índice que habilita reportes por
    //    fecha de revisión sin seq scan; el costo de escritura es despreciable
    //    en una tabla de bajo volumen como pedidos.
    await q('CREATE INDEX IF NOT EXISTS idx_pedidos_fecha_revision ON pedidos(fecha_revision)');

    // ── unicidad de pedidos.numero_pedido ────────────────────────────────────
    // Hasta ahora la unicidad era solo de aplicación (SELECT EXISTS previo al
    // INSERT en routes/pedidos.js) y con ventana de carrera. Decisión tomada
    // para agregar el UNIQUE sin romper una base existente con datos:
    //  1) si YA existe un índice/constraint UNIQUE sobre solo numero_pedido
    //     (nacido del UNIQUE en línea del CREATE TABLE en base fresca, o de
    //     una corrida anterior), no se hace nada (idempotente);
    //  2) si no lo hay y HAY numero_pedido duplicados, NO se rompe el
    //     arranque: se deja constancia en el log con la cantidad y se OMITE
    //     la creación del índice UNIQUE hasta normalizar los datos;
    //  3) si no hay duplicados, se crea uq_pedidos_numero_pedido (UNIQUE).
    // En base fresca pedidos está vacía al llegar a esta fase (los seeds corren
    // en faseDatos, después), así que el UNIQUE queda SIEMPRE.
    // La creación va por safe(): si entre el conteo y el CREATE otro proceso
    // inserta un duplicado, el error 23505 no revierte la fase entera ni rompe
    // el arranque: solo se registra y el UNIQUE se re-intenta en el próximo
    // arranque.
    const uniquePedidos = await q(`SELECT 1 FROM pg_indexes
        WHERE schemaname = current_schema() AND tablename = 'pedidos'
          AND indexdef LIKE 'CREATE UNIQUE%' AND indexdef LIKE '%(numero_pedido)%'
        LIMIT 1`);
    if (uniquePedidos.rows.length === 0) {
        const duplicados = await q(`SELECT COUNT(*)::int AS c FROM (
            SELECT numero_pedido FROM pedidos GROUP BY numero_pedido HAVING COUNT(*) > 1
        ) d`);
        const cantidad = Number(duplicados.rows[0].c);
        if (cantidad > 0) {
            console.warn(`[DB] pedidos.numero_pedido tiene ${cantidad} valor(es) duplicados; se OMITE la creación del índice UNIQUE uq_pedidos_numero_pedido hasta corregir los datos (el arranque continúa normal y el UNIQUE se re-intenta en el próximo arranque).`);
        } else {
            await safe(`CREATE UNIQUE INDEX IF NOT EXISTS uq_pedidos_numero_pedido ON pedidos(numero_pedido)`, 'uq_pedidos_numero_pedido');
        }
    }

    await q('CREATE INDEX IF NOT EXISTS idx_recetas_bom_padre ON recetas_bom(codigo_sap_padre)');
    await q('CREATE INDEX IF NOT EXISTS idx_recetas_bom_familia ON recetas_bom(familia_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_fam_estaciones_estacion ON familia_estaciones_base(estacion_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_cola_pasos_orden ON cola_produccion_pasos(orden_produccion_id)');
    // Índices de inventario (movimientos): todos los reportes del módulo
    // filtraban por fecha_hora / tipo_movimiento / (tipo_cristal, espesor) y el
    // planificador caía en seq scan. Nota: los filtros con EXTRACT(... FROM
    // fecha_hora) no son sargables, así que no aprovechan idx_movimientos_fecha
    // directamente; la corrección de las queries es aparte. Aquí solo se crean
    // los índices que faltaban (el de materia_prima_id se crea en
    // runMigrations, junto a la columna).
    await q('CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos(fecha_hora)');
    await q('CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos(tipo_movimiento)');
    await q('CREATE INDEX IF NOT EXISTS idx_movimientos_tipo_cristal ON movimientos(tipo_cristal, espesor)');
    // fecha_programada ya fue agregada en faseColumnas.
    await q('CREATE INDEX IF NOT EXISTS idx_cola_pasos_estacion_fecha ON cola_produccion_pasos(estacion_id, fecha_programada) WHERE fecha_programada IS NOT NULL');
    await q('CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON produccion_ordenes(estado_programacion, created_at DESC)');
    await q('CREATE INDEX IF NOT EXISTS idx_ordenes_pedido ON produccion_ordenes(pedido_sap_id, item_numero, codigo_producto)');
    // Indices de apoyo a planificacion/metricas (fijas de rendimiento del modulo de produccion)
    await q('CREATE INDEX IF NOT EXISTS idx_cola_pasos_estacion_estado ON cola_produccion_pasos(estacion_id, estado)');
    await q('CREATE INDEX IF NOT EXISTS idx_ordenes_fecha_programada ON produccion_ordenes(fecha_programada)');
    await q('CREATE INDEX IF NOT EXISTS idx_ordenes_grupo ON produccion_ordenes(grupo)');
    await q('CREATE INDEX IF NOT EXISTS idx_ordenes_bom_padre ON produccion_ordenes(bom_padre_id)');
    await q('CREATE INDEX IF NOT EXISTS idx_prod_notas_usuario ON prod_notas(usuario_email)');
}

// ─────────────────────────────────────────────────────────────────────────────
// FASE 4 · Datos: seeds iniciales y migraciones de datos
// ─────────────────────────────────────────────────────────────────────────────
async function faseDatos({ q, safe }) {
    // ── Catálogos base ───────────────────────────────────────────────────────
    const tiposCount = await q('SELECT COUNT(*) as c FROM catalogo_tipos_cristal');
    if (Number(tiposCount.rows[0].c) === 0) {
        const tiposDefault = ['Clear', 'Bronce', 'Gris', 'Azul', 'Verde', 'Espejo', 'Templado', 'Laminado', 'Otros'];
        for (const tipo of tiposDefault) {
            await q('INSERT INTO catalogo_tipos_cristal (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [tipo]);
        }
    }
    const espesoresCount = await q('SELECT COUNT(*) as c FROM catalogo_espesores');
    if (Number(espesoresCount.rows[0].c) === 0) {
        const espesoresDefault = [3, 4, 5, 6, 8, 10, 12, 15, 19, 25];
        for (const esp of espesoresDefault) {
            await q('INSERT INTO catalogo_espesores (valor) VALUES ($1) ON CONFLICT DO NOTHING', [esp]);
        }
    }

    // ── Capacidad por grupo ──────────────────────────────────────────────────
    const capacidadesSeed = [
        { grupo: 'Arquitectura', capacidad: 6500, color: '#22c55e' },
        { grupo: 'Carroceros', capacidad: 1500, color: '#06b6d4' },
        { grupo: 'Laminado', capacidad: 2400, color: '#1e293b' },
        { grupo: 'Laminado VM', capacidad: 1500, color: '#f97316' },
        { grupo: 'Servicios', capacidad: 1500, color: '#fde047' },
        { grupo: 'Termopanel', capacidad: 1600, color: '#1e3a8a' }
    ];
    for (const c of capacidadesSeed) {
        await q('INSERT INTO produccion_capacidad_grupo (grupo, capacidad_kg_dia, color) VALUES ($1, $2, $3) ON CONFLICT (grupo) DO NOTHING', [c.grupo, c.capacidad, c.color]);
    }
    await q("DELETE FROM produccion_capacidad_grupo WHERE grupo IN ('Laminado Importado','Laminado Nacional','Termopanel Laminado Especial','Termopanel Pintado Blanco','Termopanel Pintado Fosco','Termopanel Pintado Negro','Termopanel triple')");

    // ── Estaciones maestras por defecto ──────────────────────────────────────
    const estCount = await q('SELECT COUNT(*) as c FROM estaciones_maestras');
    if (Number(estCount.rows[0].c) === 0) {
        const estacionesDefault = [
            ['Corte', 1, 500, false], ['Pulido', 2, 300, false], ['Radio', 3, 200, false],
            ['Mecanizado', 4, 130, true], ['Ventana', 5, 100, true], ['Pintado', 6, 24, true],
            ['Templado', 7, 200, true], ['Armado', 8, 24, true]
        ];
        for (const [nombre, orden, cap, cuello] of estacionesDefault) {
            await q('INSERT INTO estaciones_maestras (nombre_estacion, orden_secuencia_defecto, cap_max, cuello_botella) VALUES ($1, $2, $3, $4)', [nombre, orden, cap, cuello]);
        }
        console.log('[PROD] Estaciones maestras creadas por defecto');
    }

    // ── Reglas de procesos extras ────────────────────────────────────────────
    const regCount = await q('SELECT COUNT(*) as c FROM reglas_procesos_extras');
    if (Number(regCount.rows[0].c) === 0) {
        const reglasDefault = [
            ['radio', 'Radio'], ['pulido', 'Pulido'], ['mecanizado', 'Mecanizado'],
            ['ventana', 'Ventana'], ['pintado', 'Pintado'], ['pintado_car', 'Armado']
        ];
        for (const [flag, estNombre] of reglasDefault) {
            const est = await q('SELECT id FROM estaciones_maestras WHERE nombre_estacion = $1', [estNombre]);
            if (est.rows.length > 0) {
                await q('INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2)', [flag, est.rows[0].id]);
            }
        }
        console.log('[PROD] Reglas de procesos extras creadas por defecto');
    }
    const pcExists = await q("SELECT id FROM reglas_procesos_extras WHERE nombre_flag = 'pintado_car'");
    if (pcExists.rows.length === 0) {
        const armado = await q("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Armado'");
        if (armado.rows.length > 0) {
            await q('INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2)', ['pintado_car', armado.rows[0].id]);
            console.log('[PROD] Regla pintado_car -> Armado creada');
        }
    }

    // ── Calendario de producción: fines de semana no laborables ──────────────
    // Se siembra el año en curso Y el siguiente. Si solo se siembra el año
    // actual, al cruzar de año enero queda sin sábados/domingos marcados y la
    // planificación los trata como laborables. Los INSERT son idempotentes
    // (ON CONFLICT DO NOTHING), así que se puede ampliar el rango sin riesgo.
    const anioActual = new Date().getFullYear();
    for (const anio of [anioActual, anioActual + 1]) {
        for (let m = 0; m < 12; m++) {
            for (let d = 1; d <= 31; d++) {
                const dt = new Date(anio, m, d);
                // OJO: new Date(...) DESBORDA d�as inexistentes (ej: 29 de
                // febrero en a�o no bisiesto -> 1 de marzo). Si el mes cort�,
                // salimos del loop; si no, se generaban fechas inv�lidas como
                // '2026-02-29' y PostgreSQL rechazaba el INSERT tummando initDB.
                if (dt.getMonth() !== m) break;
                if (dt.getDay() === 0 || dt.getDay() === 6) {
                    const fs = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
                    const motivo = dt.getDay() === 0 ? 'Domingo' : 'Sabado';
                    await q('INSERT INTO calendario_produccion (fecha, es_laboral, motivo) VALUES ($1, FALSE, $2) ON CONFLICT (fecha) DO NOTHING', [fs, motivo]);
                }
            }
        }
    }

    // Sincronizar estados de instalaciones_dias con instalaciones padre
    await safe(`
        UPDATE instalaciones_dias d
        SET estado = i.estado
        FROM instalaciones i
        WHERE d.instalacion_id = i.id AND d.estado != i.estado
    `, 'instalaciones_dias sync');

    // ── Migración de días de instalaciones ───────────────────────────────────
    const diasCount = await q('SELECT COUNT(*) as c FROM instalaciones_dias');
    const instCount = await q('SELECT COUNT(*) as c FROM instalaciones');
    if (Number(diasCount.rows[0].c) === 0 || Number(diasCount.rows[0].c) < Number(instCount.rows[0].c)) {
        await q('DELETE FROM instalaciones_dias');
        const instResult = await q('SELECT id, fecha_programada::text, duracion_dias, estado FROM instalaciones');
        for (const inst of instResult.rows) {
            try {
                const duracion = Math.max(1, parseInt(inst.duracion_dias) || 1);
                const fechaStr = String(inst.fecha_programada).substring(0, 10);
                const parts = fechaStr.split('-');
                const fechaInicio = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                let current = new Date(fechaInicio);
                let diaNum = 1;
                let diasCreados = 0;
                while (diasCreados < duracion) {
                    const dow = current.getDay();
                    if (dow !== 0 && dow !== 6) {
                        const yyyy = current.getFullYear();
                        const mm = String(current.getMonth() + 1).padStart(2, '0');
                        const dd = String(current.getDate()).padStart(2, '0');
                        const fecha = `${yyyy}-${mm}-${dd}`;
                        await q(
                            'INSERT INTO instalaciones_dias (instalacion_id, fecha, dia_numero, estado) VALUES ($1, $2, $3, $4)',
                            [inst.id, fecha, diaNum, inst.estado || 'PROGRAMADA']
                        );
                        diaNum++;
                        diasCreados++;
                    }
                    current.setDate(current.getDate() + 1);
                }
            } catch(e) {
                console.error('[PROD] Error migrando instalación', inst.id, e.message);
            }
        }
        console.log('[PROD] Días de instalaciones migrados:', instResult.rows.length);
    }

    // ── Familias de producto por defecto ─────────────────────────────────────
    const famCount = await q('SELECT COUNT(*) as c FROM familias_producto');
    if (Number(famCount.rows[0].c) === 0) {
        const familiasDefault = [
            ['CRUDO_SP', 'Crudo sin pulir', 1500, 500], ['CRUDO_P', 'Crudo pulido', 2000, 600],
            ['TEMPLADO', 'Templado', 2500, 700], ['TERMO', 'Termopanel', 3000, 800],
            ['TERMO_TC1', 'Termopanel temp 1 cara', 3500, 850], ['TERMO_TC2', 'Termopanel temp 2 caras', 4000, 900],
            ['LAM_SP', 'Laminado sin pulir', 2200, 650], ['LAM_P', 'Laminado pulido', 2800, 750],
            ['CARROCERO', 'Carrocero', 3200, 800]
        ];
        for (const [codigo, nombre, hh, energia] of familiasDefault) {
            await q('INSERT INTO familias_producto (codigo_familia, nombre_familia, costo_hh, costo_energia) VALUES ($1, $2, $3, $4)', [codigo, nombre, hh, energia]);
        }
        console.log('[PROD] Familias de producto creadas por defecto');
    }

    // ── Migración de recetas antiguas ────────────────────────────────────────
    const rbCount = await q('SELECT COUNT(*) as c FROM recetas_bom');
    const prbCount = await q('SELECT COUNT(*) as c FROM produccion_recetas_bom');
    if (Number(rbCount.rows[0].c) === 0 && Number(prbCount.rows[0].c) > 0) {
        console.log('[PROD] Migrando recetas de produccion_recetas_bom a recetas_bom...');
        const oldRecetas = await q('SELECT DISTINCT codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad FROM produccion_recetas_bom');
        for (const r of oldRecetas.rows) {
            let mp = await q('SELECT id FROM materias_primas WHERE codigo_mp = $1', [r.codigo_materia_prima]);
            if (mp.rows.length === 0) {
                const mpResult = await q('INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm) VALUES ($1, $2, $3) RETURNING id', [r.codigo_materia_prima, r.descripcion || r.codigo_materia_prima, r.espesor || 0]);
                mp = mpResult;
            }
            const mpId = mp.rows[0].id;
            await q('INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [r.codigo_sap_padre, mpId, r.cantidad || 1]);
        }
        console.log('[PROD] Recetas migradas:', oldRecetas.rows.length);
    }

    // ── estaciones_maestras: migración desde columnas antiguas ───────────────
    // Estos UPDATE referencian capacidad_max_m2_dia / es_cuello_botella, que NO
    // existen en el esquema actual (solo en bases muy antiguas). Antes se
    // ejecutaban a secas y abortaban initDB ("column does not exist"); ahora
    // son condicionales.
    await safe(`DO $mig$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estaciones_maestras' AND column_name='capacidad_max_m2_dia') THEN
                UPDATE estaciones_maestras SET cap_max = capacidad_max_m2_dia WHERE cap_max IS NULL OR cap_max = 0;
            END IF;
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='estaciones_maestras' AND column_name='es_cuello_botella') THEN
                UPDATE estaciones_maestras SET cuello_botella = es_cuello_botella WHERE cuello_botella IS NULL OR cuello_botella = FALSE;
            END IF;
        END $mig$`, 'estaciones_maestras · columnas antiguas');
    // Si cap_max sigue en 0 o NULL, asignar valores por defecto según nombre
    await q(`UPDATE estaciones_maestras SET cap_max = 500 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Corte'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 300 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Pulido'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 200 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Radio'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 130 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Mecanizado'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 100 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Ventana'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 24 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Pintado'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 200 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Templado'`);
    await q(`UPDATE estaciones_maestras SET cap_max = 24 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Armado'`);
    await q(`UPDATE estaciones_maestras SET cuello_botella = TRUE WHERE orden_secuencia_defecto BETWEEN 4 AND 8 AND (cuello_botella IS NULL OR cuello_botella = FALSE)`);

    // ── produccion_ordenes: backfill de espesor_mm desde la receta ───────────
    await q(`
        UPDATE produccion_ordenes o
        SET espesor_mm = COALESCE(
            (SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id), 6
        )
        WHERE (o.espesor_mm IS NULL OR o.espesor_mm = 0)
    `);

    // ── Usuario administrador y permisos ─────────────────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@vidrieria.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const ALL_PERMS = [
        'asistencia','asistencia.agregar','asistencia.editar','asistencia.eliminar',
        'horas_extras','horas_extras.agregar','horas_extras.editar','horas_extras.eliminar',
        'turnos_recepcion','turnos_recepcion.agregar','turnos_recepcion.editar','turnos_recepcion.eliminar',
        'turnos_bodega','turnos_bodega.agregar','turnos_bodega.editar','turnos_bodega.eliminar',
        'turnos_almacen','turnos_almacen.agregar','turnos_almacen.editar','turnos_almacen.eliminar',
        'turnos_facturar','turnos_facturar.agregar','turnos_facturar.editar','turnos_facturar.eliminar',
        'turnos_qr','turnos_qr.agregar','turnos_qr.editar','turnos_qr.eliminar',
        'turnos_reporte','turnos_reporte.agregar','turnos_reporte.editar','turnos_reporte.eliminar',
        'instalaciones','instalaciones.agregar','instalaciones.editar','instalaciones.eliminar',
        'inst_historial','inst_historial.agregar','inst_historial.editar','inst_historial.eliminar',
        'inv_inventario','inv_inventario.agregar','inv_inventario.editar','inv_inventario.eliminar',
        'inv_movimientos','inv_movimientos.agregar','inv_movimientos.editar','inv_movimientos.eliminar',
        'inv_historial','inv_historial.agregar','inv_historial.editar','inv_historial.eliminar',
        'inv_catalogos','inv_catalogos.agregar','inv_catalogos.editar','inv_catalogos.eliminar',
        'dashboard','dashboard.agregar','dashboard.editar','dashboard.eliminar',
        'machineTypes','machineTypes.agregar','machineTypes.editar','machineTypes.eliminar',
        'machines','machines.agregar','machines.editar','machines.eliminar',
        'components','components.agregar','components.editar','components.eliminar',
        'preventive','preventive.agregar','preventive.editar','preventive.eliminar',
        'corrective','corrective.agregar','corrective.editar','corrective.eliminar',
        'calendar','calendar.agregar','calendar.editar','calendar.eliminar',
        'notas','notas.agregar','notas.editar','notas.eliminar',
        'reports','reports.agregar','reports.editar','reports.eliminar',
        'history','history.agregar','history.editar','history.eliminar',
        'bitacora','bitacora.agregar','bitacora.editar','bitacora.eliminar',
        'pedidos','pedidos.agregar','pedidos.editar','pedidos.eliminar',
        'prod_ordenes','prod_ordenes.agregar','prod_ordenes.editar','prod_ordenes.eliminar',
        'prod_planificacion','prod_planificacion.agregar','prod_planificacion.editar','prod_planificacion.eliminar',
        'prod_reportes','prod_reportes.agregar','prod_reportes.editar','prod_reportes.eliminar',
        'prod_notas','prod_notas.agregar','prod_notas.editar','prod_notas.eliminar',
        'prod_config','prod_config.agregar','prod_config.editar','prod_config.eliminar',
        'taller','taller.agregar','taller.editar','taller.eliminar',
        'bodega','bodega.agregar','bodega.editar','bodega.eliminar',
        'costeo','costeo.agregar','costeo.editar','costeo.eliminar',
        'usuarios'
    ];
    const adminCheck = await q("SELECT id FROM usuarios WHERE email = $1", [adminEmail]);
    if (adminCheck.rows.length === 0) {
        await q("INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5)",
            ['Administrador', adminEmail, hashPassword(adminPassword), 'admin', ALL_PERMS]);
    } else {
        for (const p of ALL_PERMS) {
            await safe("UPDATE usuarios SET permisos = array_append(permisos, $1) WHERE rol = 'admin' AND NOT ($1 = ANY(permisos))", 'permisos admin', [p]);
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migraciones históricas (bloques independientes; cada uno registra su error
// real con console.error si algo falla, sin tragarlo en silencio).
// Se ejecutan después de las fases, por lo que sus tablas/columnas objetivo ya
// existen.
//
// ATOMICIDAD: antes cada sentencia corría en autocommit suelto y un fallo a
// mitad de bloque dejaba el esquema a medias (p. ej. se aplicaba un ALTER pero
// no el siguiente y los INSERT fallaban en runtime). Ahora TODAS las
// migraciones corren en UNA transacción (runFase('migraciones', ...)) y cada
// bloque corre dentro de su propio SAVEPOINT: si un bloque falla se revierte
// SOLO ese bloque (nunca queda una sentencia aplicada y otra no) y se registra
// con el mismo mensaje de siempre ('Migration warning (...)'); los demás bloques
// y el COMMIT final siguen igual. El comportamiento idempotente no cambia: todo
// sigue siendo ALTER/CREATE ... IF NOT EXISTS, ON CONFLICT DO NOTHING o UPDATE
// con WHERE estrecho.
// ─────────────────────────────────────────────────────────────────────────────
async function runMigrations() {
    await runFase('migraciones', async ({ client }) => {
        // query local: misma firma que config/dbPool.query pero atada a la
        // conexión de la transacción (un pool no sirve dentro de un BEGIN).
        const query = (text, params = []) => client.query(text, params);
        let contadorSavepoints = 0;
        // bloque(etiqueta, fn): corre fn dentro de un SAVEPOINT. Si fn falla se
        // revierte SOLO ese bloque y se conserva el log histórico
        // 'Migration warning (<etiqueta>): <error>' (forma sin cambios).
        const bloque = async (etiqueta, fn) => {
            const punto = `mig_bloque_${++contadorSavepoints}`;
            await client.query(`SAVEPOINT ${punto}`);
            try {
                await fn();
                await client.query(`RELEASE SAVEPOINT ${punto}`);
            } catch (e) {
                await client.query(`ROLLBACK TO SAVEPOINT ${punto}`);
                await client.query(`RELEASE SAVEPOINT ${punto}`);
                console.error(`Migration warning (${etiqueta}):`, e.message);
            }
        };

        await bloque('001', async () => {
            await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS fecha_ingreso DATE");
            await query("UPDATE trabajadores SET fecha_ingreso = DATE(created_at) WHERE fecha_ingreso IS NULL");
            await query("ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET DEFAULT CURRENT_DATE");
            await query("ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET NOT NULL");
        });
        await bloque('telefono/puesto', async () => {
            await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS telefono VARCHAR(20)");
            await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS puesto VARCHAR(100)");
        });
        await bloque('inventario-materias_primas', async () => {
            await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS materia_prima_id INTEGER REFERENCES materias_primas(id)");
            await query("CREATE INDEX IF NOT EXISTS idx_movimientos_materia_prima ON movimientos(materia_prima_id)");
            await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS codigo_sap VARCHAR(50) DEFAULT ''");
            await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0");
            // LEGACY / SIN USO: materias_primas.consumo_mensual_aprox NO se usa en
            // ninguna parte de api/src (verificado con grep). La columna viva es
            // consumo_promedio_mensual (services/inventario.js, services/catalogos.js,
            // services/materiasPrimasService.js, routes/catalogosInventario.js,
            // routes/produccionConfig.js). NO se elimina porque la base de
            // producción ya la tiene y puede contener datos; se mantiene solo por
            // compatibilidad. (Ojo: catalogo_tipos_cristal.consumo_mensual_aprox es
            // otra tabla y esa sí está en uso.)
            await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0");
            await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS turno VARCHAR(10) DEFAULT NULL");
        });

        // ── Backfill de la migración 003 · movimientos → materias_primas ─────
        // api/src/db/migrations/003_unificar_inventario_materias_primas.sql
        // traía este backfill, pero ningún runner ejecuta esos .sql y
        // runMigrations() solo había replicado los ALTER: los movimientos
        // antiguos quedaron con materia_prima_id = NULL (invisibles para el
        // analytics y sin descontar stock). Aquí se implementa por fin.
        //
        // CRITERIO DE EMPAREJAMIENTO (mismo que el .sql, pero tolerante):
        //  * Nombre: LOWER(TRIM(tipo_cristal)) = LOWER(TRIM(materias_primas.nombre)).
        //  * Espesor: comparación NUMÉRICA con tolerancia
        //      ABS(m.espesor - mp.espesor_mm) < 1 mm. No se usa
        //      mp.espesor_mm::integer porque redondea (12.5 → 13) mientras que
        //      services/inventario.js guarda el espesor con parseInt (trunca:
        //      4.76 → 4); una tolerancia < 1 cubre ambos casos (truncar deja
        //      diferencia < 1; redondear deja diferencia ≤ 0.5).
        //  * Ambigüedad: si una fila matchea con VARIAS materias primas NO se
        //      asigna al azar: queda con materia_prima_id = NULL y se cuenta en
        //      el log. Ídem si no hay ninguna candidata.
        // IDEMPOTENTE: solo toca filas con materia_prima_id IS NULL; las ya
        // mapeadas nunca se re-evalúan. Las que quedaron NULL se re-evalúan en
        // cada arranque (por si después se crean las MPs que faltan).
        await bloque('003-backfill-materia-prima', async () => {
            const mapeados = await query(`
                WITH candidatos AS (
                    SELECT m.id AS movimiento_id, mp.id AS materia_prima_id,
                           COUNT(*) OVER (PARTITION BY m.id) AS total_candidatas
                    FROM movimientos m
                    JOIN materias_primas mp
                      ON LOWER(TRIM(m.tipo_cristal)) = LOWER(TRIM(mp.nombre))
                     AND ABS(m.espesor::numeric - mp.espesor_mm) < 1
                    WHERE m.materia_prima_id IS NULL
                )
                UPDATE movimientos m
                SET materia_prima_id = c.materia_prima_id
                FROM candidatos c
                WHERE c.movimiento_id = m.id AND c.total_candidatas = 1
                RETURNING m.id
            `);
            // Quedan sin mapear: las ambiguas (varias MPs candidatas) y las que
            // no tienen ninguna MP con ese nombre+espesor.
            const ambiguas = await query(`
                SELECT COUNT(DISTINCT m.id) AS c
                FROM movimientos m
                JOIN materias_primas mp
                  ON LOWER(TRIM(m.tipo_cristal)) = LOWER(TRIM(mp.nombre))
                 AND ABS(m.espesor::numeric - mp.espesor_mm) < 1
                WHERE m.materia_prima_id IS NULL
            `);
            const sinCandidata = await query(`
                SELECT COUNT(*) AS c FROM movimientos m
                WHERE m.materia_prima_id IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM materias_primas mp
                    WHERE LOWER(TRIM(m.tipo_cristal)) = LOWER(TRIM(mp.nombre))
                      AND ABS(m.espesor::numeric - mp.espesor_mm) < 1)
            `);
            const nAmbiguas = Number(ambiguas.rows[0].c);
            const nSinCandidata = Number(sinCandidata.rows[0].c);
            if (Number(mapeados.rowCount) > 0 || nAmbiguas > 0 || nSinCandidata > 0) {
                console.log(`[DB] Backfill 003 (movimientos → materias_primas): ${mapeados.rowCount} mapeados, ${nAmbiguas} sin mapear por nombre+espesor ambiguos, ${nSinCandidata} sin materia prima candidata`);
            }

            // Paso 5 del mismo .sql (tampoco corrió nunca): completar
            // materias_primas.codigo_sap desde catalogo_tipos_cristal cuando
            // está vacío. Mismo criterio de tolerancia y unicidad; solo rellena
            // valores vacíos, nunca sobreescribe un codigo_sap existente.
            await query(`
                UPDATE materias_primas mp
                SET codigo_sap = c.codigo_sap
                FROM catalogo_tipos_cristal c
                WHERE LOWER(TRIM(mp.nombre)) = LOWER(TRIM(c.nombre))
                  AND ABS(mp.espesor_mm::numeric - c.espesor::numeric) < 1
                  AND c.codigo_sap IS NOT NULL AND c.codigo_sap != ''
                  AND (mp.codigo_sap IS NULL OR mp.codigo_sap = '')
                  AND (SELECT COUNT(*) FROM catalogo_tipos_cristal c2
                        WHERE LOWER(TRIM(mp.nombre)) = LOWER(TRIM(c2.nombre))
                          AND ABS(mp.espesor_mm::numeric - c2.espesor::numeric) < 1) = 1
            `);
        });
        await bloque('002/003', async () => {
            await query(`CREATE TABLE IF NOT EXISTS procesos_carroceria_sap (
                id SERIAL PRIMARY KEY,
                codigo_sap VARCHAR(50) UNIQUE NOT NULL,
                estaciones_json JSONB NOT NULL DEFAULT '[]'::jsonb,
                descripcion TEXT,
                ancho DECIMAL(10,2) DEFAULT NULL,
                alto DECIMAL(10,2) DEFAULT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )`);
            await query("ALTER TABLE procesos_carroceria_sap ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL");
            await query("ALTER TABLE procesos_carroceria_sap ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL");
            await query(`CREATE INDEX IF NOT EXISTS idx_procesos_carroceria_sap_codigo ON procesos_carroceria_sap(codigo_sap)`);
        });
        // ── costos_config: parámetros de costeo para el módulo de Costos ──
        await bloque('costos_config', async () => {
            await query(`CREATE TABLE IF NOT EXISTS costos_config (
                id SERIAL PRIMARY KEY,
                clave VARCHAR(50) UNIQUE NOT NULL,
                valor DECIMAL(12,2) DEFAULT 0,
                descripcion TEXT,
                unidad VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            const existingCount = await query('SELECT COUNT(*) FROM costos_config WHERE valor != 0');
            if (parseInt(existingCount.rows[0].count) === 0) {
                const defaultParams = [
                    ['costo_hh', 0, 'Costo hora-hombre por m²', '$/m²'],
                    ['costo_energia_m2', 0, 'Costo energía por m²', '$/m²'],
                    ['costo_pulido_ml', 0, 'Costo pulido por metro lineal', '$/ml'],
                    ['costo_perforacion', 0, 'Costo por perforación', '$/ud'],
                    ['costo_destaje_kg', 0, 'Costo destaje normal por kg', '$/kg'],
                    ['costo_destaje_complejo_kg', 0, 'Costo destaje complejo por kg', '$/kg'],
                    ['costo_pintura_ml', 0, 'Costo pintura por ml', '$/ml'],
                    ['costo_insumos_pintura', 0, 'Costos insumos de pintura por m²', '$/m²'],
                    ['costo_otros_m2', 0, 'Costos otros por m²', '$/m²'],
                    ['hh_crudo_sin_pulir', 0, 'HH Crudo/Laminado sin pulir', '$/m²'],
                    ['energia_crudo_sin_pulir', 0, 'Energía Crudo/Laminado sin pulir', '$/m²'],
                    ['hh_crudo_pulido', 0, 'HH Crudo/Laminado pulido', '$/m²'],
                    ['energia_crudo_pulido', 0, 'Energía Crudo/Laminado pulido', '$/m²'],
                    ['hh_templado_plano', 0, 'HH Templado plano', '$/m²'],
                    ['energia_templado_plano', 0, 'Energía Templado plano', '$/m²'],
                    ['hh_templado_curvo', 0, 'HH Templado curvo', '$/m²'],
                    ['energia_templado_curvo', 0, 'Energía Templado curvo', '$/m²'],
                    ['merma_proceso_pct', 0, 'Porcentaje merma de proceso', '%'],
                    ['merma_aprovechamiento_pct', 0, 'Porcentaje merma de aprovechamiento', '%']
                ];
                for (const [clave, valor, descripcion, unidad] of defaultParams) {
                    await query('INSERT INTO costos_config (clave, valor, descripcion, unidad) VALUES ($1, $2, $3, $4) ON CONFLICT (clave) DO NOTHING', [clave, valor, descripcion, unidad]);
                }
            }
        });
        await bloque('mecanizado_operaciones', async () => {
            await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS mecanizado_operaciones TEXT");
        });
        await bloque('nivel_prioridad', async () => {
            await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS nivel_prioridad INTEGER DEFAULT 1");
            await query("UPDATE produccion_ordenes SET nivel_prioridad = 1 WHERE nivel_prioridad IS NULL");
            await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS needs_reprogramming BOOLEAN DEFAULT FALSE");
        });
        await bloque('grupo colors', async () => {
            await query("UPDATE produccion_capacidad_grupo SET color = '#22c55e' WHERE grupo = 'Arquitectura'");
            await query("UPDATE produccion_capacidad_grupo SET color = '#67e8f9' WHERE grupo = 'Carroceros'");
            await query("UPDATE produccion_capacidad_grupo SET color = '#1e3a8a' WHERE grupo LIKE '%Termopanel%'");
            await query("UPDATE produccion_capacidad_grupo SET color = '#1e293b' WHERE grupo LIKE '%Laminado%' AND grupo NOT LIKE '%VM%'");
            await query("UPDATE produccion_capacidad_grupo SET color = '#f97316' WHERE grupo LIKE '%Laminado VM%'");
            await query("UPDATE produccion_capacidad_grupo SET color = '#fde047' WHERE grupo LIKE '%Servicio%'");
        });
        await bloque('004', async () => {
            await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id) ON DELETE SET NULL");
            await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS procesos_especificos_json JSONB DEFAULT NULL");
            await query("CREATE INDEX IF NOT EXISTS idx_recetas_bom_familia ON recetas_bom(familia_id)");
            // Migrar datos desde procesos_carroceria_sap a recetas_bom.procesos_especificos_json
            await query(`
                UPDATE recetas_bom r
                SET procesos_especificos_json = pcs.estaciones_json
                FROM procesos_carroceria_sap pcs
                WHERE r.codigo_sap_padre = pcs.codigo_sap
                  AND (r.procesos_especificos_json IS NULL OR r.procesos_especificos_json = '[]'::jsonb)
                  AND pcs.estaciones_json IS NOT NULL
            `);
        });
        await bloque('ancho_alto', async () => {
            await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL");
            await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL");
        });
        // ── Migración: Mejoras al Módulo Taller (operario, inspecciones, historial) ──
        await bloque('taller-pasos', async () => {
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS operario_email VARCHAR(200)`);
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS operario_nombre VARCHAR(200)`);
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS pausado_en TIMESTAMP`);
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS tiempo_pausado_segundos INTEGER DEFAULT 0`);
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS locked_by VARCHAR(200)`);
            await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP`);
            await query(`CREATE INDEX IF NOT EXISTS idx_pasos_operario ON cola_produccion_pasos(operario_email)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_pasos_locked ON cola_produccion_pasos(locked_by, locked_at)`);
        });
        await bloque('inspecciones_calidad', async () => {
            await query(`CREATE TABLE IF NOT EXISTS inspecciones_calidad (
                id SERIAL PRIMARY KEY,
                paso_id INTEGER REFERENCES cola_produccion_pasos(id) ON DELETE CASCADE,
                orden_produccion_id INTEGER REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
                estacion_id INTEGER REFERENCES estaciones_maestras(id),
                tipo_inspeccion VARCHAR(50) NOT NULL,
                resultado VARCHAR(20) NOT NULL,
                defectos JSONB DEFAULT '[]',
                cantidad_inspeccionada INTEGER DEFAULT 0,
                cantidad_defectuosa INTEGER DEFAULT 0,
                inspector_email VARCHAR(200) NOT NULL,
                inspector_nombre VARCHAR(200),
                observaciones TEXT,
                imagenes JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )`);
            await query(`CREATE INDEX IF NOT EXISTS idx_inspecciones_paso ON inspecciones_calidad(paso_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_inspecciones_orden ON inspecciones_calidad(orden_produccion_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_inspecciones_fecha ON inspecciones_calidad(created_at)`);
        });
        await bloque('taller_historial', async () => {
            await query(`CREATE TABLE IF NOT EXISTS taller_historial (
                id SERIAL PRIMARY KEY,
                entidad_tipo VARCHAR(50) NOT NULL,
                entidad_id INTEGER NOT NULL,
                accion VARCHAR(50) NOT NULL,
                datos_anteriores JSONB,
                datos_nuevos JSONB,
                usuario_email VARCHAR(200),
                usuario_nombre VARCHAR(200),
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            await query(`CREATE INDEX IF NOT EXISTS idx_historial_entidad ON taller_historial(entidad_tipo, entidad_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_historial_fecha ON taller_historial(created_at)`);
        });
        await bloque('tipos_defecto', async () => {
            await query(`CREATE TABLE IF NOT EXISTS tipos_defecto (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(20) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                categoria VARCHAR(50),
                severidad_default VARCHAR(20) DEFAULT 'menor',
                requiere_foto BOOLEAN DEFAULT false,
                activo BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            await query(`INSERT INTO tipos_defecto (codigo, nombre, categoria, severidad_default, requiere_foto) VALUES
                ('RAY','Rayón','cosmetico','menor',false),
                ('BUR','Burbuja','cosmetico','menor',true),
                ('RAJ','Rajadura','estructural','critico',true),
                ('QUE','Quiebre','estructural','critico',true),
                ('DIM','Fuera de dimensión','dimensional','mayor',false),
                ('DES','Desalineación','dimensional','mayor',false),
                ('PIN','Defecto de pintado','cosmetico','menor',true),
                ('PER','Perforación incorrecta','dimensional','mayor',false),
                ('TEM','Defecto de templado','estructural','critico',true),
                ('LAM','Defecto de laminado','estructural','critico',true),
                ('SUC','Suciedad/Contaminación','cosmetico','menor',false),
                ('BOR','Borde irregular','cosmetico','menor',true)
            ON CONFLICT (codigo) DO NOTHING`);
        });
        await bloque('taller_turnos', async () => {
            await query(`CREATE TABLE IF NOT EXISTS taller_turnos (
                id SERIAL PRIMARY KEY,
                fecha DATE NOT NULL,
                turno VARCHAR(20) NOT NULL,
                operario_email VARCHAR(200) NOT NULL,
                operario_nombre VARCHAR(200),
                estacion_id INTEGER REFERENCES estaciones_maestras(id),
                hora_inicio TIMESTAMP,
                hora_fin TIMESTAMP,
                ordenes_completadas INTEGER DEFAULT 0,
                m2_producidos DECIMAL(10,2) DEFAULT 0,
                mermas_generadas INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            await query(`CREATE INDEX IF NOT EXISTS idx_turnos_fecha ON taller_turnos(fecha, turno)`);
        });
        // ── Módulo Bodega: carros de producto terminado, pre-entrega, entregas ──
        await bloque('bodega', async () => {
            await query(`CREATE TABLE IF NOT EXISTS bodega_carros (
                id SERIAL PRIMARY KEY,
                codigo VARCHAR(30) UNIQUE NOT NULL,
                tipo VARCHAR(50) DEFAULT 'carro',
                capacidad_items INTEGER DEFAULT 50,
                activo BOOLEAN DEFAULT true,
                observaciones TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            )`);
            await query(`ALTER TABLE bodega_carros ADD COLUMN IF NOT EXISTS tipo VARCHAR(50) DEFAULT 'carro'`);
            await query(`ALTER TABLE bodega_carros ADD COLUMN IF NOT EXISTS capacidad_items INTEGER DEFAULT 50`);
            await query(`ALTER TABLE bodega_carros ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT true`);
            await query(`ALTER TABLE bodega_carros ADD COLUMN IF NOT EXISTS observaciones TEXT`);
            await query(`ALTER TABLE bodega_carros ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`);
            await query(`CREATE TABLE IF NOT EXISTS bodega_carros_items (
                id SERIAL PRIMARY KEY,
                carro_id INTEGER REFERENCES bodega_carros(id) ON DELETE CASCADE,
                orden_produccion_id INTEGER REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
                paso_id INTEGER REFERENCES cola_produccion_pasos(id) ON DELETE CASCADE,
                armador_email VARCHAR(200),
                armador_nombre VARCHAR(200),
                armado_at TIMESTAMP DEFAULT NOW(),
                entregado_at TIMESTAMP,
                entregado_por_email VARCHAR(200),
                observaciones TEXT
            )`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS armador_email VARCHAR(200)`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS armador_nombre VARCHAR(200)`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS armado_at TIMESTAMP DEFAULT NOW()`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMP`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS entregado_por_email VARCHAR(200)`);
            await query(`ALTER TABLE bodega_carros_items ADD COLUMN IF NOT EXISTS observaciones TEXT`);
            await query(`CREATE TABLE IF NOT EXISTS bodega_entregas (
                id SERIAL PRIMARY KEY,
                carro_id INTEGER REFERENCES bodega_carros(id),
                numero_documento VARCHAR(50) UNIQUE NOT NULL,
                generado_at TIMESTAMP DEFAULT NOW(),
                generado_por_email VARCHAR(200),
                generado_por_nombre VARCHAR(200),
                recibido_at TIMESTAMP,
                recibido_por_email VARCHAR(200),
                recibido_por_nombre VARCHAR(200),
                total_items INTEGER DEFAULT 0,
                total_kilos DECIMAL(10,2) DEFAULT 0,
                total_m2 DECIMAL(10,2) DEFAULT 0,
                observaciones TEXT
            )`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS generado_por_email VARCHAR(200)`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS generado_por_nombre VARCHAR(200)`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS recibido_at TIMESTAMP`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS recibido_por_email VARCHAR(200)`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS recibido_por_nombre VARCHAR(200)`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 0`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS total_kilos DECIMAL(10,2) DEFAULT 0`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS total_m2 DECIMAL(10,2) DEFAULT 0`);
            await query(`ALTER TABLE bodega_entregas ADD COLUMN IF NOT EXISTS observaciones TEXT`);
            await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_carro ON bodega_carros_items(carro_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_orden ON bodega_carros_items(orden_produccion_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_entregado ON bodega_carros_items(entregado_at)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_bodega_entregas_carro ON bodega_entregas(carro_id)`);
            await query(`CREATE INDEX IF NOT EXISTS idx_bodega_entregas_recibido ON bodega_entregas(recibido_at)`);
            // Carros iniciales (catálogo)
            for (const codigo of ['C-001', 'C-002', 'C-003', 'A-001', 'A-002']) {
                await query(`INSERT INTO bodega_carros (codigo, tipo) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`, [codigo, codigo.startsWith('A-') ? 'atril' : 'carro']);
            }
        });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// resetSequences: sincroniza TODAS las secuencias con el MAX(id) real.
// Antes se mantenía una lista a mano y faltaban tablas (cola_produccion_pasos,
// recetas_bom, mermas, familias_producto, estaciones_maestras,
// procesos_carroceria_sap, produccion_capacidad_grupo, ...): tras restaurar
// datos con IDs explícitos, los INSERT chocaban con PK duplicadas. Ahora se
// descubren dinámicamente desde information_schema (columnas id serial o
// identity).
// ─────────────────────────────────────────────────────────────────────────────
async function resetSequences() {
    const tablas = await query(`
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND column_name = 'id'
          AND (column_default LIKE 'nextval(%' OR is_identity = 'YES')
        ORDER BY table_name
    `);
    for (const fila of tablas.rows) {
        const tabla = fila.table_name;
        // El nombre viene de information_schema; se valida igualmente antes de
        // interpolarlo en SQL.
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tabla)) {
            console.warn('[DB] resetSequences: nombre de tabla inesperado, se omite:', tabla);
            continue;
        }
        try {
            await query(`SELECT setval(pg_get_serial_sequence('${tabla}', 'id'), COALESCE((SELECT MAX(id) FROM ${tabla}), 1))`);
        } catch (e) {
            console.warn(`[DB] resetSequences: no se pudo resetear la secuencia de ${tabla}: ${e.message}`);
        }
    }
}

async function seedSigma() {
    await runFase('seed-sigma', async ({ q }) => {
        await q(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [1, 'Compresor']);
        await q(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [2, 'Bomba']);
        await q(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [3, 'Generador']);
        await q(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [4, 'Transportador']);
        await q(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [5, 'Mezclador']);
        await q(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [1, 'Rodamiento', 'Rodamiento de bolas o rodillos']);
        await q(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [2, 'Correa', 'Correa de transmisión']);
        await q(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [3, 'Polea', 'Polea para transmisión por correa']);
        await q(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [4, 'Motor Eléctrico', 'Motor de inducción trifásico']);
        await q(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [5, 'Filtro', 'Filtro de aire o aceite']);
        await q(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [1, 'ROD-001','Rodamiento SKF 6205-2Z',1,25,10,'SKF Chile','Estante A-12']);
        await q(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [2, 'COR-001','Correa trapezoidal B-85',2,8,5,'Gates','Estante B-03']);
        await q(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [3, 'FIL-001','Filtro de aceite P-5510',5,3,10,'Donaldson','Estante C-07']);
    });
}

async function seedBusinessData() {
    const existingMachines = await query('SELECT COUNT(*) as c FROM machines');
    const machinesExist = Number(existingMachines.rows[0].c) > 0;

    const pmCount = await query('SELECT COUNT(*) as c FROM preventive_maintenance');
    const cmCount = await query('SELECT COUNT(*) as c FROM corrective_maintenance');
    const turnosCount = await query('SELECT COUNT(*) as c FROM turnos');
    const movimientosCount = await query('SELECT COUNT(*) as c FROM movimientos');
    const pedidosCount = await query('SELECT COUNT(*) as c FROM pedidos');
    const prodMachinesCount = await query('SELECT COUNT(*) as c FROM produccion_maquinas');
    const prodOrdenesCount = await query('SELECT COUNT(*) as c FROM produccion_ordenes');

    const allSeeded = Number(pmCount.rows[0].c) > 0 && Number(cmCount.rows[0].c) > 0
        && Number(turnosCount.rows[0].c) > 0 && Number(movimientosCount.rows[0].c) > 0
        && Number(pedidosCount.rows[0].c) > 0 && Number(prodMachinesCount.rows[0].c) > 0
        && Number(prodOrdenesCount.rows[0].c) > 0;
    if (allSeeded) return;

    try {
        await runFase('seed-business', async ({ q }) => {
            if (!machinesExist) {
                await q(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    ['CMP-001', 'Compresor Principal', 1, 'Atlas Copco', 'GA 37', 'Planta Baja', 'Operativo']);
                await q(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    ['BMB-001', 'Bomba de Vacío', 2, 'Edwards', 'E2M18', 'Planta Alta', 'Operativo']);
                await q(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    ['GEN-001', 'Generador Eléctrico', 3, 'Caterpillar', 'C9.3', 'Exterior', 'Operativo']);
                await q(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    ['TRN-001', 'Transportador de Cinta', 4, 'Hytrol', 'EZLogic', 'Línea 1', 'Mantenimiento']);
                await q(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    ['MZC-001', 'Mezclador Industrial', 5, 'Hobart', 'HL800', 'Planta Baja', 'Operativo']);
            }

            if (Number(pmCount.rows[0].c) === 0) {
                await q(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado) VALUES ($1,$2,$3,$4,$5)`,
                    [1, 1, '2026-08-15', 'Carlos Muñoz', 'Programada']);
                await q(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado) VALUES ($1,$2,$3,$4,$5)`,
                    [1, 5, '2026-08-20', 'Carlos Muñoz', 'Programada']);
                await q(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado, fecha_ejecutada) VALUES ($1,$2,$3,$4,$5,$6)`,
                    [2, 4, '2026-07-10', 'Pedro Soto', 'Completada', '2026-07-10']);
                await q(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado, fecha_ejecutada) VALUES ($1,$2,$3,$4,$5,$6)`,
                    [3, 1, '2026-07-25', 'Carlos Muñoz', 'Completada', '2026-07-25']);
                console.log('[SEED] Mantención preventiva insertada');
            }

            if (Number(cmCount.rows[0].c) === 0) {
                await q(`INSERT INTO corrective_maintenance (maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, accion_correctiva, responsable, horas_detencion, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [4, 2, '2026-07-28', 'Correa cortada', 'Desgaste natural', 'Reemplazo de correa', 'Pedro Soto', 4.5, 'Reparada']);
                await q(`INSERT INTO corrective_maintenance (maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, responsable, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                    [5, 3, '2026-07-30', 'Ruido anormal en polea', 'Desalineación', 'Carlos Muñoz', 'En Mantención']);
                console.log('[SEED] Mantención correctiva insertada');
            }

            if (Number(turnosCount.rows[0].c) === 0) {
                await q(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                    ['María González', 1, 'atendido', '2026-07-30']);
                await q(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                    ['Juan Pérez', 2, 'espera', '2026-07-30']);
                await q(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                    ['Ana López', 3, 'espera', '2026-07-30']);
                await q(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                    ['Pedro Martínez', 4, 'llamado', '2026-07-30']);
                await q(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                    ['Laura Soto', 5, 'espera', '2026-07-30']);
                console.log('[SEED] Turnos insertados');
            }

            if (Number(movimientosCount.rows[0].c) === 0) {
                // Materia prima de demo asociada a los movimientos: sin
                // materia_prima_id los movimientos NO descuentan stock ni
                // aparecen en los reportes por materia prima (ver backfill 003).
                // Se busca por nombre+espesor (mismo criterio que el backfill
                // 003) y, si no existe, se crea con código de demo propio.
                const mpDemo = {};
                for (const mp of [
                    { clave: 'clear6', codigo: 'MP-DEMO-CLEAR-6', nombre: 'Clear', espesor: 6 },
                    { clave: 'templado8', codigo: 'MP-DEMO-TEMPLADO-8', nombre: 'Templado', espesor: 8 }
                ]) {
                    let r = await q(
                        'SELECT id FROM materias_primas WHERE LOWER(TRIM(nombre)) = LOWER($1) AND espesor_mm = $2 ORDER BY id LIMIT 1',
                        [mp.nombre, mp.espesor]);
                    if (r.rows.length === 0) {
                        r = await q('INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm) VALUES ($1, $2, $3) ON CONFLICT (codigo_mp) DO NOTHING RETURNING id', [mp.codigo, mp.nombre, mp.espesor]);
                        if (r.rows.length === 0) {
                            r = await q('SELECT id FROM materias_primas WHERE codigo_mp = $1', [mp.codigo]);
                        }
                    }
                    mpDemo[mp.clave] = r.rows[0].id;
                }

                // Valores de demo CONSISTENTES (planchas y m² cuadran):
                // plancha Clear 2.0 x 1.5 = 3 m² · plancha Templado 1.8 x 1.2 = 2.16 m².
                //  * Entrada Clear:    20 planchas = 60 m²
                //  * Salida  Clear:     5 planchas = 15 m² (tipo_salida
                //      'plancha_completa': descuenta 5 planchas y 15 m²; con
                //      'trozo' NO descontaría planchas según la regla de stock)
                //  * Entrada Templado: 10 planchas = 21.6 m²
                // Stock resultante: Clear 15 planchas / 45 m² · Templado 10
                // planchas / 21.6 m².
                await q(`INSERT INTO movimientos (usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [1, 'entrada', mpDemo.clear6, 'Clear', 6, 2000, 1500, 20, 60.0, 'Vidrios Chile', 'Compra mensual']);
                await q(`INSERT INTO movimientos (usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, tipo_salida, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [1, 'salida', mpDemo.clear6, 'Clear', 6, 2000, 1500, 5, 15.0, 'plancha_completa', 'Para orden PRD-001']);
                await q(`INSERT INTO movimientos (usuario_id, tipo_movimiento, materia_prima_id, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [1, 'entrada', mpDemo.templado8, 'Templado', 8, 1800, 1200, 10, 21.6, 'Vidrios Chile', 'Pedido urgente']);
                console.log('[SEED] Movimientos de inventario insertados');
            }

            if (Number(pedidosCount.rows[0].c) === 0) {
                await q(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                    ['PED-2026-001', 'Vidriería Los Andes', 'vendedor@vidrieria.com', 'aprobado']);
                await q(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                    ['PED-2026-002', 'Constructora Sur', 'vendedor@vidrieria.com', 'pendiente']);
                await q(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                    ['PED-2026-003', 'Inmobiliaria Norte', 'vendedor2@vidrieria.com', 'aprobado']);
                console.log('[SEED] Pedidos insertados');
            }

            if (Number(prodMachinesCount.rows[0].c) === 0) {
                await q(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                    ['Corte CNC', 'CNC-01', 'ACTIVA', 120.00, 'Corte']);
                await q(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                    ['Horno Templado', 'HT-01', 'ACTIVA', 80.00, 'Templado']);
                await q(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                    ['Laminadora', 'LAM-01', 'ACTIVA', 60.00, 'Laminado']);
                console.log('[SEED] Máquinas de producción insertadas');
            }

            if (Number(prodOrdenesCount.rows[0].c) === 0) {
                await q(`INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, estado_programacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    ['PED-2026-001', 'Vidriería Los Andes', 'VT-001', 'Vidrio templado 8mm', 1500, 1000, 1.5, 'EN PRODUCCIÓN']);
                await q(`INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, estado_programacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                    ['PED-2026-003', 'Inmobiliaria Norte', 'VL-001', 'Vidrio laminado 10mm', 2000, 1200, 2.4, 'PENDIENTE']);
                console.log('[SEED] Órdenes de producción insertadas');
            }
        });
        console.log('[SEED] Datos de negocio insertados exitosamente');
    } catch (e) {
        console.error('[SEED] Error:', e.message);
    }
}

module.exports = { initDB, resetSequences, seedSigma, seedBusinessData };
