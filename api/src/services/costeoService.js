const { query } = require('../config/dbPool');

class CosteoService {
    /**
     * Obtener todos los parámetros de costos_config
     */
    async getConfig() {
        const result = await query('SELECT clave, valor, descripcion, unidad FROM costos_config ORDER BY id');
        const config = {};
        for (const row of result.rows) {
            config[row.clave] = { valor: parseFloat(row.valor), descripcion: row.descripcion, unidad: row.unidad };
        }
        return config;
    }

    /**
     * Actualizar un parámetro de costo (upsert)
     */
    async updateConfig(clave, valor) {
        await query(
            `INSERT INTO costos_config (clave, valor) VALUES ($1, $2)
             ON CONFLICT (clave) DO UPDATE SET valor = $2`,
            [clave, valor]
        );
    }

    /**
     * Obtener lista de materias primas (cristales) para selector
     */
    async getCristales() {
        const result = await query(
            'SELECT id, codigo_mp, nombre, espesor_mm, costo_unitario_mp, costo_unitario_importado FROM materias_primas WHERE costo_unitario_mp > 0 ORDER BY nombre'
        );
        return result.rows;
    }

    /**
     * MOTOR DE CÁLCULO PRINCIPAL
     * Recibe los datos de entrada y retorna el desglose completo de costos
     */
    async calcular({
        cristal_id,
        ancho,
        alto,
        tipo_pulido,
        n_perforaciones,
        n_destajes,
        destaje_complejo,
        pintado_color,
        area_pintado,
        margen_esperado
    }) {
        // 1. Obtener configuración
        const config = await this.getConfig();
        const costo_hh = config.costo_hh?.valor || 0;
        const costo_energia = config.costo_energia_m2?.valor || 0;
        const costo_pulido_ml = config.costo_pulido_ml?.valor || 0;
        const costo_perforacion = config.costo_perforacion?.valor || 0;
        const costo_destaje_kg = config.costo_destaje_kg?.valor || 0;
        const costo_destaje_complejo = config.costo_destaje_complejo_kg?.valor || 0;
        const costo_pintura_ml = config.costo_pintura_ml?.valor || 0;
        const costo_insumos_pintura = config.costo_insumos_pintura?.valor || 0;
        const costo_otros_m2 = config.costo_otros_m2?.valor || 0;
        const merma_proceso_pct = config.merma_proceso_pct?.valor || 0;
        const merma_aprovechamiento_pct = config.merma_aprovechamiento_pct?.valor || 0;

        // 2. Obtener precio del cristal
        let precio_cristal = 0;
        let nombre_cristal = '';
        if (cristal_id) {
            const cristalResult = await query(
                'SELECT nombre, costo_unitario_mp FROM materias_primas WHERE id = $1',
                [cristal_id]
            );
            if (cristalResult.rows.length > 0) {
                precio_cristal = parseFloat(cristalResult.rows[0].costo_unitario_mp) || 0;
                nombre_cristal = cristalResult.rows[0].nombre;
            }
        }

        // 3. Calcular área en m²
        const anchoNum = parseFloat(ancho) || 0;
        const altoNum = parseFloat(alto) || 0;
        const area_m2 = (anchoNum * altoNum) / 1000000;

        // 4. Cálculos individuales
        const materia_prima = area_m2 * precio_cristal;
        const hh = area_m2 * costo_hh;
        const energia = area_m2 * costo_energia;
        const pulido = (parseFloat(tipo_pulido) || 0) * costo_pulido_ml;
        const perforado = (parseInt(n_perforaciones) || 0) * costo_perforacion;

        // Destaje: si es complejo usa costo_destaje_complejo, si no usa costo_destaje_kg
        const destajeUnits = parseInt(n_destajes) || 0;
        const factor_destaje = destaje_complejo ? costo_destaje_complejo : costo_destaje_kg;
        const destaje = destajeUnits * factor_destaje;

        const pintura = (parseFloat(area_pintado) || 0) * (pintado_color ? costo_pintura_ml : 0);
        const insumos_pintura = (parseFloat(area_pintado) || 0) * (pintado_color ? costo_insumos_pintura : 0);
        const otros = area_m2 * costo_otros_m2;

        // 5. (A) COSTO SIN MERMAS
        const costo_sin_mermas = materia_prima + hh + energia + pulido + perforado + destaje + pintura + insumos_pintura + otros;

        // 6. (B) COSTO DE MERMAS
        const merma_proceso = costo_sin_mermas * (merma_proceso_pct / 100);
        const merma_aprovechamiento = costo_sin_mermas * (merma_aprovechamiento_pct / 100);
        const costo_mermas = merma_proceso + merma_aprovechamiento;

        // 7. TOTAL COSTO
        const total_costo = costo_sin_mermas + costo_mermas;

        // 8. VALOR DE VENTA Y GANANCIA
        const margen = parseFloat(margen_esperado) || 0;
        const divisor = 1 - (margen / 100);
        const valor_venta = divisor > 0 ? total_costo / divisor : total_costo;
        const ganancia = valor_venta - total_costo;

        return {
            // Datos de entrada
            cristal: nombre_cristal,
            ancho: anchoNum,
            alto: altoNum,
            area_m2: Math.round(area_m2 * 10000) / 10000,
            precio_cristal,
            tipo_pulido: parseFloat(tipo_pulido) || 0,
            n_perforaciones: parseInt(n_perforaciones) || 0,
            n_destajes: destajeUnits,
            destaje_complejo: !!destaje_complejo,
            pintado_color: !!pintado_color,
            area_pintado: parseFloat(area_pintado) || 0,
            margen_esperado: margen,

            // Desglose de costos
            materia_prima: Math.round(materia_prima),
            hh: Math.round(hh),
            energia: Math.round(energia),
            pulido: Math.round(pulido),
            perforado: Math.round(perforado),
            destaje: Math.round(destaje),
            pintura: Math.round(pintura),
            insumos_pintura: Math.round(insumos_pintura),
            otros: Math.round(otros),

            // Totales
            costo_sin_mermas: Math.round(costo_sin_mermas),
            merma_proceso: Math.round(merma_proceso),
            merma_aprovechamiento: Math.round(merma_aprovechamiento),
            costo_mermas: Math.round(costo_mermas),
            total_costo: Math.round(total_costo),

            // Venta
            valor_venta: Math.round(valor_venta),
            ganancia: Math.round(ganancia),

            // Configuración usada (para referencia)
            _config: {
                costo_hh, costo_energia, costo_pulido_ml, costo_perforacion,
                costo_destaje_kg, costo_destaje_complejo, costo_pintura_ml,
                costo_insumos_pintura, merma_proceso_pct, merma_aprovechamiento_pct
            }
        };
    }
}

module.exports = new CosteoService();
