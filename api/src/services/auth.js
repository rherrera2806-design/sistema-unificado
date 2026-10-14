// Autenticación. La administración de usuarios (crear/editar/eliminar) vive
// ÚNICAMENTE en services/adminUsuarios.js, con sus validaciones, protecciones
// y bitácora. Este módulo solo resuelve el login.
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
    return { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol, area: user.area || '', permisos: Array.isArray(user.permisos) ? user.permisos : [] };
}

async function getUsuario(id) {
    const result = await query("SELECT id, nombre, email, rol, permisos, activo, created_at FROM usuarios WHERE id = $1", [id]);
    return result.rows[0] || null;
}

module.exports = { login, getUsuario };
