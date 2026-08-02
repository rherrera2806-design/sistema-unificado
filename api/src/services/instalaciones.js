const { query } = require('../config/database');

const ESTADOS_VALIDOS = ['PROGRAMADA', 'EN_CAMINO', 'EN_CURSO', 'COMPLETADA', 'CON_NOVEDADES', 'CANCELADA'];

const logHistorial = async (instalacionId, accion, detalle, usuario) => {
    await query(
        'INSERT INTO instalaciones_historial (instalacion_id, accion, detalle, usuario) VALUES ($1, $2, $3, $4)',
        [instalacionId, accion, detalle, usuario]
    );
};

const getInstalaciones = async () => {
    const result = await query('SELECT * FROM instalaciones ORDER BY fecha_programada DESC, hora_programada ASC');
    return result.rows;
};

const getCalendario = async (inicio, fin) => {
    const result = await query(
        'SELECT * FROM instalaciones WHERE fecha_programada >= $1::date AND fecha_programada <= $2::date ORDER BY fecha_programada, hora_programada',
        [inicio, fin]
    );
    return result.rows;
};

const getTecnicos = async () => {
    const result = await query('SELECT nombre FROM tecnicos WHERE activo = true ORDER BY nombre');
    return result.rows.map(r => r.nombre);
};

const getVendedores = async () => {
    const result = await query('SELECT nombre FROM vendedores WHERE activo = true ORDER BY nombre');
    return result.rows.map(r => r.nombre);
};

const getInstalacion = async (id) => {
    const result = await query('SELECT * FROM instalaciones WHERE id = $1', [id]);
    return result.rows.length > 0 ? result.rows[0] : null;
};

const crearInstalacion = async (data, userEmail) => {
    const { cliente, direccion, descripcion, fecha_programada, hora_programada, tecnico, vendedor, numero_orden, notas_previas, tipo } = data;
    const result = await query(
        `INSERT INTO instalaciones (cliente, direccion, descripcion, fecha_programada, hora_programada, tecnico, vendedor, numero_orden, notas_previas, estado, creado_por, tipo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PROGRAMADA', $10, $11) RETURNING *`,
        [cliente, direccion, descripcion || '', fecha_programada, hora_programada || '09:00', tecnico || '', vendedor || '', numero_orden || '', notas_previas || '', userEmail, tipo || 'INSTALACION']
    );
    const inst = result.rows[0];
    await logHistorial(inst.id, 'CREADA', 'Instalación programada', userEmail);
    return inst;
};

const editarInstalacion = async (id, data, userEmail) => {
    const { cliente, direccion, descripcion, fecha_programada, hora_programada, tecnico, vendedor, numero_orden, notas_previas, tipo } = data;
    await query(
        `UPDATE instalaciones SET cliente=$1, direccion=$2, descripcion=$3, fecha_programada=$4, hora_programada=$5, tecnico=$6, vendedor=$7, numero_orden=$8, notas_previas=$9, tipo=$10 WHERE id=$11`,
        [cliente, direccion, descripcion, fecha_programada, hora_programada, tecnico, vendedor || '', numero_orden || '', notas_previas, tipo || 'INSTALACION', id]
    );
    await logHistorial(id, 'EDITADA', 'Datos actualizados', userEmail);
};

const cambiarEstado = async (id, estado, detalle, userEmail) => {
    if (!ESTADOS_VALIDOS.includes(estado)) throw new Error('Estado inválido');
    await query('UPDATE instalaciones SET estado=$1 WHERE id=$2', [estado, id]);
    const histDetalle = detalle ? 'Novedad: ' + detalle : 'Estado cambiado a: ' + estado;
    await logHistorial(id, estado === 'CON_NOVEDADES' ? 'NOVEDAD' : 'CAMBIO_ESTADO', histDetalle, userEmail);
};

const cerrarInstalacion = async (id, notas_cierre, firma_cliente, userEmail) => {
    await query(
        'UPDATE instalaciones SET estado=$1, notas_cierre=$2, firma_cliente=$3, cerrado_por=$4, fecha_cierre=NOW() WHERE id=$5',
        ['COMPLETADA', notas_cierre || '', firma_cliente || '', userEmail, id]
    );
    await logHistorial(id, 'CERRADA', 'Instalación cerrada. ' + (notas_cierre || ''), userEmail);
};

const subirFotos = async (id, fotos, userEmail) => {
    for (let i = 0; i < fotos.length; i++) {
        const { base64, descripcion } = fotos[i];
        const buffer = Buffer.from(base64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        await query(
            'INSERT INTO instalaciones_fotos (instalacion_id, foto, descripcion, orden) VALUES ($1, $2, $3, $4)',
            [id, buffer, descripcion || '', i + 1]
        );
    }
    await logHistorial(id, 'FOTOS_SUBIDAS', fotos.length + ' foto(s) subida(s)', userEmail);
};

const getFotos = async (id) => {
    const result = await query(
        'SELECT id, descripcion, orden, created_at FROM instalaciones_fotos WHERE instalacion_id = $1 ORDER BY orden',
        [id]
    );
    return result.rows;
};

const getFoto = async (fotoId) => {
    const result = await query('SELECT foto FROM instalaciones_fotos WHERE id = $1', [fotoId]);
    return result.rows.length > 0 && result.rows[0].foto ? result.rows[0].foto : null;
};

const eliminarFoto = async (instId, fotoId, userEmail) => {
    await query('DELETE FROM instalaciones_fotos WHERE id = $1', [fotoId]);
    await logHistorial(instId, 'FOTO_ELIMINADA', 'Foto eliminada', userEmail);
};

const getHistorial = async (id) => {
    const result = await query(
        `SELECT h.*, COALESCE(u.nombre, h.usuario) as usuario_nombre
         FROM instalaciones_historial h
         LEFT JOIN usuarios u ON u.email = h.usuario
         WHERE h.instalacion_id = $1 ORDER BY h.created_at DESC`, [id]
    );
    return result.rows;
};

const eliminarInstalacion = async (id) => {
    await query('DELETE FROM instalaciones WHERE id = $1', [id]);
};

const getDashboard = async () => {
    const now = new Date();
    const mesActual = now.getMonth() + 1;
    const anioActual = now.getFullYear();

    const programadas = await query(
        `SELECT COUNT(*) as total FROM instalaciones 
         WHERE estado = 'PROGRAMADA' 
         AND EXTRACT(MONTH FROM fecha_programada) = $1 AND EXTRACT(YEAR FROM fecha_programada) = $2`,
        [mesActual, anioActual]
    );

    const enCurso = await query(
        `SELECT COUNT(*) as total FROM instalaciones 
         WHERE estado IN ('EN_CAMINO', 'EN_CURSO')
         AND EXTRACT(MONTH FROM fecha_programada) = $1 AND EXTRACT(YEAR FROM fecha_programada) = $2`,
        [mesActual, anioActual]
    );

    const completadas = await query(
        `SELECT COUNT(*) as total FROM instalaciones 
         WHERE estado = 'COMPLETADA'
         AND EXTRACT(MONTH FROM fecha_programada) = $1 AND EXTRACT(YEAR FROM fecha_programada) = $2`,
        [mesActual, anioActual]
    );

    const novedades = await query(
        `SELECT COUNT(*) as total FROM instalaciones 
         WHERE estado = 'CON_NOVEDADES'
         AND EXTRACT(MONTH FROM fecha_programada) = $1 AND EXTRACT(YEAR FROM fecha_programada) = $2`,
        [mesActual, anioActual]
    );

    return {
        programadas: parseInt(programadas.rows[0].total),
        enCurso: parseInt(enCurso.rows[0].total),
        completadas: parseInt(completadas.rows[0].total),
        novedades: parseInt(novedades.rows[0].total)
    };
};

module.exports = {
    getInstalaciones,
    getCalendario,
    getTecnicos,
    getVendedores,
    getInstalacion,
    crearInstalacion,
    editarInstalacion,
    cambiarEstado,
    cerrarInstalacion,
    subirFotos,
    getFotos,
    getFoto,
    eliminarFoto,
    getHistorial,
    eliminarInstalacion,
    getDashboard
};
