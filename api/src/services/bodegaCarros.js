const { query } = require('../config/database');
const { transaction } = require('../config/dbPool');

// ============ CARROS (catálogo) ============

const getCarros = async () => {
    const result = await query(
        `SELECT c.id, c.codigo,
                COALESCE(c.tipo, 'carro') as tipo,
                COALESCE(c.capacidad_items, 50) as capacidad_items,
                COALESCE(c.activo, true) as activo,
                c.observaciones,
                c.created_at,
                (SELECT COUNT(*) FROM bodega_carros_items WHERE carro_id = c.id) as total_items_asignados,
                (SELECT COUNT(*) FROM bodega_carros_items WHERE carro_id = c.id AND entregado_at IS NULL) as items_en_carros
         FROM bodega_carros c
         ORDER BY codigo ASC`
    );
    return result.rows;
};

const crearCarro = async ({ codigo, tipo, capacidad_items, observaciones }) => {
    const result = await query(
        `INSERT INTO bodega_carros (codigo, tipo, capacidad_items, observaciones)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [codigo, tipo || 'carro', capacidad_items || 50, observaciones || '']
    );
    return result.rows[0];
};

const editarCarro = async (id, { codigo, tipo, capacidad_items, activo, observaciones }) => {
    const result = await query(
        `UPDATE bodega_carros
         SET codigo = COALESCE($1, codigo),
             tipo = COALESCE($2, tipo),
             capacidad_items = COALESCE($3, capacidad_items),
             activo = COALESCE($4, activo),
             observaciones = COALESCE($5, observaciones)
         WHERE id = $6 RETURNING *`,
        [codigo, tipo, capacidad_items, activo, observaciones, id]
    );
    return result.rows[0] || null;
};

const eliminarCarro = async (id) => {
    await query('DELETE FROM bodega_carros WHERE id = $1', [id]);
    return { ok: true };
};

// ============ ITEMS LISTOS PARA BODEGA ============
// Devuelve los pasos cuya orden_secuencia es la máxima de su orden_produccion
// y que están TERMINADOS pero no asignados a ningún carro
const getItemsListosParaBodega = async () => {
    const result = await query(`
        SELECT p.id as paso_id, p.orden_secuencia, p.hora_fin,
               o.id as orden_id, o.pedido_sap_id, o.item_numero, o.cliente,
               o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad,
               o.kilos, o.metros_cuadrados, o.espesor_mm, o.familia_id,
               f.nombre_familia,
               em.nombre_estacion as ultima_estacion
        FROM cola_produccion_pasos p
        JOIN produccion_ordenes o ON p.orden_produccion_id = o.id
        LEFT JOIN familias_producto f ON o.familia_id = f.id
        LEFT JOIN estaciones_maestras em ON p.estacion_id = em.id
        WHERE p.estado = 'TERMINADO'
          AND p.orden_secuencia = (
              SELECT MAX(orden_secuencia) FROM cola_produccion_pasos WHERE orden_produccion_id = p.orden_produccion_id
          )
          AND NOT EXISTS (
              SELECT 1 FROM bodega_carros_items bi WHERE bi.paso_id = p.id
          )
        ORDER BY p.hora_fin ASC NULLS LAST, o.pedido_sap_id ASC, o.item_numero ASC
    `);
    return result.rows;
};

// ============ ASIGNAR ITEMS A CARRO ============

const asignarItemsACarro = async (pasoIds, carroId, armadorEmail, armadorNombre) => {
    if (!Array.isArray(pasoIds) || pasoIds.length === 0) {
        throw new Error('Se requiere al menos un paso_id');
    }
    if (!carroId) throw new Error('carro_id requerido');

    // Verificar que el carro no tenga una entrega ya generada
    const entregaExistente = await query(
        `SELECT id FROM bodega_entregas WHERE carro_id = $1 LIMIT 1`,
        [carroId]
    );
    if (entregaExistente.rows.length > 0) {
        throw new Error('El carro ya tiene una entrega generada');
    }

    let count = 0;
    for (const pasoId of pasoIds) {
        try {
            await query(
                `INSERT INTO bodega_carros_items (carro_id, paso_id, orden_produccion_id, armador_email, armador_nombre)
                 SELECT $1, p.id, p.orden_produccion_id, $2, $3
                 FROM cola_produccion_pasos p WHERE p.id = $4`,
                [carroId, armadorEmail, armadorNombre, pasoId]
            );
            count++;
        } catch (_) { }
    }
    return count;
};

const quitarItemDeCarro = async (itemId) => {
    // Solo permitir si el carro no tiene entrega generada
    const itemRes = await query(
        `SELECT bi.carro_id, be.id as entrega_id
         FROM bodega_carros_items bi
         LEFT JOIN bodega_entregas be ON be.carro_id = bi.carro_id
         WHERE bi.id = $1`,
        [itemId]
    );
    if (itemRes.rows.length === 0) throw new Error('Item no encontrado');
    if (itemRes.rows[0].entrega_id) throw new Error('No se puede quitar un item de un carro con entrega ya generada');
    await query('DELETE FROM bodega_carros_items WHERE id = $1', [itemId]);
    return { ok: true };
};

// ============ PRE-ENTREGA ============
// Lista los carros que tienen items asignados pero no tienen documento de entrega generado
const getCarrosEnPreEntrega = async () => {
    const result = await query(`
        SELECT c.id as carro_id, c.codigo, c.tipo, c.capacidad_items,
               COUNT(bi.id) as total_items,
               COALESCE(SUM(o.kilos), 0) as total_kilos,
               COALESCE(SUM(o.metros_cuadrados), 0) as total_m2,
               MIN(bi.armado_at) as primer_armado,
               MAX(bi.armado_at) as ultimo_armado
        FROM bodega_carros c
        JOIN bodega_carros_items bi ON bi.carro_id = c.id AND bi.entregado_at IS NULL
        LEFT JOIN produccion_ordenes o ON bi.orden_produccion_id = o.id
        WHERE NOT EXISTS (SELECT 1 FROM bodega_entregas be WHERE be.carro_id = c.id)
        GROUP BY c.id, c.codigo, c.tipo, c.capacidad_items
        ORDER BY MAX(bi.armado_at) DESC
    `);
    return result.rows;
};

const getItemsDeCarro = async (carroId) => {
    const result = await query(`
        SELECT bi.id as item_id, bi.armado_at, bi.observaciones,
               p.id as paso_id, p.orden_secuencia, p.hora_fin,
               o.id as orden_id, o.pedido_sap_id, o.item_numero, o.cliente,
               o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad,
               o.kilos, o.metros_cuadrados, o.espesor_mm,
               f.nombre_familia,
               em.nombre_estacion as ultima_estacion
        FROM bodega_carros_items bi
        JOIN cola_produccion_pasos p ON bi.paso_id = p.id
        JOIN produccion_ordenes o ON bi.orden_produccion_id = o.id
        LEFT JOIN familias_producto f ON o.familia_id = f.id
        LEFT JOIN estaciones_maestras em ON p.estacion_id = em.id
        WHERE bi.carro_id = $1
        ORDER BY o.pedido_sap_id ASC, o.item_numero ASC
    `, [carroId]);
    return result.rows;
};

// ============ GENERAR ENTREGA ============

const generarEntrega = async (carroId, usuarioEmail, usuarioNombre, observaciones) => {
    return await transaction(async ({ query: txQuery }) => {
        // Verificar que no exista entrega ya
        const existe = await txQuery(`SELECT id FROM bodega_entregas WHERE carro_id = $1`, [carroId]);
        if (existe.rows.length > 0) throw new Error('El carro ya tiene una entrega generada');

        // Verificar que tenga items
        const itemsRes = await txQuery(
            `SELECT bi.id, o.kilos, o.metros_cuadrados FROM bodega_carros_items bi
             JOIN produccion_ordenes o ON bi.orden_produccion_id = o.id
             WHERE bi.carro_id = $1`, [carroId]
        );
        if (itemsRes.rows.length === 0) throw new Error('El carro no tiene items');

        // Generar número de documento: ENT-{YYYY}-{NNN}
        const year = new Date().getFullYear();
        const countRes = await txQuery(
            `SELECT COUNT(*) as c FROM bodega_entregas WHERE numero_documento LIKE $1`,
            [`ENT-${year}-%`]
        );
        const nextNum = String(Number(countRes.rows[0].c) + 1).padStart(4, '0');
        const numeroDocumento = `ENT-${year}-${nextNum}`;

        const totalKilos = itemsRes.rows.reduce((acc, r) => acc + Number(r.kilos || 0), 0);
        const totalM2 = itemsRes.rows.reduce((acc, r) => acc + Number(r.metros_cuadrados || 0), 0);

        const result = await txQuery(
            `INSERT INTO bodega_entregas (carro_id, numero_documento, generado_por_email, generado_por_nombre, total_items, total_kilos, total_m2, observaciones)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [carroId, numeroDocumento, usuarioEmail, usuarioNombre, itemsRes.rows.length, totalKilos, totalM2, observaciones || '']
        );
        return result.rows[0];
    });
};

// ============ ENTREGAS GENERADAS / HISTORIAL ============

const getEntregasGeneradas = async () => {
    const result = await query(`
        SELECT be.*, c.codigo as carro_codigo, c.tipo as carro_tipo
        FROM bodega_entregas be
        JOIN bodega_carros c ON be.carro_id = c.id
        WHERE be.recibido_at IS NULL
        ORDER BY be.generado_at DESC
    `);
    return result.rows;
};

const getHistorialEntregas = async (limite = 100) => {
    const result = await query(`
        SELECT be.*, c.codigo as carro_codigo, c.tipo as carro_tipo
        FROM bodega_entregas be
        JOIN bodega_carros c ON be.carro_id = c.id
        ORDER BY be.recibido_at DESC NULLS LAST, be.generado_at DESC
        LIMIT $1
    `, [limite]);
    return result.rows;
};

const getEntregaDetalle = async (entregaId) => {
    const entRes = await query(`
        SELECT be.*, c.codigo as carro_codigo, c.tipo as carro_tipo
        FROM bodega_entregas be
        JOIN bodega_carros c ON be.carro_id = c.id
        WHERE be.id = $1
    `, [entregaId]);
    if (entRes.rows.length === 0) return null;
    const entrega = entRes.rows[0];

    const itemsRes = await query(`
        SELECT bi.id as item_id, bi.entregado_at,
               o.id as orden_id, o.pedido_sap_id, o.item_numero, o.cliente,
               o.codigo_producto, o.descripcion, o.ancho, o.alto, o.cantidad,
               o.kilos, o.metros_cuadrados, o.espesor_mm,
               f.nombre_familia,
               em.nombre_estacion as ultima_estacion
        FROM bodega_carros_items bi
        JOIN produccion_ordenes o ON bi.orden_produccion_id = o.id
        LEFT JOIN familias_producto f ON o.familia_id = f.id
        LEFT JOIN cola_produccion_pasos cp ON bi.paso_id = cp.id
        LEFT JOIN estaciones_maestras em ON cp.estacion_id = em.id
        WHERE bi.carro_id = $1
        ORDER BY o.pedido_sap_id ASC, o.item_numero ASC
    `, [entrega.carro_id]);

    return { ...entrega, items: itemsRes.rows };
};

const recibirEntrega = async (entregaId, usuarioEmail, usuarioNombre) => {
    return await transaction(async ({ query: txQuery }) => {
        const entRes = await txQuery(`SELECT * FROM bodega_entregas WHERE id = $1`, [entregaId]);
        if (entRes.rows.length === 0) throw new Error('Entrega no encontrada');
        if (entRes.rows[0].recibido_at) throw new Error('La entrega ya fue recibida');

        const result = await txQuery(
            `UPDATE bodega_entregas
             SET recibido_at = NOW(), recibido_por_email = $1, recibido_por_nombre = $2
             WHERE id = $3 RETURNING *`,
            [usuarioEmail, usuarioNombre, entregaId]
        );

        await txQuery(
            `UPDATE bodega_carros_items SET entregado_at = NOW(), entregado_por_email = $1 WHERE carro_id = $2`,
            [usuarioEmail, result.rows[0].carro_id]
        );

        return result.rows[0];
    });
};

module.exports = {
    // Carros
    getCarros,
    crearCarro,
    editarCarro,
    eliminarCarro,
    // Items
    getItemsListosParaBodega,
    asignarItemsACarro,
    quitarItemDeCarro,
    getItemsDeCarro,
    // Pre-entrega
    getCarrosEnPreEntrega,
    // Entregas
    generarEntrega,
    getEntregasGeneradas,
    getHistorialEntregas,
    getEntregaDetalle,
    recibirEntrega
};
