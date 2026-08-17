const express = require('express');
const router = express.Router();
const costeoService = require('../services/costeoService');
const { requireAnyPerm } = require('../middleware/permisos');

const MOD = 'costeo';
const canView   = requireAnyPerm(MOD, `${MOD}.editar`, `${MOD}.eliminar`, `${MOD}.agregar`);
const canCreate = requireAnyPerm(`${MOD}.agregar`, MOD);
const canUpdate = requireAnyPerm(`${MOD}.editar`, MOD);
const canDelete = requireAnyPerm(`${MOD}.eliminar`, MOD);

// GET /api/costeo/config — Obtener parámetros de costos
router.get('/api/costeo/config', canView, async (req, res) => {
    try {
        const config = await costeoService.getConfig();
        res.json(config);
    } catch (e) {
        console.error('Error getting costeo config:', e);
        res.status(500).json({ error: 'Error al obtener configuración de costos' });
    }
});

// PUT /api/costeo/config — Actualizar un parámetro de costo
router.put('/api/costeo/config', canUpdate, async (req, res) => {
    try {
        const { clave, valor } = req.body;
        if (!clave) return res.status(400).json({ error: 'Falta la clave del parámetro' });
        await costeoService.updateConfig(clave, parseFloat(valor) || 0);
        res.json({ ok: true, mensaje: `Parámetro ${clave} actualizado` });
    } catch (e) {
        console.error('Error updating costeo config:', e);
        res.status(500).json({ error: 'Error al actualizar configuración' });
    }
});

// GET /api/costeo/config/export — Exportar configuración como JSON
router.get('/api/costeo/config/export', canView, async (req, res) => {
    try {
        const config = await costeoService.getConfig();
        res.setHeader('Content-Disposition', 'attachment; filename=costos_config.json');
        res.json(config);
    } catch (e) {
        console.error('Error exporting config:', e);
        res.status(500).json({ error: 'Error al exportar configuración' });
    }
});

// POST /api/costeo/config/import — Importar configuración desde JSON
router.post('/api/costeo/config/import', canUpdate, async (req, res) => {
    try {
        const config = req.body;
        if (!config || typeof config !== 'object') {
            return res.status(400).json({ error: 'Formato inválido' });
        }
        let count = 0;
        for (const [clave, data] of Object.entries(config)) {
            if (data && typeof data.valor === 'number') {
                await costeoService.updateConfig(clave, data.valor);
                count++;
            }
        }
        res.json({ ok: true, mensaje: `${count} parámetros importados correctamente` });
    } catch (e) {
        console.error('Error importing config:', e);
        res.status(500).json({ error: 'Error al importar configuración' });
    }
});

// GET /api/costeo/cristales — Lista de cristales para selector
router.get('/api/costeo/cristales', canView, async (req, res) => {
    try {
        const cristales = await costeoService.getCristales();
        res.json(cristales);
    } catch (e) {
        console.error('Error getting cristales:', e);
        res.status(500).json({ error: 'Error al obtener cristales' });
    }
});

// POST /api/costeo/calcular — Calcular costos
router.post('/api/costeo/calcular', canView, async (req, res) => {
    try {
        const {
            cristal_id, origen, ancho, alto, proceso, tipo_pulido,
            n_perforaciones, n_destajes, destaje_complejo,
            pintado_color, area_pintado, margen_esperado
        } = req.body;

        if (!cristal_id) return res.status(400).json({ error: 'Seleccione un cristal' });
        if (!ancho || !alto) return res.status(400).json({ error: 'Ingrese las medidas (ancho y alto)' });

        const resultado = await costeoService.calcular({
            cristal_id, origen, ancho, alto, proceso, tipo_pulido,
            n_perforaciones, n_destajes, destaje_complejo,
            pintado_color, area_pintado, margen_esperado
        });

        res.json(resultado);
    } catch (e) {
        console.error('Error calculating costos:', e);
        res.status(500).json({ error: 'Error al calcular costos' });
    }
});

module.exports = router;
