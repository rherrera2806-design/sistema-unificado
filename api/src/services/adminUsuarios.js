const { query, hashPassword } = require('../config/database');

const getAll = async () => {
    const result = await query(
        "SELECT id, nombre, email, rol, permisos, activo FROM usuarios ORDER BY id"
    );
    return result.rows;
};

const create = async ({ nombre, email, password, rol, permisos }) => {
    if (!nombre || !email || !password) {
        throw new Error('Nombre, email y contraseña requeridos');
    }
    const exists = await query("SELECT id FROM usuarios WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
        throw new Error('El email ya está registrado');
    }
    const result = await query(
        "INSERT INTO usuarios (nombre, email, password, password_plain, rol, permisos) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, nombre, email, rol, permisos",
        [nombre, email, hashPassword(password), password, rol || 'usuario', permisos || []]
    );
    return result.rows[0];
};

const update = async (id, { nombre, email, password, rol, permisos }) => {
    if (password) {
        await query(
            'UPDATE usuarios SET nombre=$1, email=$2, password=$3, password_plain=$4, rol=$5, permisos=$6 WHERE id=$7',
            [nombre, email, hashPassword(password), password, rol, permisos || [], id]
        );
    } else {
        await query(
            'UPDATE usuarios SET nombre=$1, email=$2, rol=$3, permisos=$4 WHERE id=$5',
            [nombre, email, rol, permisos || [], id]
        );
    }
    return { ok: true };
};

const remove = async (id) => {
    await query('DELETE FROM usuarios WHERE id=$1 AND rol != $2', [id, 'admin']);
    return { ok: true };
};

const exportTxt = async () => {
    const result = await query(
        "SELECT nombre, email, password_plain, rol FROM usuarios ORDER BY id"
    );
    let txt = '=== LISTADO DE USUARIOS ===\n';
    txt += 'Generado: ' + new Date().toLocaleString('es-CL') + '\n\n';
    for (const u of result.rows) {
        txt += `Nombre: ${u.nombre}\n`;
        txt += `Email: ${u.email}\n`;
        txt += `Password: ${u.password_plain || '(no disponible)'}\n`;
        txt += `Rol: ${u.rol}\n`;
        txt += '---\n';
    }
    return txt;
};

module.exports = { getAll, create, update, remove, exportTxt };
