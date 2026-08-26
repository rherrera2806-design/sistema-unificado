const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
const { crudPerms } = require('../middleware/permisos');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vitroflow'
});

const MOD = 'reclamos';
const perms = crudPerms(MOD);

// ═══════════════════════════════════════════════════════
// SETUP - Ejecutar una vez para crear tablas
// ═══════════════════════════════════════════════════════
router.get('/api/reclamos/setup', async (req, res) => {
    try {
        await pool.query(`
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
                fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
                responsable_ingreso VARCHAR(200) DEFAULT '',
                cliente VARCHAR(200) DEFAULT '',
                numero_orden VARCHAR(50) DEFAULT '',
                item VARCHAR(100) DEFAULT '',
                codigo VARCHAR(50) DEFAULT '',
                descripcion TEXT DEFAULT '',
                ancho DECIMAL(10,2) DEFAULT 0,
                alto DECIMAL(10,2) DEFAULT 0,
                espesor DECIMAL(6,2) DEFAULT 0,
                m2 DECIMAL(10,4) DEFAULT 0,
                kg DECIMAL(10,2) DEFAULT 0,
                valor_unitario DECIMAL(12,2) DEFAULT 0,
                detalle_reclamo TEXT DEFAULT '',
                fotos JSONB DEFAULT '[]',
                estado VARCHAR(30) DEFAULT 'PENDIENTE',
                responsable_falla VARCHAR(100) DEFAULT '',
                motivo VARCHAR(200) DEFAULT '',
                observacion_analisis TEXT DEFAULT '',
                resolucion VARCHAR(50) DEFAULT '',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_reclamos_estado ON reclamos_devoluciones(estado);
            CREATE INDEX IF NOT EXISTS idx_reclamos_fecha ON reclamos_devoluciones(fecha_ingreso);
            CREATE INDEX IF NOT EXISTS idx_reclamos_cliente ON reclamos_devoluciones(cliente);
            CREATE INDEX IF NOT EXISTS idx_reclamos_numero ON reclamos_devoluciones(numero_reclamo);

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
        res.json({ ok: true, message: 'Tablas reclamos_devoluciones y matriz_responsables_motivos creadas correctamente' });
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
            conditions.push(`(cliente ILIKE $${idx} OR numero_orden ILIKE $${idx} OR codigo ILIKE $${idx} OR descripcion ILIKE $${idx} OR CAST(numero_reclamo AS TEXT) ILIKE $${idx})`);
            params.push('%' + buscar + '%');
            idx++;
        }

        if (conditions.length > 0) sql += ' WHERE ' + conditions.join(' AND ');
        sql += ' ORDER BY numero_reclamo DESC';

        const result = await pool.query(sql, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Obtener uno por ID
router.get('/api/reclamos/:id', perms.view, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM reclamos_devoluciones WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Crear nuevo reclamo
router.post('/api/reclamos', perms.create, async (req, res) => {
    try {
        const d = req.body;
        const user = req.user || {};
        const result = await pool.query(
            `INSERT INTO reclamos_devoluciones (
                fecha_ingreso, responsable_ingreso, cliente, numero_orden, item, codigo,
                descripcion, ancho, alto, espesor, m2, kg, valor_unitario,
                detalle_reclamo, fotos, estado, responsable_falla, motivo,
                observacion_analisis, resolucion
            ) VALUES (
                COALESCE($1, CURRENT_DATE), $2, $3, $4, $5, $6,
                $7, $8, $9, $10, $11, $12, $13,
                $14, $15, COALESCE($16, 'PENDIENTE'), $17, $18,
                $19, $20
            ) RETURNING *`,
            [
                d.fecha_ingreso || null, d.responsable_ingreso || user.email || '', d.cliente || '', d.numero_orden || '', d.item || '', d.codigo || '',
                d.descripcion || '', d.ancho || 0, d.alto || 0, d.espesor || 0, d.m2 || 0, d.kg || 0, d.valor_unitario || 0,
                d.detalle_reclamo || '', JSON.stringify(d.fotos || []), d.estado || 'PENDIENTE', d.responsable_falla || '', d.motivo || '',
                d.observacion_analisis || '', d.resolucion || ''
            ]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Actualizar reclamo
router.put('/api/reclamos/:id', perms.update, async (req, res) => {
    try {
        const d = req.body;
        const result = await pool.query(
            `UPDATE reclamos_devoluciones SET
                fecha_ingreso = COALESCE($1, fecha_ingreso),
                responsable_ingreso = COALESCE($2, responsable_ingreso),
                cliente = COALESCE($3, cliente),
                numero_orden = COALESCE($4, numero_orden),
                item = COALESCE($5, item),
                codigo = COALESCE($6, codigo),
                descripcion = COALESCE($7, descripcion),
                ancho = COALESCE($8, ancho),
                alto = COALESCE($9, alto),
                espesor = COALESCE($10, espesor),
                m2 = COALESCE($11, m2),
                kg = COALESCE($12, kg),
                valor_unitario = COALESCE($13, valor_unitario),
                detalle_reclamo = COALESCE($14, detalle_reclamo),
                fotos = COALESCE($15, fotos),
                estado = COALESCE($16, estado),
                responsable_falla = COALESCE($17, responsable_falla),
                motivo = COALESCE($18, motivo),
                observacion_analisis = COALESCE($19, observacion_analisis),
                resolucion = COALESCE($20, resolucion),
                updated_at = NOW()
            WHERE id = $21 RETURNING *`,
            [
                d.fecha_ingreso, d.responsable_ingreso, d.cliente, d.numero_orden, d.item, d.codigo,
                d.descripcion, d.ancho, d.alto, d.espesor, d.m2, d.kg, d.valor_unitario,
                d.detalle_reclamo, d.fotos ? JSON.stringify(d.fotos) : null, d.estado,
                d.responsable_falla, d.motivo, d.observacion_analisis, d.resolucion,
                req.params.id
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
        const result = await pool.query('DELETE FROM reclamos_devoluciones WHERE id = $1 RETURNING id', [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Cambiar estado rápido
router.put('/api/reclamos/:id/estado', perms.update, async (req, res) => {
    try {
        const { estado } = req.body;
        const result = await pool.query(
            'UPDATE reclamos_devoluciones SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [estado, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Dashboard stats
router.get('/api/reclamos/dashboard/stats', perms.view, async (req, res) => {
    try {
        const result = await pool.query(`
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
        const result = await pool.query(
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
        const result = await pool.query(
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
        const result = await pool.query(
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
        const { responsable, motivo } = req.body;
        if (!responsable || !motivo) return res.status(400).json({ error: 'Responsable y motivo requeridos' });
        const result = await pool.query(
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
        const result = await pool.query(
            'UPDATE matriz_responsables_motivos SET activo = FALSE WHERE id = $1 RETURNING id',
            [req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'No encontrado' });
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
