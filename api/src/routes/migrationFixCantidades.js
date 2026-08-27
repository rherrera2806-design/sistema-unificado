const express = require('express');
const router = express.Router();
const { query } = require('../config/dbPool');

router.get('/api/maintenance/fix-cantidades-bom', async (req, res) => {
    try {
        const result = await query(`
            UPDATE produccion_ordenes po
            SET cantidad = rb.cantidad
            FROM recetas_bom rb
            WHERE po.bom_padre_id = rb.id
              AND po.es_compuesto = TRUE
              AND po.bom_padre_id IS NOT NULL
              AND po.cantidad != rb.cantidad
        `);
        res.json({ ok: true, updated: result.rowCount });
    } catch (e) {
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = router;
