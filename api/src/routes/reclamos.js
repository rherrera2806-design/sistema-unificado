const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { crudPerms } = require('../middleware/permisos');

const MOD = 'reclamos';
const perms = crudPerms(MOD);

// Auto-migración: asegurar columnas existen
let _migrated = false;
async function ensureColumns() {
    try {
        // Asegurar tabla matriz_responsables_motivos
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

        const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name='reclamos_devoluciones'`);
        const existing = cols.rows.map(r => r.column_name);
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
        // Siempre recalcular costo_total desde items
        await query(`
            UPDATE reclamos_devoluciones SET costo_total = COALESCE(
                (SELECT SUM((item->>'valor_unitario')::numeric * COALESCE((item->>'cantidad')::numeric, 1))
                 FROM jsonb_array_elements(COALESCE(items, '[]'::jsonb)) AS item), 0
            )
        `);
        const histCheck = await query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='reclamos_historial')`);
        if (!histCheck.rows[0].exists) {
            await query(`CREATE TABLE IF NOT EXISTS reclamos_historial (
                id SERIAL PRIMARY KEY, reclamo_id INTEGER NOT NULL REFERENCES reclamos_devoluciones(id) ON DELETE CASCADE,
                accion VARCHAR(100) NOT NULL, estado_antes VARCHAR(30), estado_despues VARCHAR(30),
                responsable VARCHAR(200) DEFAULT '', observacion TEXT DEFAULT '', created_at TIMESTAMP DEFAULT NOW()
            )`);
        }

        // Migrar emails a nombres una sola vez
        if (!_migrated) {
            _migrated = true;
            const tableCheck = await query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='usuarios')`);
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
            }
        }
        // Migrar correo_electronico para registros existentes (se ejecuta hasta que todos tengan email)
        if (existing.includes('correo_electronico')) {
            // 1) Mapear por nombre en usuarios
            await query(`
                UPDATE reclamos_devoluciones r
                SET correo_electronico = u.email
                FROM usuarios u
                WHERE r.responsable_ingreso = u.nombre
                  AND (r.correo_electronico IS NULL OR r.correo_electronico = '')
                  AND u.email IS NOT NULL
                  AND u.email != ''
            `);
            // 2) Si responsable_ingreso aún tiene un email directo, usarlo
            await query(`
                UPDATE reclamos_devoluciones
                SET correo_electronico = responsable_ingreso
                WHERE (correo_electronico IS NULL OR correo_electronico = '')
                  AND responsable_ingreso LIKE '%@%'
            `);
        }
    } catch(e) { console.error('ensureColumns error:', e.message); }
}

// ═══════════════════════════════════════════════════════
// SETUP - Ejecutar una vez para crear tablas
// ═══════════════════════════════════════════════════════
router.get('/api/reclamos/setup', async (req, res) => {
    try {
        await query(`
            CREATE TABLE IF NOT EXISTS matriz_responsables_motivos (
                id SERIAL PRIMARY KEY,
                responsable VARCHAR(100) NOT NULL,
                motivo VARCHAR(200) NOT NULL,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE UNIQUE INDEX IF NOT EXISTS idx_resp_motivo_unique
                ON matriz_responsables_motivos(responsable, motivo) WHERE activo = TRUE;

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
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON reclamos_devoluciones(estado);
            CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON reclamos_devoluciones(fecha_ingreso);
            CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos_devoluciones(cliente);
            CREATE INDEX IF NOT EXISTS idx_reclamos_numero ON reclamos_devoluciones(numero_reclamo);

            CREATE TABLE IF NOT EXISTS reclamos_historial (
                id SERIAL PRIMARY KEY,
                reclamo_id INTEGER NOT NULL REFERENCES reclamos_devoluciones(id) ON DELETE CASCADE,
                accion VARCHAR(100) NOT NULL,
                estado_antes VARCHAR(30),
                estado_despues VARCHAR(30),
                responsable VARCHAR(200) DEFAULT '',
                observacion TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_reclamos_hist_id ON reclamos_historial(reclamo_id);

            INSERT INTO matriz_responsables_motivos (responsable, motivo) VALUES
                ('CORTE', 'MAL CORTADO'), ('CORTE', 'DIMENSION INCORRECTA'), ('CORTE', 'ESQUINA ROTA'),
                ('PULIDO', 'MAL PULIDO'), ('PULIDO', 'ESCALLA'), ('PULIDO', 'RAYA'), ('PULIDO', 'BORDE IRREGULAR'),
                ('TEMPLE', 'ROTO EN TEMPLE'), ('TEMPLE', 'DEFORME'), ('TEMPLE', 'TENSION INCORRECTA'),
                ('LAMINADO', 'BURBUJA'), ('LAMINADO', 'DELAMINACION'), ('LAMINADO', 'MAL ALINEADO'),
                ('TRANSPORTE', 'GOLPE EN TRANSPORTE'), ('TRANSPORTE', 'RAYA EN TRANSPORTE'), ('TRANSPORTE', 'ROTO EN TRANSPORTE'),
                ('INSTALACION', 'MAL INSTALADO'), ('INSTALACION', 'DAÑO EN OBRA'),
                ('CLIENTE', 'ERROR DE MEDIDA CLIENTE'), ('CLIENTE', 'NO CONFORME CLIENTE'),
                ('PRODUCCION', 'DEFECTO DE FABRICACION'), ('PRODUCCION', 'MATERIAL DEFECTUOSO')
            ON CONFLICT DO NOTHING;
        `);

        // Agregar columnas de workflow si no existen
        const cols = await query(`
            SELECT column_name FROM information_schema.columns WHERE table_name='reclamos_devoluciones'
        `);
        const existing = cols.rows.map(r => r.column_name);

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

        // Migrar correo_electronico para registros existentes
        if (existing.includes('correo_electronico')) {
            await query(`
                UPDATE reclamos_devoluciones r
                SET correo_electronico = u.email
                FROM usuarios u
                WHERE r.responsable_ingreso = u.nombre
                  AND (r.correo_electronico IS NULL OR r.correo_electronico = '')
                  AND u.email IS NOT NULL
                  AND u.email != ''
            `);
            await query(`
                UPDATE reclamos_devoluciones
                SET correo_electronico = responsable_ingreso
                WHERE (correo_electronico IS NULL OR correo_electronico = '')
                  AND responsable_ingreso LIKE '%@%'
            `);
        }

        // Migrar fecha_ingreso de DATE a TIMESTAMP si es necesario
        const colType = await query(`
            SELECT data_type FROM information_schema.columns WHERE table_name='reclamos_devoluciones' AND column_name='fecha_ingreso'
        `);
        if (colType.rows[0] && colType.rows[0].data_type === 'date') {
            await query(`ALTER TABLE reclamos_devoluciones ALTER COLUMN fecha_ingreso TYPE TIMESTAMP USING fecha_ingreso::timestamp`);
        }

        // Crear tabla historial si no existe
        const histCheck = await query(`
            SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='reclamos_historial')
        `);
        if (!histCheck.rows[0].exists) {
            await query(`
                CREATE TABLE IF NOT EXISTS reclamos_historial (
                    id SERIAL PRIMARY KEY,
                    reclamo_id INTEGER NOT NULL REFERENCES reclamos_devoluciones(id) ON DELETE CASCADE,
                    accion VARCHAR(100) NOT NULL,
                    estado_antes VARCHAR(30),
                    estado_despues VARCHAR(30),
                    responsable VARCHAR(200) DEFAULT '',
                    observacion TEXT DEFAULT '',
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_reclamos_hist_id ON reclamos_historial(reclamo_id);
            `);
        }

        res.json({ ok: true, message: 'Tablas creadas, workflow configurado' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// RECLAMOS Y DEVOLUCIONES
// ═══════════════════════════════════════════════════════

// Listar todos (con filtros opcionales)
router.get('/api/reclamos', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const { estado, buscar, fecha_inicio, fecha_fin } = req.query;
        let sql = 'SELECT * FROM reclamos_devoluciones';
        const conditions = [];
        const params = [];
        let idx = 1;

        if (estado && estado !== 'TODOS') {
            conditions.push(`estado = $${idx++}`);
            params.push(estado);
        }
        if (fecha_inicio) {
            conditions.push(`fecha_ingreso >= $${idx++}`);
            params.push(fecha_inicio);
        }
        if (fecha_fin) {
            conditions.push(`fecha_ingreso <= $${idx++}`);
            params.push(fecha_fin);
        }
        if (buscar) {
            conditions.push(`(cliente ILIKE $${idx} OR numero_orden ILIKE $${idx} OR descripcion ILIKE $${idx} OR CAST(numero_reclamo AS TEXT) ILIKE $${idx} OR items::text ILIKE $${idx})`);
            params.push('%' + buscar + '%');
            idx++;
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY numero_reclamo DESC';

        const result = await query(sql, params);
        // Parsear items JSONB
        const rows = result.rows.map(r => {
            if (typeof r.items === 'string') {
                try { r.items = JSON.parse(r.items); } catch(e) { r.items = []; }
            }
            return r;
        });
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dashboard stats
router.get('/api/reclamos/dashboard/stats', perms.view, async (req, res) => {
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
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// MATRIZ DE RESPONSABLES Y MOTIVOS
// ═══════════════════════════════════════════════════════

// Listar todos los responsables únicos
router.get('/api/reclamos/responsables/lista', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const result = await query(
            "SELECT DISTINCT responsable FROM matriz_responsables_motivos WHERE activo = TRUE ORDER BY responsable"
        );
        res.json(result.rows.map(r => r.responsable));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Listar motivos por responsable
router.get('/api/reclamos/motivos/:responsable', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const result = await query(
            "SELECT id, motivo FROM matriz_responsables_motivos WHERE responsable = $1 AND activo = TRUE ORDER BY motivo",
            [req.params.responsable]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Listar toda la matriz
router.get('/api/reclamos/matriz', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const result = await query(
            "SELECT * FROM matriz_responsables_motivos WHERE activo = TRUE ORDER BY responsable, motivo"
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Agregar responsable/motivo
router.post('/api/reclamos/matriz', perms.create, async (req, res) => {
    try {
        await ensureColumns();
        const { responsable, motivo } = req.body;
        if (!responsable || !motivo) return res.status(400).json({ error: 'Responsable y motivo requeridos' });
        const result = await query(
            'INSERT INTO matriz_responsables_motivos (responsable, motivo) VALUES ($1, $2) RETURNING *',
            [responsable.toUpperCase().trim(), motivo.toUpperCase().trim()]
        );
        res.json(result.rows[0]);
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Ya existe esta combinación' });
        res.status(500).json({ error: e.message });
    }
});

// Eliminar responsable/motivo (soft delete)
router.delete('/api/reclamos/matriz/:id', perms.delete, async (req, res) => {
    try {
        await ensureColumns();
        const result = await query(
            'UPDATE matriz_responsables_motivos SET activo = FALSE WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Buscar códigos de producción (para autocomplete en items)
router.get('/api/reclamos/codigos', perms.view, async (req, res) => {
    try {
        const search = req.query.search || '';

        // Verificar que la tabla exista
        const tableCheck = await query(`SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='produccion_codigos')`);
        if (!tableCheck.rows[0].exists) {
            return res.json([]);
        }

        let sql = 'SELECT * FROM produccion_codigos';
        const params = [];
        if (search) {
            sql += ' WHERE codigo ILIKE $1 OR descripcion ILIKE $1 OR grupo ILIKE $1';
            params.push('%' + search + '%');
            sql += ' ORDER BY codigo LIMIT 50';
        } else {
            sql += ' ORDER BY codigo';
        }
        const result = await query(sql, params);
        res.json(result.rows);
    } catch (e) {
        console.error('reclamos/codigos error:', e.message);
        res.json([]);
    }
});

// Reporte de reclamos por anio
router.get('/api/reclamos/reporte', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const anio = parseInt(req.query.anio) || new Date().getFullYear();
        const result = await query(`
            SELECT
                EXTRACT(MONTH FROM fecha_ingreso)::int as mes,
                COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE estado = 'PENDIENTE')::int as pendientes,
                COUNT(*) FILTER (WHERE estado = 'EN REVISION')::int as en_revision,
                COUNT(*) FILTER (WHERE estado = 'EN PROCESO')::int as en_proceso,
                COUNT(*) FILTER (WHERE estado = 'FINALIZADO')::int as finalizados,
                COUNT(*) FILTER (WHERE resolucion = 'Aceptada Fabricacion nueva')::int as fab_nueva,
                COUNT(*) FILTER (WHERE resolucion = 'Aceptada Reproceso')::int as reproceso,
                COUNT(*) FILTER (WHERE resolucion = 'Rechazada')::int as rechazadas,
                COALESCE(NULLIF(COALESCE(responsable_falla,''), ''), 'Sin asignar') as responsable
            FROM reclamos_devoluciones
            WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
            GROUP BY EXTRACT(MONTH FROM fecha_ingreso), responsable_falla
            ORDER BY mes
        `, [anio]);

        const motivoResult = await query(`
            SELECT motivo, COUNT(*)::int as total
            FROM reclamos_devoluciones
            WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1 AND motivo != ''
            GROUP BY motivo ORDER BY total DESC LIMIT 10
        `, [anio]);

        const resolucionResult = await query(`
            SELECT 
                COALESCE(NULLIF(resolucion,''), 'Sin resolver') as resolucion,
                COUNT(*)::int as total
            FROM reclamos_devoluciones
            WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
            GROUP BY resolucion
        `, [anio]);

        // Costo por mes (desde columna calculada)
        let costoResult = { rows: [] };
        try {
            costoResult = await query(`
                SELECT EXTRACT(MONTH FROM fecha_ingreso)::int as mes, COALESCE(SUM(costo_total), 0)::numeric as costo_total
                FROM reclamos_devoluciones
                WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
                GROUP BY EXTRACT(MONTH FROM fecha_ingreso) ORDER BY mes
            `, [anio]);
        } catch(cErr) { console.error('[RECLAMOS] Error costo query:', cErr.message); }

        // Top clientes
        const clienteResult = await query(`
            SELECT COALESCE(NULLIF(cliente,''), 'Sin cliente') as cliente, COUNT(*)::int as total
            FROM reclamos_devoluciones
            WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
            GROUP BY cliente ORDER BY total DESC LIMIT 8
        `, [anio]);

        // Costo por responsable
        let costoRespResult = { rows: [] };
        try {
            costoRespResult = await query(`
                SELECT COALESCE(NULLIF(COALESCE(responsable_falla,''), ''), 'Sin asignar') as responsable,
                       COALESCE(SUM(costo_total), 0)::numeric as costo_total
                FROM reclamos_devoluciones
                WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
                GROUP BY responsable_falla ORDER BY costo_total DESC LIMIT 8
            `, [anio]);
        } catch(cErr) { console.error('[RECLAMOS] Error costo responsable:', cErr.message); }

        // Reclamos por dia de semana (0=Dom, 1=Lun...)
        const diaSemanaResult = await query(`
            SELECT EXTRACT(DOW FROM fecha_ingreso)::int as dia, COUNT(*)::int as total
            FROM reclamos_devoluciones
            WHERE EXTRACT(YEAR FROM fecha_ingreso) = $1
            GROUP BY EXTRACT(DOW FROM fecha_ingreso)
            ORDER BY dia
        `, [anio]);

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

        for (const row of costoResult.rows) {
            const idx = row.mes - 1;
            if (porMes[idx]) porMes[idx].costo = parseFloat(row.costo_total) || 0;
        }

        const mesesData = meses.map((nombre, i) => ({
            nombre,
            ...(porMes[i] || { total:0, pendientes:0, en_revision:0, en_proceso:0, finalizados:0, fab_nueva:0, reproceso:0, rechazadas:0, costo:0 })
        }));

        const totalGeneral = result.rows.reduce((s, r) => s + r.total, 0);
        const totalFinalizados = mesesData.reduce((s, m) => s + m.finalizados, 0);
        const costoTotal = costoResult.rows.reduce((s, r) => s + (parseFloat(r.costo_total) || 0), 0);

        // Mapear dias de semana
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
            costoPorResponsable: costoRespResult.rows.map(r => ({ nombre: r.responsable, total: parseFloat(r.costo_total) || 0 })),
            diasSemana: diasData,
            totalGeneral,
            totalFinalizados,
            costoTotal: Math.round(costoTotal)
        });
    } catch (e) {
        console.error('[RECLAMOS REPORTE ERROR]', e.message);
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// RECLAMOS - CRUD (después de rutas nombradas)
// ═══════════════════════════════════════════════════════

// Obtener uno por ID
router.get('/api/reclamos/:id', perms.view, async (req, res) => {
    try {
        const result = await query('SELECT * FROM reclamos_devoluciones WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crear nuevo reclamo
router.post('/api/reclamos', perms.create, async (req, res) => {
    try {
        await ensureColumns();
        const d = req.body;
        const user = req.headers['x-user-email'] || '';
        const userName = req.headers['x-user-name'] || user;
        const items = Array.isArray(d.items) ? d.items : [];
        const costoTotal = items.reduce((sum, it) => sum + (it.valor_unitario || 0) * (it.cantidad || 1), 0);
        const result = await query(
            `INSERT INTO reclamos_devoluciones (
                responsable_ingreso, correo_electronico, cliente, numero_orden, items,
                descripcion, detalle_reclamo, fotos, estado, costo_total
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8, 'PENDIENTE', $9
            ) RETURNING *`,
            [
                userName || user, user, d.cliente || '', d.numero_orden || '',
                JSON.stringify(items), d.descripcion || '', d.detalle_reclamo || '',
                JSON.stringify(d.fotos || []), costoTotal
            ]
        );
        // Registrar en historial
        const reclamo = result.rows[0];
        await query(
            'INSERT INTO reclamos_historial (reclamo_id, accion, estado_despues, responsable) VALUES ($1, $2, $3, $4)',
            [reclamo.id, 'Creación', 'PENDIENTE', userName || user]
        ).catch(() => {});
        res.json(reclamo);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Actualizar reclamo
router.put('/api/reclamos/:id', perms.update, async (req, res) => {
    try {
        await ensureColumns();
        const d = req.body;
        const items = Array.isArray(d.items) ? d.items : undefined;
        const costoTotal = items ? items.reduce((sum, it) => sum + (it.valor_unitario || 0) * (it.cantidad || 1), 0) : undefined;
        const result = await query(
            `UPDATE reclamos_devoluciones SET
                fecha_ingreso = COALESCE($1, fecha_ingreso),
                responsable_ingreso = COALESCE($2, responsable_ingreso),
                cliente = COALESCE($3, cliente),
                numero_orden = COALESCE($4, numero_orden),
                items = COALESCE($5, items),
                descripcion = COALESCE($6, descripcion),
                detalle_reclamo = COALESCE($7, detalle_reclamo),
                fotos = COALESCE($8, fotos),
                estado = COALESCE($9, estado),
                responsable_falla = COALESCE($10, responsable_falla),
                motivo = COALESCE($11, motivo),
                observacion_analisis = COALESCE($12, observacion_analisis),
                resolucion = COALESCE($13, resolucion),
                costo_total = COALESCE($15, costo_total),
                updated_at = NOW()
            WHERE id = $14 RETURNING *`,
            [
                d.fecha_ingreso, d.responsable_ingreso, d.cliente, d.numero_orden,
                items !== undefined ? JSON.stringify(items) : null, d.descripcion,
                d.detalle_reclamo, d.fotos ? JSON.stringify(d.fotos) : null, d.estado,
                d.responsable_falla, d.motivo, d.observacion_analisis, d.resolucion,
                req.params.id, costoTotal
            ]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Eliminar reclamo
router.delete('/api/reclamos/:id', perms.delete, async (req, res) => {
    try {
        const result = await query('DELETE FROM reclamos_devoluciones WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Cambiar estado rápido
router.put('/api/reclamos/:id/estado', perms.update, async (req, res) => {
    try {
        await ensureColumns();
        const { estado, observacion } = req.body;
        const user = req.headers['x-user-email'] || '';
        const userName = req.headers['x-user-name'] || user;

        // Obtener estado actual
        const before = await query('SELECT estado FROM reclamos_devoluciones WHERE id = $1', [req.params.id]);
        if (before.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        const estadoAntes = before.rows[0].estado;

        // Mapear estado a columnas de tracking
        const columnMap = {
            'EN REVISION': { col: 'fecha_revision', colR: 'responsable_revision' },
            'EN PROCESO': { col: 'fecha_proceso', colR: 'responsable_proceso' },
            'FINALIZADO': { col: 'fecha_fin', colR: 'responsable_fin' }
        };

        let sql = 'UPDATE reclamos_devoluciones SET estado = $1, updated_at = NOW()';
        const params = [estado];
        let idx = 2;

        if (columnMap[estado]) {
            sql += `, ${columnMap[estado].col} = NOW()`;
            sql += `, ${columnMap[estado].colR} = $${idx++}`;
            params.push(userName || user);
        }

        sql += ` WHERE id = $${idx} RETURNING *`;
        params.push(req.params.id);

        const result = await query(sql, params);

        // Registrar en historial
        await query(
            'INSERT INTO reclamos_historial (reclamo_id, accion, estado_antes, estado_despues, responsable, observacion) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.params.id, `Cambio a ${estado}`, estadoAntes, estado, userName || user, observacion || '']
        );

        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Registrar envío por mail
router.post('/api/reclamos/:id/enviar-mail', perms.update, async (req, res) => {
    try {
        await ensureColumns();
        const user = req.headers['x-user-email'] || '';
        const userName = req.headers['x-user-name'] || user;
        await query(
            'INSERT INTO reclamos_historial (reclamo_id, accion, responsable, observacion) VALUES ($1, $2, $3, $4)',
            [req.params.id, 'Envío por mail', userName || user, 'Informe enviado por correo electrónico']
        );
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Historial de un reclamo
router.get('/api/reclamos/:id/historial', perms.view, async (req, res) => {
    try {
        await ensureColumns();
        const result = await query(
            'SELECT * FROM reclamos_historial WHERE reclamo_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
