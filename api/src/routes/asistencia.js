const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/vitroflow'
});

// ═══════════════════════════════════════════════════════
// TRABAJADORES
// ═══════════════════════════════════════════════════════

router.get('/api/asistencia/trabajadores', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM trabajadores ORDER BY activo DESC, nombre'
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/trabajadores/activos', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM trabajadores WHERE activo = true ORDER BY nombre'
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/api/asistencia/trabajadores', async (req, res) => {
    try {
        const { rut, nombre } = req.body;
        const result = await pool.query(
            'INSERT INTO trabajadores (rut, nombre) VALUES ($1, $2) RETURNING *',
            [rut, nombre]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/asistencia/trabajadores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, rut, activo } = req.body;
        const result = await pool.query(
            'UPDATE trabajadores SET nombre = COALESCE($1, nombre), rut = COALESCE($2, rut), activo = COALESCE($3, activo) WHERE id = $4 RETURNING *',
            [nombre, rut, activo, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/api/asistencia/trabajadores/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM trabajadores WHERE id = $1', [id]);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// ASISTENCIA DIARIA
// ═══════════════════════════════════════════════════════

router.post('/api/asistencia/marcar', async (req, res) => {
    try {
        const { trabajador_id, falta } = req.body;
        const hoy = new Date().toISOString().split('T')[0];
        
        const existing = await pool.query(
            'SELECT * FROM asistencia WHERE trabajador_id = $1 AND fecha = $2',
            [trabajador_id, hoy]
        );
        
        if (existing.rows.length > 0) {
            if (falta) {
                await pool.query(
                    'DELETE FROM asistencia WHERE trabajador_id = $1 AND fecha = $2',
                    [trabajador_id, hoy]
                );
                return res.json({ eliminado: true });
            }
            return res.json(existing.rows[0]);
        }
        
        if (falta) {
            const result = await pool.query(
                'INSERT INTO asistencia (trabajador_id, fecha) VALUES ($1, $2) RETURNING *',
                [trabajador_id, hoy]
            );
            return res.json(result.rows[0]);
        }
        
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/diaria', async (req, res) => {
    try {
        const { fecha } = req.query;
        const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
        
        const result = await pool.query(
            `SELECT a.fecha, a.trabajador_id, t.nombre, t.rut, t.created_at 
             FROM asistencia a 
             JOIN trabajadores t ON a.trabajador_id = t.id 
             WHERE a.fecha = $1 
             ORDER BY t.nombre`,
            [fechaConsulta]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// PERMISOS
// ═══════════════════════════════════════════════════════

router.post('/api/asistencia/permisos', async (req, res) => {
    try {
        const { trabajador_id, fecha_inicio, fecha_fin, motivo, tipo, horas } = req.body;
        const result = await pool.query(
            `INSERT INTO permisos (trabajador_id, fecha_inicio, fecha_fin, motivo, tipo, horas)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [trabajador_id, fecha_inicio, fecha_fin, motivo, tipo, horas || 0]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/permisos', async (req, res) => {
    try {
        const { trabajador_id, mes, anio } = req.query;
        let query = `SELECT p.*, t.nombre, t.rut 
                     FROM permisos p 
                     JOIN trabajadores t ON p.trabajador_id = t.id 
                     WHERE 1=1`;
        const params = [];
        
        if (trabajador_id) {
            params.push(trabajador_id);
            query += ` AND p.trabajador_id = $${params.length}`;
        }
        if (mes && anio) {
            params.push(mes, anio);
            query += ` AND EXTRACT(MONTH FROM p.fecha_inicio) = $${params.length - 1} 
                       AND EXTRACT(YEAR FROM p.fecha_inicio) = $${params.length}`;
        }
        
        query += ' ORDER BY p.fecha_inicio DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/asistencia/permisos/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        const result = await pool.query(
            'UPDATE permisos SET estado = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT - Editar permiso
router.put('/api/asistencia/permisos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { trabajador_id, tipo, fecha_inicio, fecha_fin, motivo, horas } = req.body;
        const result = await pool.query(
            `UPDATE permisos SET trabajador_id = $1, tipo = $2, fecha_inicio = $3, fecha_fin = $4, motivo = $5, horas = $6 WHERE id = $7 RETURNING *`,
            [trabajador_id, tipo, fecha_inicio, fecha_fin, motivo, horas || 0, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE - Eliminar permiso
router.delete('/api/asistencia/permisos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM permisos WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// VACACIONES
// ═══════════════════════════════════════════════════════

router.post('/api/asistencia/vacaciones', async (req, res) => {
    try {
        const { trabajador_id, fecha_inicio, fecha_fin, dias } = req.body;
        const result = await pool.query(
            `INSERT INTO vacaciones (trabajador_id, fecha_inicio, fecha_fin, dias)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [trabajador_id, fecha_inicio, fecha_fin, dias]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/vacaciones', async (req, res) => {
    try {
        const { trabajador_id } = req.query;
        let query = `SELECT v.*, t.nombre, t.rut 
                     FROM vacaciones v 
                     JOIN trabajadores t ON v.trabajador_id = t.id 
                     WHERE 1=1`;
        const params = [];
        
        if (trabajador_id) {
            params.push(trabajador_id);
            query += ` AND v.trabajador_id = $${params.length}`;
        }
        
        query += ' ORDER BY v.fecha_inicio DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT - Editar vacación
router.put('/api/asistencia/vacaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { trabajador_id, fecha_inicio, fecha_fin, dias } = req.body;
        const result = await pool.query(
            `UPDATE vacaciones SET trabajador_id = $1, fecha_inicio = $2, fecha_fin = $3, dias = $4 WHERE id = $5 RETURNING *`,
            [trabajador_id, fecha_inicio, fecha_fin, dias, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE - Eliminar vacación
router.delete('/api/asistencia/vacaciones/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM vacaciones WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// CALENDARIO MENSUAL
// ═══════════════════════════════════════════════════════

router.get('/api/asistencia/calendario', async (req, res) => {
    try {
        const mesActual = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const anioActual = parseInt(req.query.anio) || new Date().getFullYear();
        const mesStr = String(mesActual).padStart(2, '0');
        const fechaInicio = anioActual + '-' + mesStr + '-01';
        const fechaFin = anioActual + '-' + mesStr + '-28';
        
        const trabajadores = await pool.query(
            'SELECT * FROM trabajadores WHERE activo = true ORDER BY nombre'
        );
        
        const faltas = await pool.query(
            `SELECT trabajador_id, fecha FROM asistencia 
             WHERE fecha >= $1::date AND fecha <= $2::date`,
            [fechaInicio, fechaFin]
        );
        
        const vacaciones = await pool.query(
            `SELECT trabajador_id, fecha_inicio, fecha_fin FROM vacaciones 
             WHERE fecha_inicio <= $2::date 
             AND (fecha_fin >= $1::date OR fecha_fin IS NULL)`,
            [fechaInicio, fechaFin]
        );
        
        const licencias = await pool.query(
            `SELECT trabajador_id, fecha_inicio, fecha_fin FROM licencias_medicas 
             WHERE fecha_inicio <= $2::date 
             AND (fecha_fin >= $1::date OR fecha_fin IS NULL)`,
            [fechaInicio, fechaFin]
        );
        
        res.json({
            trabajadores: trabajadores.rows,
            faltas: faltas.rows,
            vacaciones: vacaciones.rows,
            licencias: licencias.rows,
            mes: mesActual,
            anio: anioActual
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// LICENCIAS MÉDICAS
// ═══════════════════════════════════════════════════════

router.post('/api/asistencia/licencias', async (req, res) => {
    try {
        const { trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico } = req.body;
        const result = await pool.query(
            `INSERT INTO licencias_medicas (trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/licencias', async (req, res) => {
    try {
        const { trabajador_id, mes, anio } = req.query;
        let query = `SELECT l.*, t.nombre, t.rut 
                     FROM licencias_medicas l 
                     JOIN trabajadores t ON l.trabajador_id = t.id 
                     WHERE 1=1`;
        const params = [];
        
        if (trabajador_id) {
            params.push(trabajador_id);
            query += ` AND l.trabajador_id = $${params.length}`;
        }
        if (mes && anio) {
            params.push(mes, anio);
            query += ` AND (EXTRACT(MONTH FROM l.fecha_inicio) = $${params.length - 1} 
                       OR EXTRACT(MONTH FROM l.fecha_fin) = $${params.length - 1})
                       AND EXTRACT(YEAR FROM l.fecha_inicio) = $${params.length}`;
        }
        
        query += ' ORDER BY l.fecha_inicio DESC';
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/asistencia/licencias/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        const result = await pool.query(
            'UPDATE licencias_medicas SET estado = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// PUT - Editar licencia
router.put('/api/asistencia/licencias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico } = req.body;
        const result = await pool.query(
            `UPDATE licencias_medicas SET trabajador_id = $1, fecha_inicio = $2, fecha_fin = $3, diagnostico = $4, medico = $5 WHERE id = $6 RETURNING *`,
            [trabajador_id, fecha_inicio, fecha_fin, diagnostico, medico, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE - Eliminar licencia
router.delete('/api/asistencia/licencias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM licencias_medicas WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// REPORTES Y RANKINGS
// ═══════════════════════════════════════════════════════

router.get('/api/asistencia/reporte-mensual', async (req, res) => {
    try {
        const mesActual = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const anioActual = parseInt(req.query.anio) || new Date().getFullYear();
        const mesStr = String(mesActual).padStart(2, '0');
        const siguienteMes = mesActual === 12 ? 1 : mesActual + 1;
        const siguienteAnio = mesActual === 12 ? anioActual + 1 : anioActual;
        const sigMesStr = String(siguienteMes).padStart(2, '0');
        const fechaInicio = anioActual + '-' + mesStr + '-01';
        const fechaFin = siguienteAnio + '-' + sigMesStr + '-01';
        
        const result = await pool.query(
            `SELECT 
                t.id,
                t.nombre,
                t.rut,
                (SELECT COUNT(*) FROM asistencia a 
                 WHERE a.trabajador_id = t.id 
                 AND a.fecha >= $1::date AND a.fecha < $2::date) as faltas,
                (SELECT COALESCE(SUM(COALESCE(p.horas, 0)) / 8.0, 0) FROM permisos p 
                 WHERE p.trabajador_id = t.id 
                 AND p.fecha_inicio >= $1::date
                 AND p.fecha_inicio < $2::date
                 AND p.estado = 'aprobado') as permisos_aprobados,
                (SELECT COALESCE(SUM(
                    CASE 
                        WHEN l.fecha_fin IS NULL OR l.fecha_fin < l.fecha_inicio THEN 1
                        ELSE (LEAST(l.fecha_fin, ($2::date - 1)::date) - GREATEST(l.fecha_inicio, $1::date)) + 1
                    END
                ), 0) FROM licencias_medicas l 
                 WHERE l.trabajador_id = t.id 
                 AND l.fecha_inicio < $2::date
                 AND (l.fecha_fin IS NULL OR l.fecha_fin >= $1::date)
                 AND l.estado = 'aprobada') as dias_licencia,
                (SELECT COALESCE(SUM(
                    CASE 
                        WHEN v.fecha_fin IS NULL OR v.fecha_fin < v.fecha_inicio THEN COALESCE(v.dias, 1)
                        ELSE (LEAST(v.fecha_fin, ($2::date - 1)::date) - GREATEST(v.fecha_inicio, $1::date)) + 1
                    END
                ), 0) FROM vacaciones v 
                 WHERE v.trabajador_id = t.id 
                 AND v.fecha_inicio < $2::date
                 AND (v.fecha_fin IS NULL OR v.fecha_fin >= $1::date)) as dias_vacaciones,
                (SELECT COALESCE(SUM(he.horas), 0) FROM horas_extras he 
                 WHERE he.trabajador_id = t.id 
                 AND he.fecha >= $1::date AND he.fecha < $2::date
                 AND he.estado = 'aprobada') as horas_extras
             FROM trabajadores t
             WHERE t.activo = true
             ORDER BY t.nombre`,
            [fechaInicio, fechaFin]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/asistencia/ranking', async (req, res) => {
    try {
        const mesActual = parseInt(req.query.mes) || new Date().getMonth() + 1;
        const anioActual = parseInt(req.query.anio) || new Date().getFullYear();
        const mesStr = String(mesActual).padStart(2, '0');
        const siguienteMes = mesActual === 12 ? 1 : mesActual + 1;
        const siguienteAnio = mesActual === 12 ? anioActual + 1 : anioActual;
        const sigMesStr = String(siguienteMes).padStart(2, '0');
        const fechaInicio = anioActual + '-' + mesStr + '-01';
        const fechaFin = siguienteAnio + '-' + sigMesStr + '-01';
        
         const result = await pool.query(
            `SELECT * FROM (
                SELECT 
                    t.id,
                    t.nombre,
                    (SELECT COUNT(*) FROM asistencia a 
                     WHERE a.trabajador_id = t.id 
                     AND a.fecha >= $1::date AND a.fecha < $2::date) as faltas,
                    (SELECT COALESCE(SUM(COALESCE(p.horas, 0)) / 8.0, 0) FROM permisos p 
                     WHERE p.trabajador_id = t.id 
                     AND p.fecha_inicio >= $1::date
                     AND p.fecha_inicio < $2::date
                     AND p.estado = 'aprobado') as permisos_dias,
                    (SELECT COALESCE(SUM(
                        CASE 
                            WHEN l.fecha_fin IS NULL OR l.fecha_fin < l.fecha_inicio THEN 1
                            ELSE (LEAST(l.fecha_fin, ($2::date - 1)::date) - GREATEST(l.fecha_inicio, $1::date)) + 1
                        END
                    ), 0) FROM licencias_medicas l 
                     WHERE l.trabajador_id = t.id 
                     AND l.fecha_inicio < $2::date
                     AND (l.fecha_fin IS NULL OR l.fecha_fin >= $1::date)
                     AND l.estado = 'aprobada') as licencias_dias,
                    (SELECT COALESCE(SUM(
                        CASE 
                            WHEN v.fecha_fin IS NULL OR v.fecha_fin < v.fecha_inicio THEN COALESCE(v.dias, 1)
                            ELSE (LEAST(v.fecha_fin, ($2::date - 1)::date) - GREATEST(v.fecha_inicio, $1::date)) + 1
                        END
                    ), 0) FROM vacaciones v 
                     WHERE v.trabajador_id = t.id 
                     AND v.fecha_inicio < $2::date
                     AND (v.fecha_fin IS NULL OR v.fecha_fin >= $1::date)) as vacaciones_dias
                 FROM trabajadores t
                 WHERE t.activo = true
             ) sub
             ORDER BY (faltas + permisos_dias + licencias_dias + vacaciones_dias) DESC
             LIMIT 10`,
            [fechaInicio, fechaFin]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════

router.get('/api/asistencia/dashboard', async (req, res) => {
    try {
        const now = new Date();
        const mesActual = now.getMonth() + 1;
        const anioActual = now.getFullYear();

        const faltas = await pool.query(
            `SELECT COUNT(*) as total FROM asistencia 
             WHERE EXTRACT(MONTH FROM fecha) = $1 AND EXTRACT(YEAR FROM fecha) = $2`,
            [mesActual, anioActual]
        );

        const licencias = await pool.query(
            `SELECT COUNT(*) as total, 
                    COALESCE(SUM(licencias_medicas.fecha_fin - licencias_medicas.fecha_inicio + 1), 0) as dias
             FROM licencias_medicas 
             WHERE EXTRACT(MONTH FROM fecha_inicio) = $1 AND EXTRACT(YEAR FROM fecha_inicio) = $2
             AND estado != 'rechazada'`,
            [mesActual, anioActual]
        );

        const vacaciones = await pool.query(
            `SELECT COUNT(*) as trabajadores, COALESCE(SUM(dias), 0) as total_dias
             FROM vacaciones 
             WHERE EXTRACT(MONTH FROM fecha_inicio) = $1 AND EXTRACT(YEAR FROM fecha_inicio) = $2
             AND estado != 'rechazado'`,
            [mesActual, anioActual]
        );

        const trabajadores = await pool.query(
            `SELECT COUNT(*) as total FROM trabajadores WHERE activo = true`
        );

        res.json({
            faltas: parseInt(faltas.rows[0].total),
            licencias: parseInt(licencias.rows[0].total),
            licencias_dias: parseInt(licencias.rows[0].dias),
            vacaciones: parseInt(vacaciones.rows[0].total_dias),
            vacaciones_trabajadores: parseInt(vacaciones.rows[0].trabajadores),
            trabajadores_total: parseInt(trabajadores.rows[0].total)
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ═══════════════════════════════════════════════════════
// HORAS EXTRAS
// ═══════════════════════════════════════════════════════

router.get('/api/asistencia/horas-extras', async (req, res) => {
    try {
        const { mes, anio } = req.query;
        const mesActual = mes || new Date().getMonth() + 1;
        const anioActual = anio || new Date().getFullYear();
        const result = await pool.query(
            `SELECT he.*, t.nombre 
             FROM horas_extras he 
             JOIN trabajadores t ON he.trabajador_id = t.id 
             WHERE EXTRACT(MONTH FROM he.fecha) = $1 AND EXTRACT(YEAR FROM he.fecha) = $2
             ORDER BY he.fecha DESC, t.nombre`,
            [mesActual, anioActual]
        );
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/api/asistencia/horas-extras', async (req, res) => {
    try {
        const { trabajador_id, fecha, horas, motivo } = req.body;
        const result = await pool.query(
            `INSERT INTO horas_extras (trabajador_id, fecha, horas, motivo) 
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [trabajador_id, fecha, horas, motivo]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/asistencia/horas-extras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { trabajador_id, fecha, horas, motivo } = req.body;
        const result = await pool.query(
            `UPDATE horas_extras SET trabajador_id = $1, fecha = $2, horas = $3, motivo = $4 WHERE id = $5 RETURNING *`,
            [trabajador_id, fecha, horas, motivo, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/api/asistencia/horas-extras/:id/estado', async (req, res) => {
    try {
        const { id } = req.params;
        const { estado } = req.body;
        const result = await pool.query(
            'UPDATE horas_extras SET estado = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        );
        res.json(result.rows[0]);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/api/asistencia/horas-extras/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query('DELETE FROM horas_extras WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
