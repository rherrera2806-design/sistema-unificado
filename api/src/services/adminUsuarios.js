// ============================================================================
// Servicio ÚNICO de administración de usuarios (fuera de duplicados).
// Reglas de seguridad:
//   · La contraseña NUNCA se guarda ni se devuelve en texto plano (solo bcrypt).
//   · El export descarga el listado SIN contraseñas.
//   · Protección del último administrador: no se puede bajar de rol ni
//     desactivar si queda como el único admin activo.
//   · Un usuario no se elimina a sí mismo; los admins no se eliminan.
//   · Toda acción de administración queda en la bitácora (usuarios_audit).
// Validaciones: nombre y email requeridos, formato de email, contraseña de al
// menos 6 caracteres cuando se envía (helpers.validatePassword).
// ============================================================================
const { query, hashPassword } = require('../config/database');
const { validatePassword } = require('../utils/helpers');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CAMPOS_LISTADO = 'id, nombre, email, rol, area, permisos, activo, created_at';

const getAll = async () => {
    const result = await query(`SELECT ${CAMPOS_LISTADO} FROM usuarios ORDER BY id`);
    return result.rows;
};

const getOne = async (id) => {
    const result = await query(`SELECT ${CAMPOS_LISTADO} FROM usuarios WHERE id = $1`, [id]);
    return result.rows[0] || null;
};

// ---------------- Validaciones comunes ----------------
function validarBase({ nombre, email, password, passwordRequerida }) {
    if (!nombre || !String(nombre).trim()) throw new Error('El nombre es requerido');
    if (!email || !String(email).trim()) throw new Error('El email es requerido');
    if (!EMAIL_RE.test(String(email).trim())) throw new Error('El email no tiene un formato válido');
    if (passwordRequerida && !password) throw new Error('La contraseña es requerida');
    if (password && !validatePassword(password)) throw new Error('La contraseña debe tener al menos 6 caracteres');
}

async function emailEnUso(email, exceptoId) {
    const result = await query('SELECT id FROM usuarios WHERE LOWER(email) = LOWER($1)', [String(email).trim()]);
    if (result.rows.length === 0) return false;
    return exceptoId === undefined ? true : result.rows[0].id !== exceptoId;
}

// ¿Es el último admin activo? (para no dejar el sistema sin administración)
async function esUltimoAdmin(id) {
    const result = await query(
        "SELECT COUNT(*)::int AS n FROM usuarios WHERE rol = 'admin' AND activo = TRUE AND id = $1", [id]
    );
    if (result.rows[0].n === 0) return false;
    const total = await query("SELECT COUNT(*)::int AS n FROM usuarios WHERE rol = 'admin' AND activo = TRUE");
    return total.rows[0].n <= 1;
}

// ---------------- Bitácora ----------------
async function auditar(actorEmail, accion, usuarioEmail, detalle) {
    try {
        await query(
            'INSERT INTO usuarios_audit (actor_email, accion, usuario_email, detalle) VALUES ($1, $2, $3, $4)',
            [actorEmail || 'sistema', accion, usuarioEmail || '', detalle || '']
        );
    } catch (e) {
        // La bitácora nunca debe cortar la operación principal.
        console.error('No se pudo registrar en usuarios_audit:', e.message);
    }
}

// ---------------- Operaciones ----------------
const create = async (data, actorEmail) => {
    const { nombre, email, password, rol, area, permisos } = data;
    validarBase({ nombre, email, password, passwordRequerida: true });
    if (await emailEnUso(email)) throw new Error('El email ya está registrado');
    const result = await query(
        // Sin password_plain: la contraseña solo existe como hash bcrypt.
        "INSERT INTO usuarios (nombre, email, password, password_plain, rol, area, permisos) VALUES ($1, $2, $3, '', $4, $5, $6) RETURNING id, nombre, email, rol, area, permisos, activo",
        [String(nombre).trim(), String(email).trim(), hashPassword(password),
            rol === 'admin' ? 'admin' : 'usuario', (area || '').trim(), permisos || []]
    );
    await auditar(actorEmail, 'crear', String(email).trim(), `rol=${rol === 'admin' ? 'admin' : 'usuario'}`);
    return result.rows[0];
};

const update = async (id, data, actorEmail) => {
    const actual = await getOne(id);
    if (!actual) throw new Error('Usuario no encontrado');
    const nombre = data.nombre !== undefined ? data.nombre : actual.nombre;
    const email = data.email !== undefined ? data.email : actual.email;
    const rol = data.rol === 'admin' ? 'admin' : (data.rol !== undefined ? 'usuario' : actual.rol);
    const area = data.area !== undefined ? (data.area || '').trim() : actual.area;
    const permisos = data.permisos !== undefined ? data.permisos : actual.permisos;
    const activo = data.activo !== undefined ? (data.activo === true || data.activo === 'true') : actual.activo !== false;
    const password = data.password;

    validarBase({ nombre, email, password, passwordRequerida: false });
    if (await emailEnUso(email, id)) throw new Error('El email ya está registrado');

    // Protección del último administrador
    const eraAdmin = actual.rol === 'admin' && actual.activo !== false;
    const sigueAdmin = rol === 'admin' && activo;
    if (eraAdmin && !sigueAdmin && await esUltimoAdmin(id)) {
        throw new Error('No se puede quitar el rol o desactivar al último administrador');
    }

    const cambios = [];
    if (rol !== actual.rol) cambios.push(`rol: ${actual.rol} -> ${rol}`);
    if (activo !== (actual.activo !== false)) cambios.push(`activo: ${activo ? 'sí' : 'no'}`);
    if (password) cambios.push('contraseña actualizada');

    if (password) {
        await query(
            "UPDATE usuarios SET nombre=$1, email=$2, password=$3, password_plain='', rol=$4, area=$5, permisos=$6, activo=$7 WHERE id=$8",
            [String(nombre).trim(), String(email).trim(), hashPassword(password), rol, area, permisos || [], activo, id]
        );
    } else {
        await query(
            "UPDATE usuarios SET nombre=$1, email=$2, rol=$3, area=$4, permisos=$5, activo=$6 WHERE id=$7",
            [String(nombre).trim(), String(email).trim(), rol, area, permisos || [], activo, id]
        );
    }
    await auditar(actorEmail, 'editar', String(email).trim(), cambios.join(' · ') || 'sin cambios de rol/estado');
    return getOne(id);
};

const setActivo = async (id, activo, actorEmail) => {
    const actual = await getOne(id);
    if (!actual) throw new Error('Usuario no encontrado');
    if (!activo && actual.rol === 'admin' && actual.activo !== false && await esUltimoAdmin(id)) {
        throw new Error('No se puede desactivar al último administrador');
    }
    await query('UPDATE usuarios SET activo = $1 WHERE id = $2', [activo, id]);
    await auditar(actorEmail, activo ? 'activar' : 'desactivar', actual.email, '');
    return getOne(id);
};

const remove = async (id, actorEmail) => {
    const actual = await getOne(id);
    if (!actual) throw new Error('Usuario no encontrado');
    if (actorEmail && actual.email && actual.email.toLowerCase() === String(actorEmail).toLowerCase()) {
        throw new Error('No puedes eliminar tu propio usuario');
    }
    if (actual.rol === 'admin') throw new Error('No se pueden eliminar administradores');
    await query('DELETE FROM usuarios WHERE id = $1', [id]);
    await auditar(actorEmail, 'eliminar', actual.email, '');
    return { ok: true };
};

// Export SIN contraseñas: solo el listado administrativo.
const exportTxt = async () => {
    const result = await query(
        'SELECT nombre, email, rol, area, activo FROM usuarios ORDER BY id'
    );
    let txt = '=== LISTADO DE USUARIOS (sin contrasenas) ===\n';
    txt += 'Generado: ' + new Date().toLocaleString('es-CL') + '\n\n';
    for (const u of result.rows) {
        txt += `Nombre: ${u.nombre}\n`;
        txt += `Email: ${u.email}\n`;
        txt += `Rol: ${u.rol}\n`;
        txt += `Area: ${u.area || '-'}\n`;
        txt += `Estado: ${u.activo !== false ? 'Activo' : 'Inactivo'}\n`;
        txt += '---\n';
    }
    return txt;
};

// Bitácora para la pantalla (últimos registros)
const getAuditoria = async (limite = 50) => {
    const result = await query(
        'SELECT actor_email, accion, usuario_email, detalle, created_at FROM usuarios_audit ORDER BY id DESC LIMIT $1',
        [Math.min(Number(limite) || 50, 200)]
    );
    return result.rows;
};

module.exports = { getAll, getOne, create, update, setActivo, remove, exportTxt, getAuditoria };
