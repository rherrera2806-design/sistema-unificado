const { query } = require('../config/database');
const { getPasos, actualizarPaso, eliminarPaso, agregarPaso, crearPasos } = require('./produccionPasos');

const getOrdenes = async () => {
    const result = await query(`
        SELECT o.*,
            (SELECT COUNT(*) FROM cola_produccion_pasos p WHERE p.orden_produccion_id = o.id) as total_pasos,
            (SELECT COUNT(*) FROM cola_produccion_pasos p WHERE p.orden_produccion_id = o.id AND p.estado = 'TERMINADO') as pasos_terminados,
            CASE WHEN o.codigo_padre IS NOT NULL THEN
                COALESCE(
                    (SELECT cc.descripcion FROM produccion_codigos cc WHERE cc.codigo = o.codigo_padre),
                    o.codigo_padre
                )
            ELSE NULL END as nombre_codigo_padre,
            (SELECT CASE WHEN mp.espesor_mm IS NOT NULL THEN mp.nombre || ' ' || CAST(CAST(mp.espesor_mm AS INT) AS VARCHAR) || 'mm'
             ELSE COALESCE(mp.nombre, o.descripcion, '') END
             FROM materias_primas mp
             WHERE mp.codigo_mp = o.codigo_producto LIMIT 1) as nombre_mp,
            (SELECT f.nombre_familia FROM familias_producto f WHERE f.id = o.familia_id) as familia_nombre,
            (SELECT em.nombre_estacion FROM cola_produccion_pasos cp
             JOIN estaciones_maestras em ON cp.estacion_id = em.id
             WHERE cp.orden_produccion_id = o.id AND em.cuello_botella = TRUE
             AND (
                 SELECT COUNT(*) FROM produccion_ordenes o2
                 WHERE o2.id != o.id
                   AND o2.codigo_producto = o.codigo_producto
                   AND o2.cliente = o.cliente
                   AND o2.item_numero = o.item_numero
                   AND o2.fecha_programada IS NOT NULL
             ) > 0
             ORDER BY em.cap_max ASC LIMIT 1) as cuello_botella,
            ARRAY(
                SELECT em.nombre_estacion FROM cola_produccion_pasos cp
                JOIN estaciones_maestras em ON cp.estacion_id = em.id
                WHERE cp.orden_produccion_id = o.id
                ORDER BY cp.orden_secuencia
            ) as estaciones
        FROM produccion_ordenes o ORDER BY o.created_at DESC
    `);
    return result.rows;
};

const buscarFamilia = async (codigo) => {
    const codInfo = await query('SELECT familia FROM produccion_codigos WHERE codigo = $1', [codigo]);
    if (!codInfo.rows.length || !codInfo.rows[0].familia) return null;
    const nombreFam = codInfo.rows[0].familia;
    const famRes = await query(
        'SELECT * FROM familias_producto WHERE UPPER(nombre_familia) = UPPER($1) OR UPPER(codigo_familia) = UPPER($1)',
        [nombreFam]
    );
    return famRes.rows.length > 0 ? famRes.rows[0] : null;
};

const getEstacionesBase = async (familia, perforaciones, pintado, codigoSap) => {
    if (codigoSap) {
        const custRes = await query(
            `SELECT r.procesos_especificos_json, r.familia_id
             FROM recetas_bom r
             WHERE r.codigo_sap_padre = $1
               AND r.procesos_especificos_json IS NOT NULL
             LIMIT 1`,
            [String(codigoSap).trim()]
        );
        if (custRes.rows.length > 0) {
            let ids = [];
            try {
                const raw = custRes.rows[0].procesos_especificos_json;
                if (Array.isArray(raw)) ids = raw.map(Number).filter(n => Number.isFinite(n) && n > 0);
                else if (typeof raw === 'string') {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) ids = parsed.map(Number).filter(n => Number.isFinite(n) && n > 0);
                }
            } catch (e) { ids = []; }
            if (ids.length > 0) {
                const ordenRes = await query(
                    'SELECT id FROM estaciones_maestras WHERE id = ANY($1) ORDER BY orden_secuencia_defecto',
                    [ids]
                );
                return ordenRes.rows.map(r => r.id);
            }
        }
    }

    let ids = [];
    if (familia) {
        const febRes = await query(`
            SELECT feb.estacion_id FROM familia_estaciones_base feb
            JOIN estaciones_maestras e ON feb.estacion_id = e.id
            WHERE feb.familia_id = $1 ORDER BY e.orden_secuencia_defecto
        `, [familia.id]);
        ids = febRes.rows.map(r => r.estacion_id);
    }

    if (ids.length === 0) {
        const defRes = await query(
            "SELECT id FROM estaciones_maestras WHERE nombre_estacion IN ('Corte','Pulido','Templado') ORDER BY orden_secuencia_defecto"
        );
        ids = defRes.rows.map(r => r.id);
    }

    if (perforaciones) {
        const mec = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Mecanizado'");
        if (mec.rows.length && !ids.includes(mec.rows[0].id)) {
            ids.splice(Math.max(0, ids.length - 1), 0, mec.rows[0].id);
        }
    }
    if (pintado) {
        const pint = await query("SELECT id FROM estaciones_maestras WHERE nombre_estacion = 'Pintado'");
        if (pint.rows.length && !ids.includes(pint.rows[0].id)) {
            ids.splice(Math.max(0, ids.length - 1), 0, pint.rows[0].id);
        }
    }

    if (ids.length > 0) {
        const ordenRes = await query(
            'SELECT id FROM estaciones_maestras WHERE id = ANY($1) ORDER BY orden_secuencia_defecto',
            [ids]
        );
        ids = ordenRes.rows.map(r => r.id);
    }

    return ids;
};

const buscarRecetasBom = async (codigo) => {
    const bomNew = await query(`
        SELECT rb.*, mp.codigo_mp, mp.nombre as mp_nombre
        FROM recetas_bom rb
        LEFT JOIN materias_primas mp ON rb.materia_prima_id = mp.id
        WHERE rb.codigo_sap_padre = $1
    `, [codigo]);

    if (bomNew.rows.length > 0) return bomNew.rows;

    const bomOld = await query(`
        SELECT *, codigo_materia_prima as codigo_mp, descripcion as mp_nombre
        FROM produccion_recetas_bom WHERE codigo_sap_padre = $1
    `, [codigo]);
    return bomOld.rows;
};

const crearOrden = async (body) => {
    const { pedido_sap_id, cliente, codigo_producto, ancho, alto, perforaciones, perforado, destaje, sacado, pintado, tipo_venta, item_numero, cantidad, fecha_creacion, tipo_entrega, orden_compra, posicion, nota } = body;

    const cant = Number(cantidad) || 1;
    const m2 = ((Number(ancho) * Number(alto)) / 1000000) * cant;
    const codigo = String(codigo_producto).trim();

    const ops = [];
    if (perforado) ops.push('Perforado');
    if (destaje) ops.push('Destaje');
    if (sacado) ops.push('Sacado');
    if (ops.length === 0 && perforaciones) ops.push('Mecanizado');
    const mecanizadoOperaciones = ops.length > 0 ? 'Operaciones: ' + ops.join(', ') : null;
    const tieneMecanizado = ops.length > 0 || perforaciones;

    const familia = await buscarFamilia(codigo);
    const estacionesBaseIds = await getEstacionesBase(familia, tieneMecanizado, pintado, codigo);
    const recetas = await buscarRecetasBom(codigo);

    console.log('[PROD] Manual:', codigo, 'familia:', familia?.nombre_familia, 'BOM:', recetas.length, 'estaciones:', estacionesBaseIds.length);

    const ids = [];
    if (recetas.length > 0) {
        for (const comp of recetas) {
            const result = await query(
                `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
                 es_compuesto, tipo_venta, item_numero, cantidad, familia_id, codigo_padre, nota, posicion, orden_compra, tipo_entrega, created_at, mecanizado_operaciones)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
                [pedido_sap_id, cliente || null, comp.codigo_mp || codigo, comp.mp_nombre || '', ancho, alto, m2,
                 tipo_venta || 'Normal', item_numero || 1, cant, familia?.id || null, codigo,
                 nota || null, posicion || null, orden_compra || null, tipo_entrega || 'Despacho', fecha_creacion || new Date().toISOString(), mecanizadoOperaciones]
            );
            ids.push(result.rows[0].id);
            await crearPasos(result.rows[0].id, estacionesBaseIds);
        }
    } else {
        const result = await query(
            `INSERT INTO produccion_ordenes (pedido_sap_id, cliente, codigo_producto, descripcion, ancho, alto, metros_cuadrados,
             tipo_venta, item_numero, cantidad, familia_id, nota, posicion, orden_compra, tipo_entrega, created_at, mecanizado_operaciones)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [pedido_sap_id, cliente || null, codigo, null, ancho, alto, m2,
             tipo_venta || 'Normal', item_numero || 1, cant, familia?.id || null,
             nota || null, posicion || null, orden_compra || null, tipo_entrega || 'Despacho', fecha_creacion || new Date().toISOString(), mecanizadoOperaciones]
        );
        ids.push(result.rows[0].id);
        await crearPasos(result.rows[0].id, estacionesBaseIds);
    }

    return { ordenes_creadas: ids.length, ids };
};

const cerrarOrden = async (id, nota) => {
    await query('UPDATE produccion_ordenes SET estado_programacion = $1, cerrado_nota = $2 WHERE id = $3', ['CERRADO', nota, id]);
};

const editarOrden = async (id, body) => {
    const fields = [];
    const values = [];
    let idx = 1;
    if (body.cantidad !== undefined) { fields.push(`cantidad = $${idx++}`); values.push(Number(body.cantidad) || 1); }
    if (body.metros_cuadrados !== undefined) { fields.push(`metros_cuadrados = $${idx++}`); values.push(Number(body.metros_cuadrados)); }
    if (body.nivel_prioridad !== undefined) { fields.push(`nivel_prioridad = $${idx++}`); values.push(Math.min(4, Math.max(1, Number(body.nivel_prioridad) || 1))); }
    if (fields.length === 0) throw new Error('Sin campos para actualizar');

    values.push(id);
    await query(`UPDATE produccion_ordenes SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    await query(`UPDATE produccion_ordenes o SET espesor_mm = COALESCE((SELECT rb.espesor FROM produccion_recetas_bom rb WHERE rb.id = o.bom_padre_id), o.espesor_mm, 6) WHERE o.id = $1`, [id]);
    await query('UPDATE produccion_ordenes SET kilos = ROUND(COALESCE(metros_cuadrados,0) * 2.5 * COALESCE(espesor_mm,6)::numeric, 2) WHERE id = $1', [id]);

    const result = await query('SELECT * FROM produccion_ordenes WHERE id = $1', [id]);
    return result.rows[0];
};

const eliminarOrden = async (id) => {
    await query('DELETE FROM produccion_ordenes WHERE id = $1', [id]);
};

module.exports = {
    getOrdenes,
    crearOrden,
    cerrarOrden,
    editarOrden,
    eliminarOrden,
    getPasos,
    actualizarPaso,
    eliminarPaso,
    agregarPaso
};
