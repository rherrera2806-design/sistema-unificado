const { query, verifyPassword } = require('../config/database');

async function login(email, password) {
    const result = await query("SELECT * FROM usuarios WHERE email = $1 AND activo = TRUE", [email]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    const verification = verifyPassword(password, user.password);
    if (!verification) return null;
    if (verification.migrated) {
        await query("UPDATE usuarios SET password = $1 WHERE id = $2", [verification.newHash, user.id]);
    }
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, permisos: Array.isArray(user.permisos) ? user.permisos : [] };
}

async function getUsuario(id) {
    const result = await query("SELECT id, nombre, email, rol, permisos, activo, created_at FROM usuarios WHERE id = $1", [id]);
    return result.rows[0] || null;
}

async function getUsuarios() {
    const result = await query("SELECT id, nombre, email, rol, permisos, activo, created_at FROM usuarios ORDER BY id");
    return result.rows;
}

async function crearUsuario(data) {
    const { nombre, email, password, rol, permisos } = data;
    if (!nombre || !email || !password) throw new Error('Nombre, email y password requeridos');
    const { hashPassword } = require('../config/database');
    const result = await query(
        "INSERT INTO usuarios (nombre, email, password, rol, permisos) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, email, rol, permisos",
        [nombre, email, hashPassword(password), rol || 'usuario', permisos || []]
    );
    return result.rows[0];
}

async function updateUsuario(id, data) {
    const { nombre, email, rol, permisos, activo } = data;
    const fields = [];
    const values = [];
    let idx = 1;
    if (nombre !== undefined) { fields.push(`nombre = $${idx++}`); values.push(nombre); }
    if (email !== undefined) { fields.push(`email = $${idx++}`); values.push(email); }
    if (rol !== undefined) { fields.push(`rol = $${idx++}`); values.push(rol); }
    if (permisos !== undefined) { fields.push(`permisos = $${idx++}`); values.push(permisos); }
    if (activo !== undefined) { fields.push(`activo = $${idx++}`); values.push(activo); }
    if (fields.length === 0) return await getUsuario(id);
    values.push(id);
    await query(`UPDATE usuarios SET ${fields.join(', ')} WHERE id = $${idx}`, values);
    return await getUsuario(id);
}

async function eliminarUsuario(id) {
    const result = await query('DELETE FROM usuarios WHERE id = $1', [id]);
    return result.rowCount > 0;
}

module.exports = { login, getUsuario, getUsuarios, crearUsuario, updateUsuario, eliminarUsuario };
