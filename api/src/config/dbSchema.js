const { query } = require('./dbPool');
const { hashPassword } = require('./dbAuth');

async function initDB() {
    await query(`CREATE TABLE IF NOT EXISTS usuarios (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'usuario',
        permisos TEXT[] DEFAULT '{}',
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`DO $$ BEGIN ALTER TABLE usuarios ADD COLUMN permisos TEXT[] DEFAULT '{}'; EXCEPTION WHEN duplicate_column THEN null; END $$`);
    await query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS password_plain TEXT DEFAULT ''`);
    try { await query("ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area TEXT DEFAULT ''"); } catch(e) {}

    await query(`CREATE TABLE IF NOT EXISTS catalogo_tipos_cristal (
        id SERIAL PRIMARY KEY,
        nombre VARCHAR(100) NOT NULL,
        espesor INTEGER NOT NULL DEFAULT 0,
        codigo_sap VARCHAR(50) DEFAULT '',
        stock_critico INTEGER DEFAULT 0,
        consumo_mensual_aprox INTEGER DEFAULT 0,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS espesor INTEGER DEFAULT 0").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ADD COLUMN IF NOT EXISTS codigo_sap VARCHAR(50) DEFAULT ''").catch(() => {});
    await query("ALTER TABLE catalogo_tipos_cristal ALTER COLUMN consumo_mensual_aprox TYPE INTEGER USING consumo_mensual_aprox::INTEGER").catch(() => {});
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_key"); } catch(e) { console.log('Drop constraint nombre_key:', e.message); }
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_espesor_key"); } catch(e) { console.log('Drop constraint nombre_espesor_key:', e.message); }
    try { await query("ALTER TABLE catalogo_tipos_cristal DROP CONSTRAINT IF EXISTS catalogo_tipos_cristal_nombre_espesor_key, catalogo_tipos_cristal_nombre_key"); } catch(e) {}
    await query("CREATE UNIQUE INDEX IF NOT EXISTS idx_tipos_cristal_nombre_espesor ON catalogo_tipos_cristal (nombre, espesor) WHERE activo = TRUE").catch(() => {});

    await query(`CREATE TABLE IF NOT EXISTS catalogo_espesores (
        id SERIAL PRIMARY KEY,
        valor INTEGER UNIQUE NOT NULL,
        activo BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const tiposCount = await query('SELECT COUNT(*) as c FROM catalogo_tipos_cristal');
    if (Number(tiposCount.rows[0].c) === 0) {
        const tiposDefault = ['Clear', 'Bronce', 'Gris', 'Azul', 'Verde', 'Espejo', 'Templado', 'Laminado', 'Otros'];
        for (const tipo of tiposDefault) {
            await query('INSERT INTO catalogo_tipos_cristal (nombre) VALUES ($1) ON CONFLICT DO NOTHING', [tipo]);
        }
    }
    const espesoresCount = await query('SELECT COUNT(*) as c FROM catalogo_espesores');
    if (Number(espesoresCount.rows[0].c) === 0) {
        const espesoresDefault = [3, 4, 5, 6, 8, 10, 12, 15, 19, 25];
        for (const esp of espesoresDefault) {
            await query('INSERT INTO catalogo_espesores (valor) VALUES ($1) ON CONFLICT DO NOTHING', [esp]);
        }
    }

    await query(`CREATE TABLE IF NOT EXISTS machine_types (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_machine_types_nombre ON machine_types(nombre)');
    await query(`CREATE TABLE IF NOT EXISTS machines (
        id SERIAL PRIMARY KEY, codigo TEXT, nombre TEXT NOT NULL,
        tipo_id INTEGER, marca TEXT, modelo TEXT, numero_serie TEXT,
        ubicacion TEXT, fecha_compra TEXT, estado_operativo TEXT DEFAULT 'Operativo',
        observaciones TEXT
    )`);
    await query(`CREATE TABLE IF NOT EXISTS components (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, descripcion TEXT)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)');
    await query(`CREATE TABLE IF NOT EXISTS component_type_links (id SERIAL PRIMARY KEY, tipo_id INTEGER, componente_id INTEGER)`);
    await query('CREATE UNIQUE INDEX IF NOT EXISTS idx_component_type_links_unique ON component_type_links(tipo_id, componente_id)');
    await query(`CREATE TABLE IF NOT EXISTS preventive_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        frecuencia_diaria INTEGER DEFAULT 0, frecuencia_semanal INTEGER DEFAULT 0,
        frecuencia_mensual INTEGER DEFAULT 0, frecuencia_trimestral INTEGER DEFAULT 0,
        frecuencia_semestral INTEGER DEFAULT 0, frecuencia_anual INTEGER DEFAULT 0,
        fecha_programada TEXT, fecha_ejecutada TEXT, tecnico TEXT DEFAULT 'Pendiente',
        estado TEXT DEFAULT 'Programada', observaciones TEXT
    )`);
    await query(`CREATE TABLE IF NOT EXISTS corrective_maintenance (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        fecha_falla TEXT, descripcion_falla TEXT, diagnostico TEXT,
        accion_correctiva TEXT, repuestos_utilizados TEXT,
        horas_detencion REAL, responsable TEXT
    )`);
    try { await query('ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0'); } catch(e) {}
    try { await query('ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS checklist TEXT'); } catch(e) {}
    try { await query('ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS horas_ocupadas REAL DEFAULT 0'); } catch(e) {}
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'En Mantención'"); } catch(e) {}
    try { await query('ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS fecha_reparacion TEXT'); } catch(e) {}
    try { await query("ALTER TABLE preventive_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'"); } catch(e) {}
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS turno TEXT DEFAULT 'Dia'"); } catch(e) {}
    try { await query("ALTER TABLE corrective_maintenance ADD COLUMN IF NOT EXISTS imagenes TEXT"); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_fecha ON preventive_maintenance(fecha_programada)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_estado ON preventive_maintenance(estado)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_pm_maquina ON preventive_maintenance(maquina_id)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_fecha ON corrective_maintenance(fecha_falla)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_estado ON corrective_maintenance(estado)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_cm_maquina ON corrective_maintenance(maquina_id)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_machines_codigo ON machines(codigo)'); } catch(e) {}
    try { await query('CREATE INDEX IF NOT EXISTS idx_components_nombre ON components(nombre)'); } catch(e) {}

    await query(`CREATE TABLE IF NOT EXISTS spare_parts (
        id SERIAL PRIMARY KEY, codigo TEXT, descripcion TEXT,
        componente_id INTEGER, stock_actual INTEGER DEFAULT 0,
        stock_minimo INTEGER DEFAULT 0, proveedor TEXT, ubicacion_bodega TEXT
    )`);
    await query(`CREATE TABLE IF NOT EXISTS machine_components (
        id SERIAL PRIMARY KEY, maquina_id INTEGER, componente_id INTEGER,
        UNIQUE(maquina_id, componente_id)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS proveedores (
        id SERIAL PRIMARY KEY, nombre VARCHAR(200) NOT NULL, rut VARCHAR(20),
        telefono VARCHAR(30), email VARCHAR(150), direccion TEXT,
        persona_contacto VARCHAR(150), especialidad TEXT, observaciones TEXT,
        estado VARCHAR(20) DEFAULT 'Activo', fecha_registro DATE DEFAULT CURRENT_DATE
    )`);
    await query(`CREATE TABLE IF NOT EXISTS notas (
        id SERIAL PRIMARY KEY, tecnico TEXT, nota TEXT, fecha TEXT, hora TEXT
    )`);
    try { await query("ALTER TABLE notas ADD COLUMN IF NOT EXISTS leido BOOLEAN DEFAULT FALSE"); } catch(e) {}

    await query(`CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL, numero INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'espera', fecha DATE DEFAULT CURRENT_DATE,
        hora_creacion TIME DEFAULT CURRENT_TIME, hora_llamada TIME, hora_fin TIME
    )`);
    await query(`CREATE TABLE IF NOT EXISTS entregas (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id),
        cliente_nombre VARCHAR(100) NOT NULL, descripcion TEXT, pedidos TEXT,
        factura VARCHAR(50), tipo VARCHAR(30) DEFAULT 'Retira',
        estado VARCHAR(20) DEFAULT 'pendiente', fecha DATE DEFAULT CURRENT_DATE,
        hora_registrada TIME DEFAULT CURRENT_TIME, hora_entregada TIME
    )`);
    await query(`CREATE TABLE IF NOT EXISTS turnos_adjuntos (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id) ON DELETE CASCADE,
        nombre VARCHAR(255) NOT NULL, archivo BYTEA, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='rut') THEN ALTER TABLE turnos ADD COLUMN rut VARCHAR(20) DEFAULT ''; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='patente') THEN ALTER TABLE turnos ADD COLUMN patente VARCHAR(10) DEFAULT ''; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='motivo') THEN ALTER TABLE turnos ADD COLUMN motivo VARCHAR(20) DEFAULT 'Retirar'; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turnos' AND column_name='rut_empresa') THEN ALTER TABLE turnos ADD COLUMN rut_empresa VARCHAR(20) DEFAULT ''; END IF; END $$`);
    await query(`CREATE TABLE IF NOT EXISTS turnos_estados_log (
        id SERIAL PRIMARY KEY, turno_id INTEGER REFERENCES turnos(id) ON DELETE CASCADE,
        entrega_id INTEGER, estado VARCHAR(30) NOT NULL,
        fecha_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP, fecha_salida TIMESTAMP,
        duracion_segundos INTEGER, usuario VARCHAR(200) DEFAULT ''
    )`);
    await query(`CREATE TABLE IF NOT EXISTS tecnicos_almacen (
        id SERIAL PRIMARY KEY, nombre VARCHAR(200) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='tecnico_almacen_id') THEN ALTER TABLE entregas ADD COLUMN tecnico_almacen_id INTEGER; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='observaciones_almacen') THEN ALTER TABLE entregas ADD COLUMN observaciones_almacen TEXT DEFAULT ''; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='numero_factura') THEN ALTER TABLE entregas ADD COLUMN numero_factura VARCHAR(50) DEFAULT ''; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='monto_factura') THEN ALTER TABLE entregas ADD COLUMN monto_factura DECIMAL(12,2) DEFAULT 0; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_verificada') THEN ALTER TABLE entregas ADD COLUMN hora_verificada TIME; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_cargada') THEN ALTER TABLE entregas ADD COLUMN hora_cargada TIME; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='entregas' AND column_name='hora_facturada') THEN ALTER TABLE entregas ADD COLUMN hora_facturada TIME; END IF; END $$`);

    await query(`CREATE TABLE IF NOT EXISTS mermas (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        paso_id INTEGER REFERENCES cola_produccion_pasos(id) ON DELETE SET NULL,
        estacion_id INTEGER REFERENCES estaciones_maestras(id),
        causa VARCHAR(100) NOT NULL, cantidad INTEGER DEFAULT 1,
        observacion TEXT DEFAULT '', m2_mermados DECIMAL(10,4) DEFAULT 0,
        costo_materia_prima DECIMAL(12,2) DEFAULT 0,
        creado_por VARCHAR(200) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_ordenes' AND column_name='es_reposicion') THEN ALTER TABLE produccion_ordenes ADD COLUMN es_reposicion BOOLEAN DEFAULT FALSE; END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_ordenes' AND column_name='merma_original_id') THEN ALTER TABLE produccion_ordenes ADD COLUMN merma_original_id INTEGER REFERENCES mermas(id); END IF; END $$`);
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cola_produccion_pasos' AND column_name='estado') THEN ALTER TABLE cola_produccion_pasos ALTER COLUMN estado SET DEFAULT 'PENDIENTE'; END IF; END $$`);

    await query(`CREATE TABLE IF NOT EXISTS movimientos (
        id SERIAL PRIMARY KEY, usuario_id INTEGER REFERENCES usuarios(id),
        tipo_movimiento VARCHAR(20) NOT NULL, tipo_cristal VARCHAR(50) NOT NULL,
        espesor INTEGER NOT NULL, ancho INTEGER NOT NULL, alto INTEGER NOT NULL,
        cantidad_planchas INTEGER NOT NULL, metros_cuadrados DECIMAL(10,4) NOT NULL,
        proveedor VARCHAR(100), tipo_salida VARCHAR(20), observaciones TEXT,
        fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS pedidos (
        id SERIAL PRIMARY KEY, numero_pedido TEXT NOT NULL, cliente TEXT NOT NULL,
        vendedor TEXT NOT NULL, archivo_url TEXT, archivo_pdf BYTEA,
        estado TEXT DEFAULT 'pendiente', motivo_rechazo TEXT,
        fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_revision TIMESTAMP, revisado_por TEXT
    )`);
    await query("ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS tipo_ov VARCHAR(30) DEFAULT 'Normal'").catch(() => {});
    await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pedidos' AND column_name='archivo_pdf') THEN ALTER TABLE pedidos ADD COLUMN archivo_pdf BYTEA; END IF; END $$`);

    await query(`CREATE TABLE IF NOT EXISTS pedido_historial (
        id SERIAL PRIMARY KEY,
        pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
        accion VARCHAR(100) NOT NULL,
        campos_antes JSONB,
        campos_despues JSONB,
        usuario VARCHAR(200) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query('CREATE INDEX IF NOT EXISTS idx_pedido_historial_pedido ON pedido_historial(pedido_id)').catch(() => {});

    await query(`CREATE TABLE IF NOT EXISTS produccion_maquinas (
        id SERIAL PRIMARY KEY, nombre VARCHAR(100) NOT NULL,
        codigo VARCHAR(20) UNIQUE NOT NULL, estado VARCHAR(20) DEFAULT 'ACTIVA',
        capacidad_max_m2_dia DECIMAL(8,2) DEFAULT 0, tipo_proceso VARCHAR(50),
        num_operacion INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS tipo_proceso VARCHAR(50)`);
    await query(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS num_operacion INTEGER`);
    await query(`ALTER TABLE produccion_maquinas ADD COLUMN IF NOT EXISTS estacion_id INTEGER REFERENCES estaciones_maestras(id)`);
    await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS maquina_id INTEGER REFERENCES produccion_maquinas(id)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(30) DEFAULT 'Normal'`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS pintado BOOLEAN DEFAULT FALSE`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS perforaciones INTEGER DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cerrado_nota TEXT`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`);

    await query(`CREATE TABLE IF NOT EXISTS produccion_recetas_bom (
        id SERIAL PRIMARY KEY, codigo_sap_padre VARCHAR(30) NOT NULL,
        codigo_materia_prima VARCHAR(30) NOT NULL, descripcion TEXT,
        espesor INTEGER, cantidad INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS produccion_ordenes (
        id SERIAL PRIMARY KEY, pedido_sap_id VARCHAR(30), cliente TEXT,
        codigo_producto VARCHAR(30) NOT NULL, descripcion TEXT,
        ancho INTEGER NOT NULL, alto INTEGER NOT NULL,
        metros_cuadrados DECIMAL(10,4), es_compuesto BOOLEAN DEFAULT FALSE,
        bom_padre_id INTEGER, fecha_ingreso_sap TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_entrega_pactada DATE, estado_programacion VARCHAR(20) DEFAULT 'PENDIENTE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_nombre VARCHAR(50) NOT NULL, orden_secuencia INTEGER NOT NULL,
        estado VARCHAR(20) DEFAULT 'PENDIENTE', hora_inicio TIMESTAMP,
        hora_fin TIMESTAMP, operario_id INTEGER, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS produccion_codigos (
        id SERIAL PRIMARY KEY, codigo VARCHAR(30) UNIQUE NOT NULL,
        descripcion TEXT, grupo VARCHAR(100), familia VARCHAR(100),
        bloqueo_tela BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    try { await query(`ALTER TABLE produccion_codigos ADD COLUMN IF NOT EXISTS bloqueo_tela BOOLEAN DEFAULT FALSE`); } catch(e) {}
    try { await query(`ALTER TABLE produccion_codigos RENAME COLUMN bloque_tela TO bloqueo_tela`); } catch(e) {}
    try {
        await query(`DO $$ BEGIN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='produccion_codigos' AND column_name='bloqueo_tela' AND data_type='character varying') THEN
                UPDATE produccion_codigos SET bloqueo_tela = CASE WHEN bloqueo_tela IN ('si','s','1','true','Si','SI') THEN 'true'::boolean ELSE 'false'::boolean END;
                ALTER TABLE produccion_codigos ALTER COLUMN bloqueo_tela TYPE BOOLEAN USING bloqueo_tela::text::boolean;
            END IF;
        END $$`);
    } catch(e) {}

    await query(`CREATE TABLE IF NOT EXISTS estaciones_maestras (
        id SERIAL PRIMARY KEY, nombre_estacion VARCHAR(50) UNIQUE NOT NULL,
        orden_secuencia_defecto INTEGER UNIQUE NOT NULL,
        activa BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS familias_producto (
        id SERIAL PRIMARY KEY, codigo_familia VARCHAR(30) UNIQUE NOT NULL,
        nombre_familia VARCHAR(100) NOT NULL, costo_hh DECIMAL(12,2) DEFAULT 0,
        costo_energia DECIMAL(12,2) DEFAULT 0, activa BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS tecnicos (
        id SERIAL PRIMARY KEY, nombre VARCHAR(150) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS vendedores (
        id SERIAL PRIMARY KEY, nombre VARCHAR(150) NOT NULL,
        activo BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS familia_estaciones_base (
        id SERIAL PRIMARY KEY,
        familia_id INTEGER NOT NULL REFERENCES familias_producto(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        UNIQUE(familia_id, estacion_id)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS materias_primas (
        id SERIAL PRIMARY KEY, codigo_mp VARCHAR(30) UNIQUE NOT NULL,
        nombre VARCHAR(150) NOT NULL, espesor_mm DECIMAL(6,2) DEFAULT 0,
        costo_unitario_mp DECIMAL(12,2) DEFAULT 0, observacion TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS recetas_bom (
        id SERIAL PRIMARY KEY, codigo_sap_padre VARCHAR(30) NOT NULL,
        materia_prima_id INTEGER NOT NULL REFERENCES materias_primas(id) ON DELETE CASCADE,
        familia_id INTEGER REFERENCES familias_producto(id) ON DELETE SET NULL,
        cantidad DECIMAL(10,4) DEFAULT 1,
        procesos_especificos_json JSONB DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id) ON DELETE SET NULL`);
    await query(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS procesos_especificos_json JSONB DEFAULT NULL`);
    await query(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL`);
    await query(`ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL`);
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS costo_unitario_importado DECIMAL(12,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS hojas_por_paquete_nal INTEGER DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS ancho_nal DECIMAL(10,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS alto_nal DECIMAL(10,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS paquetes_por_camion INTEGER DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS hojas_por_paquete_imp INTEGER DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS ancho_imp DECIMAL(10,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS alto_imp DECIMAL(10,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS paquetes_por_contenedor INTEGER DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS consumo_promedio_mensual INTEGER DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS mpa NUMERIC(5,2) DEFAULT 0`).catch(() => {});
    await query(`ALTER TABLE materias_primas ALTER COLUMN mpa TYPE NUMERIC(5,2)`).catch(() => {});
    await query(`CREATE INDEX IF NOT EXISTS idx_recetas_bom_padre ON recetas_bom(codigo_sap_padre)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_recetas_bom_familia ON recetas_bom(familia_id)`);
    await query(`CREATE TABLE IF NOT EXISTS reglas_procesos_extras (
        id SERIAL PRIMARY KEY, nombre_flag VARCHAR(50) UNIQUE NOT NULL,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id) ON DELETE CASCADE,
        activa BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS cola_produccion_pasos (
        id SERIAL PRIMARY KEY,
        orden_produccion_id INTEGER NOT NULL REFERENCES produccion_ordenes(id) ON DELETE CASCADE,
        estacion_id INTEGER NOT NULL REFERENCES estaciones_maestras(id),
        orden_secuencia INTEGER NOT NULL, estado VARCHAR(20) DEFAULT 'PENDIENTE',
        hora_inicio TIMESTAMP, hora_fin TIMESTAMP, operario_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cola_pasos_orden ON cola_produccion_pasos(orden_produccion_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_cola_pasos_estacion_fecha ON cola_produccion_pasos(estacion_id, fecha_programada) WHERE fecha_programada IS NOT NULL`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON produccion_ordenes(estado_programacion, created_at DESC)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_ordenes_pedido ON produccion_ordenes(pedido_sap_id, item_numero, codigo_producto)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_fam_estaciones_estacion ON familia_estaciones_base(estacion_id)`);

    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS familia_id INTEGER REFERENCES familias_producto(id)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_hh DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_energia DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_materia_prima DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS costo_total_estimado DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS precio_unitario_sap DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS margen_estimado DECIMAL(12,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_venta VARCHAR(50) DEFAULT 'Normal'`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS item_numero INTEGER DEFAULT 1`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS cantidad INTEGER DEFAULT 1`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS codigo_padre VARCHAR(30)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS nota TEXT`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS posicion VARCHAR(100)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS orden_compra VARCHAR(50)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS tipo_entrega VARCHAR(20) DEFAULT 'Despacho'`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS kilos DECIMAL(10,2) DEFAULT 0`);
    await query(`ALTER TABLE estaciones_maestras ADD COLUMN IF NOT EXISTS cap_max DECIMAL(10,2) DEFAULT 100`);
    await query(`ALTER TABLE estaciones_maestras ADD COLUMN IF NOT EXISTS cuello_botella BOOLEAN DEFAULT FALSE`);
    // Migrar datos de columnas antiguas si existen
    await query(`UPDATE estaciones_maestras SET cap_max = capacidad_max_m2_dia WHERE cap_max IS NULL OR cap_max = 0`);
    await query(`UPDATE estaciones_maestras SET cuello_botella = es_cuello_botella WHERE cuello_botella IS NULL OR cuello_botella = FALSE`);
    // Si cap_max sigue en 0 o NULL, asignar valores por defecto según nombre
    await query(`UPDATE estaciones_maestras SET cap_max = 500 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Corte'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 300 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Pulido'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 200 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Radio'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 130 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Mecanizado'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 100 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Ventana'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 24 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Pintado'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 200 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Templado'`);
    await query(`UPDATE estaciones_maestras SET cap_max = 24 WHERE (cap_max IS NULL OR cap_max = 0) AND nombre_estacion = 'Armado'`);
    await query(`UPDATE estaciones_maestras SET cuello_botella = TRUE WHERE orden_secuencia_defecto BETWEEN 4 AND 8 AND (cuello_botella IS NULL OR cuello_botella = FALSE)`);
    await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS fecha_programada DATE`);
    await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS m2_asignados DECIMAL(10,2) DEFAULT 0`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS grupo VARCHAR(100)`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS fecha_programada DATE`);
    await query(`ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS espesor_mm NUMERIC(5,2) DEFAULT 6`);
    await query(`
        UPDATE produccion_ordenes o
        SET espesor_mm = COALESCE(
            (SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id), 6
        )
        WHERE (o.espesor_mm IS NULL OR o.espesor_mm = 0)
    `);
    await query(`ALTER TABLE produccion_ordenes ALTER COLUMN espesor_mm TYPE NUMERIC(5,2) USING espesor_mm::NUMERIC`);
    await query(`CREATE TABLE IF NOT EXISTS produccion_capacidad_grupo (
        id SERIAL PRIMARY KEY, grupo VARCHAR(100) UNIQUE NOT NULL,
        capacidad_kg_dia DECIMAL(10,2) DEFAULT 0, activo BOOLEAN DEFAULT TRUE,
        color VARCHAR(20) DEFAULT '#3b82f6', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    const capacidadesSeed = [
        { grupo: 'Arquitectura', capacidad: 6500, color: '#22c55e' },
        { grupo: 'Carroceros', capacidad: 1500, color: '#06b6d4' },
        { grupo: 'Laminado', capacidad: 2400, color: '#1e293b' },
        { grupo: 'Laminado VM', capacidad: 1500, color: '#f97316' },
        { grupo: 'Servicios', capacidad: 1500, color: '#fde047' },
        { grupo: 'Termopanel', capacidad: 1600, color: '#1e3a8a' }
    ];
    for (const c of capacidadesSeed) {
        await query('INSERT INTO produccion_capacidad_grupo (grupo, capacidad_kg_dia, color) VALUES ($1, $2, $3) ON CONFLICT (grupo) DO NOTHING', [c.grupo, c.capacidad, c.color]);
    }
    await query("DELETE FROM produccion_capacidad_grupo WHERE grupo IN ('Laminado Importado','Laminado Nacional','Termopanel Laminado Especial','Termopanel Pintado Blanco','Termopanel Pintado Fosco','Termopanel Pintado Negro','Termopanel triple')");
    const estCount = await query('SELECT COUNT(*) as c FROM estaciones_maestras');
    if (Number(estCount.rows[0].c) === 0) {
        const estacionesDefault = [
            ['Corte', 1, 500, false], ['Pulido', 2, 300, false], ['Radio', 3, 200, false],
            ['Mecanizado', 4, 130, true], ['Ventana', 5, 100, true], ['Pintado', 6, 24, true],
            ['Templado', 7, 200, true], ['Armado', 8, 24, true]
        ];
        for (const [nombre, orden, cap, cuello] of estacionesDefault) {
            await query('INSERT INTO estaciones_maestras (nombre_estacion, orden_secuencia_defecto, cap_max, cuello_botella) VALUES ($1, $2, $3, $4)', [nombre, orden, cap, cuello]);
        }
        console.log('[PROD] Estaciones maestras creadas por defecto');
    }
    const regCount = await query('SELECT COUNT(*) as c FROM reglas_procesos_extras');
    if (Number(regCount.rows[0].c) === 0) {
        const reglasDefault = [
            ['radio', 'Radio'], ['pulido', 'Pulido'], ['mecanizado', 'Mecanizado'],
            ['ventana', 'Ventana'], ['pintado', 'Pintado'], ['pintado_car', 'Armado']
        ];
        for (const [flag, estNombre] of reglasDefault) {
            const est = await query('SELECT id FROM estaciones_maestras WHERE nombre_estacion = $1', [estNombre]);
            if (est.rows.length > 0) {
                await query('INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2)', [flag, est.rows[0].id]);
            }
        }
        console.log('[PROD] Reglas de procesos extras creadas por defecto');
    }
    try {
        const pcExists = await query("SELECT id FROM reglas_procesos_extras WHERE nombre_flag = 'pintado_car'");
        if (pcExists.rows.length === 0) {
            const armado = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Armado'");
            if (armado.rows.length > 0) {
                await query('INSERT INTO reglas_procesos_extras (nombre_flag, estacion_id) VALUES ($1, $2)', ['pintado_car', armado.rows[0].id]);
                console.log('[PROD] Regla pintado_car -> Armado creada');
            }
        }
    } catch(e) {}

    try {
        await query(`CREATE TABLE IF NOT EXISTS calendario_produccion (
            id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL,
            es_laboral BOOLEAN DEFAULT TRUE, motivo TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='numero_orden') THEN ALTER TABLE instalaciones ADD COLUMN numero_orden VARCHAR(50) DEFAULT ''; END IF; END $$`);
        await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='vendedor') THEN ALTER TABLE instalaciones ADD COLUMN vendedor VARCHAR(200) DEFAULT ''; END IF; END $$`);
        await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='tipo') THEN ALTER TABLE instalaciones ADD COLUMN tipo VARCHAR(30) DEFAULT 'INSTALACION'; END IF; END $$`);
        await query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='instalaciones' AND column_name='duracion_dias') THEN ALTER TABLE instalaciones ADD COLUMN duracion_dias INTEGER DEFAULT 1; END IF; END $$`);
        const year = new Date().getFullYear();
        for (let m = 0; m < 12; m++) {
            for (let d = 1; d <= 31; d++) {
                const dt = new Date(year, m, d);
                if (dt.getFullYear() === year && (dt.getDay() === 0 || dt.getDay() === 6)) {
                    const fs = year + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
                    const motivo = dt.getDay() === 0 ? 'Domingo' : 'Sabado';
                    await query('INSERT INTO calendario_produccion (fecha, es_laboral, motivo) VALUES ($1, FALSE, $2) ON CONFLICT (fecha) DO NOTHING', [fs, motivo]);
                }
            }
        }
    } catch(calErr) { console.error('[PROD] Error calendario:', calErr.message); }

    await query(`CREATE TABLE IF NOT EXISTS instalaciones (
        id SERIAL PRIMARY KEY, cliente VARCHAR(200) NOT NULL, direccion TEXT NOT NULL,
        descripcion TEXT DEFAULT '', fecha_programada DATE NOT NULL,
        hora_programada TIME DEFAULT '09:00', tecnico VARCHAR(200) DEFAULT '',
        estado VARCHAR(30) DEFAULT 'PROGRAMADA', notas_previas TEXT DEFAULT '',
        notas_cierre TEXT DEFAULT '', firma_cliente TEXT DEFAULT '',
        creado_por VARCHAR(200) DEFAULT '', cerrado_por VARCHAR(200) DEFAULT '',
        fecha_cierre TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS instalaciones_historial (
        id SERIAL PRIMARY KEY,
        instalacion_id INTEGER REFERENCES instalaciones(id) ON DELETE CASCADE,
        accion VARCHAR(100) NOT NULL, detalle TEXT DEFAULT '',
        usuario VARCHAR(200) DEFAULT '', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS instalaciones_fotos (
        id SERIAL PRIMARY KEY,
        instalacion_id INTEGER REFERENCES instalaciones(id) ON DELETE CASCADE,
        foto BYTEA, descripcion TEXT DEFAULT '', orden INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const famCount = await query('SELECT COUNT(*) as c FROM familias_producto');
    if (Number(famCount.rows[0].c) === 0) {
        const familiasDefault = [
            ['CRUDO_SP', 'Crudo sin pulir', 1500, 500], ['CRUDO_P', 'Crudo pulido', 2000, 600],
            ['TEMPLADO', 'Templado', 2500, 700], ['TERMO', 'Termopanel', 3000, 800],
            ['TERMO_TC1', 'Termopanel temp 1 cara', 3500, 850], ['TERMO_TC2', 'Termopanel temp 2 caras', 4000, 900],
            ['LAM_SP', 'Laminado sin pulir', 2200, 650], ['LAM_P', 'Laminado pulido', 2800, 750],
            ['CARROCERO', 'Carrocero', 3200, 800]
        ];
        for (const [codigo, nombre, hh, energia] of familiasDefault) {
            await query('INSERT INTO familias_producto (codigo_familia, nombre_familia, costo_hh, costo_energia) VALUES ($1, $2, $3, $4)', [codigo, nombre, hh, energia]);
        }
        console.log('[PROD] Familias de producto creadas por defecto');
    }

    const rbCount = await query('SELECT COUNT(*) as c FROM recetas_bom');
    const prbCount = await query('SELECT COUNT(*) as c FROM produccion_recetas_bom');
    if (Number(rbCount.rows[0].c) === 0 && Number(prbCount.rows[0].c) > 0) {
        console.log('[PROD] Migrando recetas de produccion_recetas_bom a recetas_bom...');
        const oldRecetas = await query('SELECT DISTINCT codigo_sap_padre, codigo_materia_prima, descripcion, espesor, cantidad FROM produccion_recetas_bom');
        for (const r of oldRecetas.rows) {
            let mp = await query('SELECT id FROM materias_primas WHERE codigo_mp = $1', [r.codigo_materia_prima]);
            if (mp.rows.length === 0) {
                const mpResult = await query('INSERT INTO materias_primas (codigo_mp, nombre, espesor_mm) VALUES ($1, $2, $3) RETURNING id', [r.codigo_materia_prima, r.descripcion || r.codigo_materia_prima, r.espesor || 0]);
                mp = mpResult;
            }
            const mpId = mp.rows[0].id;
            await query('INSERT INTO recetas_bom (codigo_sap_padre, materia_prima_id, cantidad) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [r.codigo_sap_padre, mpId, r.cantidad || 1]);
        }
        console.log('[PROD] Recetas migradas:', oldRecetas.rows.length);
    }

    await query(`CREATE TABLE IF NOT EXISTS prod_notas (
        id SERIAL PRIMARY KEY, usuario_email VARCHAR(255) NOT NULL,
        nota TEXT NOT NULL, estado VARCHAR(20) DEFAULT 'pendiente',
        fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_completado TIMESTAMP, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

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
    const adminCheck = await query("SELECT id FROM usuarios WHERE email = $1", [adminEmail]);
    if (adminCheck.rows.length === 0) {
        await query("INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5)",
            ['Administrador', adminEmail, hashPassword(adminPassword), 'admin', ALL_PERMS]);
    } else {
        try {
            for (const p of ALL_PERMS) {
                await query("UPDATE usuarios SET permisos = array_append(permisos, $1) WHERE rol = 'admin' AND NOT ($1 = ANY(permisos))", [p]);
            }
        } catch(e) {}
    }

    const mtCount = await query('SELECT COUNT(*) as c FROM machine_types');
    if (Number(mtCount.rows[0].c) === 0) await seedSigma();
    await runMigrations();
    await resetSequences();
    await seedBusinessData();
}

async function runMigrations() {
    try {
        await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS fecha_ingreso DATE");
        await query("UPDATE trabajadores SET fecha_ingreso = DATE(created_at) WHERE fecha_ingreso IS NULL");
        await query("ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET DEFAULT CURRENT_DATE");
        await query("ALTER TABLE trabajadores ALTER COLUMN fecha_ingreso SET NOT NULL");
    } catch (e) {
        console.error('Migration warning (001):', e.message);
    }
    try {
        await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS telefono VARCHAR(20)");
        await query("ALTER TABLE trabajadores ADD COLUMN IF NOT EXISTS puesto VARCHAR(100)");
    } catch (e) {
        console.error('Migration warning (telefono/puesto):', e.message);
    }
    try {
        await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS materia_prima_id INTEGER REFERENCES materias_primas(id)");
        await query("CREATE INDEX IF NOT EXISTS idx_movimientos_materia_prima ON movimientos(materia_prima_id)");
        await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS codigo_sap VARCHAR(50) DEFAULT ''");
        await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS stock_critico INTEGER DEFAULT 0");
        await query("ALTER TABLE materias_primas ADD COLUMN IF NOT EXISTS consumo_mensual_aprox INTEGER DEFAULT 0");
        await query("ALTER TABLE movimientos ADD COLUMN IF NOT EXISTS turno VARCHAR(10) DEFAULT NULL");
    } catch (e) {
        console.error('Migration warning (inventario-materias_primas):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (002/003):', e.message);
    }
    // ── costos_config: parámetros de costeo para el módulo de Costos ──
    try {
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
    } catch (e) {
        console.error('Migration warning (costos_config):', e.message);
    }
    try {
        await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS mecanizado_operaciones TEXT");
    } catch (e) {
        console.error('Migration warning (mecanizado_operaciones):', e.message);
    }
    try {
        await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS nivel_prioridad INTEGER DEFAULT 1");
        await query("UPDATE produccion_ordenes SET nivel_prioridad = 1 WHERE nivel_prioridad IS NULL");
        await query("ALTER TABLE produccion_ordenes ADD COLUMN IF NOT EXISTS needs_reprogramming BOOLEAN DEFAULT FALSE");
    } catch (e) {
        console.error('Migration warning (nivel_prioridad):', e.message);
    }
    try {
        await query("UPDATE produccion_capacidad_grupo SET color = '#22c55e' WHERE grupo = 'Arquitectura'");
        await query("UPDATE produccion_capacidad_grupo SET color = '#67e8f9' WHERE grupo = 'Carroceros'");
        await query("UPDATE produccion_capacidad_grupo SET color = '#1e3a8a' WHERE grupo LIKE '%Termopanel%'");
        await query("UPDATE produccion_capacidad_grupo SET color = '#1e293b' WHERE grupo LIKE '%Laminado%' AND grupo NOT LIKE '%VM%'");
        await query("UPDATE produccion_capacidad_grupo SET color = '#f97316' WHERE grupo LIKE '%Laminado VM%'");
        await query("UPDATE produccion_capacidad_grupo SET color = '#fde047' WHERE grupo LIKE '%Servicio%'");
    } catch (e) {
        console.error('Migration warning (grupo colors):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (004):', e.message);
    }
    try {
        await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS ancho DECIMAL(10,2) DEFAULT NULL");
        await query("ALTER TABLE recetas_bom ADD COLUMN IF NOT EXISTS alto DECIMAL(10,2) DEFAULT NULL");
    } catch (e) {
        console.error('Migration warning (ancho_alto):', e.message);
    }
    // ── Migración: Mejoras al Módulo Taller (operario, inspecciones, historial) ──
    try {
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS operario_email VARCHAR(200)`);
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS operario_nombre VARCHAR(200)`);
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS pausado_en TIMESTAMP`);
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS tiempo_pausado_segundos INTEGER DEFAULT 0`);
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS locked_by VARCHAR(200)`);
        await query(`ALTER TABLE cola_produccion_pasos ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP`);
        await query(`CREATE INDEX IF NOT EXISTS idx_pasos_operario ON cola_produccion_pasos(operario_email)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_pasos_locked ON cola_produccion_pasos(locked_by, locked_at)`);
    } catch (e) {
        console.error('Migration warning (taller-pasos):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (inspecciones_calidad):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (taller_historial):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (tipos_defecto):', e.message);
    }
    try {
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
    } catch (e) {
        console.error('Migration warning (taller_turnos):', e.message);
    }
    // ── Módulo Bodega: carros de producto terminado, pre-entrega, entregas ──
    try {
        await query(`CREATE TABLE IF NOT EXISTS bodega_carros (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(30) UNIQUE NOT NULL,
            tipo VARCHAR(50) DEFAULT 'carro',
            capacidad_items INTEGER DEFAULT 50,
            activo BOOLEAN DEFAULT true,
            observaciones TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )`);
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
        await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_carro ON bodega_carros_items(carro_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_orden ON bodega_carros_items(orden_produccion_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_bodega_items_entregado ON bodega_carros_items(entregado_at)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_bodega_entregas_carro ON bodega_entregas(carro_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_bodega_entregas_recibido ON bodega_entregas(recibido_at)`);
        // Carros iniciales (catálogo)
        for (const codigo of ['C-001', 'C-002', 'C-003', 'A-001', 'A-002']) {
            await query(`INSERT INTO bodega_carros (codigo, tipo) VALUES ($1, $2) ON CONFLICT (codigo) DO NOTHING`, [codigo, codigo.startsWith('A-') ? 'atril' : 'carro']);
        }
    } catch (e) {
        console.error('Migration warning (bodega):', e.message);
    }
}

async function resetSequences() {
    const tables = ['usuarios', 'trabajadores', 'machine_types', 'machines', 'components', 'component_type_links',
                    'spare_parts', 'preventive_maintenance', 'corrective_maintenance',
                    'machine_components', 'notas', 'turnos', 'entregas', 'movimientos', 'pedidos',
                    'pedido_historial', 'catalogo_tipos_cristal', 'catalogo_espesores',
                    'produccion_maquinas', 'produccion_recetas_bom', 'produccion_ordenes', 'produccion_pasos', 'produccion_codigos', 'prod_notas',
                    'inspecciones_calidad', 'taller_historial', 'tipos_defecto', 'taller_turnos',
                    'bodega_carros', 'bodega_carros_items', 'bodega_entregas'];
    for (const table of tables) {
        try {
            await query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1))`);
        } catch(e) {}
    }
}

async function seedSigma() {
    await query('BEGIN');
    try {
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [1, 'Compresor']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [2, 'Bomba']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [3, 'Generador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [4, 'Transportador']);
        await query(`INSERT INTO machine_types (id, nombre) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [5, 'Mezclador']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [1, 'Rodamiento', 'Rodamiento de bolas o rodillos']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [2, 'Correa', 'Correa de transmisión']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [3, 'Polea', 'Polea para transmisión por correa']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [4, 'Motor Eléctrico', 'Motor de inducción trifásico']);
        await query(`INSERT INTO components (id, nombre, descripcion) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [5, 'Filtro', 'Filtro de aire o aceite']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [1, 'ROD-001','Rodamiento SKF 6205-2Z',1,25,10,'SKF Chile','Estante A-12']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [2, 'COR-001','Correa trapezoidal B-85',2,8,5,'Gates','Estante B-03']);
        await query(`INSERT INTO spare_parts (id, codigo, descripcion, componente_id, stock_actual, stock_minimo, proveedor, ubicacion_bodega) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
            [3, 'FIL-001','Filtro de aceite P-5510',5,3,10,'Donaldson','Estante C-07']);
        await query('COMMIT');
    } catch(e) { await query('ROLLBACK'); throw e; }
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

    await query('BEGIN');
    try {
        if (!machinesExist) {
            await query(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                ['CMP-001', 'Compresor Principal', 1, 'Atlas Copco', 'GA 37', 'Planta Baja', 'Operativo']);
            await query(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                ['BMB-001', 'Bomba de Vacío', 2, 'Edwards', 'E2M18', 'Planta Alta', 'Operativo']);
            await query(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                ['GEN-001', 'Generador Eléctrico', 3, 'Caterpillar', 'C9.3', 'Exterior', 'Operativo']);
            await query(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                ['TRN-001', 'Transportador de Cinta', 4, 'Hytrol', 'EZLogic', 'Línea 1', 'Mantenimiento']);
            await query(`INSERT INTO machines (codigo, nombre, tipo_id, marca, modelo, ubicacion, estado_operativo) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                ['MZC-001', 'Mezclador Industrial', 5, 'Hobart', 'HL800', 'Planta Baja', 'Operativo']);
        }

        if (Number(pmCount.rows[0].c) === 0) {
            await query(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado) VALUES ($1,$2,$3,$4,$5)`,
                [1, 1, '2026-08-15', 'Carlos Muñoz', 'Programada']);
            await query(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado) VALUES ($1,$2,$3,$4,$5)`,
                [1, 5, '2026-08-20', 'Carlos Muñoz', 'Programada']);
            await query(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado, fecha_ejecutada) VALUES ($1,$2,$3,$4,$5,$6)`,
                [2, 4, '2026-07-10', 'Pedro Soto', 'Completada', '2026-07-10']);
            await query(`INSERT INTO preventive_maintenance (maquina_id, componente_id, fecha_programada, tecnico, estado, fecha_ejecutada) VALUES ($1,$2,$3,$4,$5,$6)`,
                [3, 1, '2026-07-25', 'Carlos Muñoz', 'Completada', '2026-07-25']);
            console.log('[SEED] Mantención preventiva insertada');
        }

        if (Number(cmCount.rows[0].c) === 0) {
            await query(`INSERT INTO corrective_maintenance (maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, accion_correctiva, responsable, horas_detencion, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [4, 2, '2026-07-28', 'Correa cortada', 'Desgaste natural', 'Reemplazo de correa', 'Pedro Soto', 4.5, 'Reparada']);
            await query(`INSERT INTO corrective_maintenance (maquina_id, componente_id, fecha_falla, descripcion_falla, diagnostico, responsable, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [5, 3, '2026-07-30', 'Ruido anormal en polea', 'Desalineación', 'Carlos Muñoz', 'En Mantención']);
            console.log('[SEED] Mantención correctiva insertada');
        }

        if (Number(turnosCount.rows[0].c) === 0) {
            await query(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                ['María González', 1, 'atendido', '2026-07-30']);
            await query(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                ['Juan Pérez', 2, 'espera', '2026-07-30']);
            await query(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                ['Ana López', 3, 'espera', '2026-07-30']);
            await query(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                ['Pedro Martínez', 4, 'llamado', '2026-07-30']);
            await query(`INSERT INTO turnos (nombre, numero, estado, fecha) VALUES ($1,$2,$3,$4)`,
                ['Laura Soto', 5, 'espera', '2026-07-30']);
            console.log('[SEED] Turnos insertados');
        }

        if (Number(movimientosCount.rows[0].c) === 0) {
            await query(`INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [1, 'entrada', 'Clear', 6, 2000, 1500, 20, 60.0, 'Vidrios Chile', 'Compra mensual']);
            await query(`INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, tipo_salida, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [1, 'salida', 'Clear', 6, 2000, 1500, 5, 15.0, 'Producción', 'Para orden PRD-001']);
            await query(`INSERT INTO movimientos (usuario_id, tipo_movimiento, tipo_cristal, espesor, ancho, alto, cantidad_planchas, metros_cuadrados, proveedor, observaciones) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
                [1, 'entrada', 'Templado', 8, 1800, 1200, 10, 21.6, 'Vidrios Chile', 'Pedido urgente']);
            console.log('[SEED] Movimientos de inventario insertados');
        }

        if (Number(pedidosCount.rows[0].c) === 0) {
            await query(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                ['PED-2026-001', 'Vidriería Los Andes', 'vendedor@vidrieria.com', 'aprobado']);
            await query(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                ['PED-2026-002', 'Constructora Sur', 'vendedor@vidrieria.com', 'pendiente']);
            await query(`INSERT INTO pedidos (numero_pedido, cliente, vendedor, estado) VALUES ($1,$2,$3,$4)`,
                ['PED-2026-003', 'Inmobiliaria Norte', 'vendedor2@vidrieria.com', 'aprobado']);
            console.log('[SEED] Pedidos insertados');
        }

        if (Number(prodMachinesCount.rows[0].c) === 0) {
            await query(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                ['Corte CNC', 'CNC-01', 'ACTIVA', 120.00, 'Corte']);
            await query(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                ['Horno Templado', 'HT-01', 'ACTIVA', 80.00, 'Templado']);
            await query(`INSERT INTO produccion_maquinas (nombre, codigo, estado, capacidad_max_m2_dia, tipo_proceso) VALUES ($1,$2,$3,$4,$5)`,
                ['Laminadora', 'LAM-01', 'ACTIVA', 60.00, 'Laminado']);
            console.log('[SEED] Máquinas de producción insertadas');
        }

        if (Number(prodOrdenesCount.rows[0].c) === 0) {
            await query(`INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, estado_programacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                ['PED-2026-001', 'Vidriería Los Andes', 'VT-001', 'Vidrio templado 8mm', 1500, 1000, 1.5, 'EN PRODUCCIÓN']);
            await query(`INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados, estado_programacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                ['PED-2026-003', 'Inmobiliaria Norte', 'VL-001', 'Vidrio laminado 10mm', 2000, 1200, 2.4, 'PENDIENTE']);
            console.log('[SEED] Órdenes de producción insertadas');
        }

        await query('COMMIT');
        console.log('[SEED] Datos de negocio insertados exitosamente');
    } catch(e) { await query('ROLLBACK'); console.error('[SEED] Error:', e.message); }
}

module.exports = { initDB, resetSequences, seedSigma, seedBusinessData };
