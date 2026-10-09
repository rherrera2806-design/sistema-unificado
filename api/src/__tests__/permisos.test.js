/**
 * Regresión del bug reportado en el módulo de Pedidos:
 *
 * Un usuario de ventas con permiso "Agregar" abría "Nuevo Pedido", adjuntaba el
 * PDF y al guardar recibía "Sin permisos para esta acción", aunque el admin ya
 * le había marcado el permiso en Usuarios.
 *
 * Causa: los permisos se congelaban en la sesión al hacer login. La UI los leía
 * frescos desde /api/auth/me (mostraba el botón) pero el API validaba contra el
 * snapshot viejo de la sesión (rechazaba el POST). Se arregló leyendo
 * permisos/rol/activo desde la BD en cada request (resolveUser).
 *
 * Nota de implementación del test: se usa createRequire (cargador CJS nativo) en
 * vez de vi.mock porque permisos.js resuelve sus dependencias con require().
 * Así test y módulo comparten la MISMA instancia de security.js (el Map de
 * sesiones) y se puede sustituir config/database.query sobre el objeto exportado,
 * que resolveUser lee al momento de la llamada.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);

const db = requireCjs('../config/database');
const security = requireCjs('../middleware/security');
const { requireAnyPerm, requireAuth, requireAdmin } = requireCjs('../middleware/permisos');

const queryReal = db.query;

/** Crea un request con cookie de sesión para el usuario indicado */
function reqConSesion(user) {
    const token = security.createSession(user);
    return { headers: { cookie: `session=${token}` } };
}

function resMock() {
    const res = { statusCode: null, body: null };
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (payload) => { res.body = payload; return res; };
    return res;
}

/** Ejecuta un middleware y devuelve { nextCalled, res, req } */
async function ejecutar(middleware, req) {
    const res = resMock();
    let nextCalled = false;
    await middleware(req, res, () => { nextCalled = true; });
    return { nextCalled, res, req };
}

/** Responde la consulta de usuario de la BD con los datos indicados */
function bdDevuelve(user) {
    db.query = vi.fn().mockResolvedValue({ rows: user ? [user] : [] });
    return db.query;
}

beforeEach(() => {
    db.query = vi.fn();
});

afterEach(() => {
    db.query = queryReal;
});

describe('Permisos leídos desde la BD (no desde el snapshot de la sesión)', () => {
    it('aplica un permiso otorgado después de iniciar sesión, sin cerrar sesión', async () => {
        // La sesión quedó congelada con el permiso viejo (solo Editar)
        const req = reqConSesion({
            id: 7, nombre: 'Marcela', email: 'marcela@templaglass.cl',
            rol: 'usuario', area: 'ventas', permisos: ['pedidos.editar'],
        });
        // La BD ya tiene el permiso Agregar que el admin marcó recién
        bdDevuelve({
            id: 7, nombre: 'Marcela', email: 'marcela@templaglass.cl',
            rol: 'usuario', area: 'ventas', permisos: ['pedidos', 'pedidos.agregar'], activo: true,
        });

        const r = await ejecutar(requireAnyPerm('pedidos.agregar', 'pedidos'), req);

        expect(r.nextCalled).toBe(true);
        expect(req.user.permisos).toEqual(['pedidos', 'pedidos.agregar']);
    });

    it('rechaza con 403 cuando la BD tampoco otorga el permiso', async () => {
        const req = reqConSesion({
            id: 8, email: 'sinpermiso@x.cl', rol: 'usuario', area: 'ventas',
            permisos: ['pedidos', 'pedidos.agregar'], // la sesión cree que sí
        });
        bdDevuelve({
            id: 8, email: 'sinpermiso@x.cl', rol: 'usuario', area: 'ventas',
            permisos: ['pedidos'], activo: true,
        });

        const r = await ejecutar(requireAnyPerm('pedidos.agregar'), req);

        expect(r.nextCalled).toBe(false);
        expect(r.res.statusCode).toBe(403);
        expect(r.res.body).toEqual({ error: 'Sin permisos para esta acción' });
    });

    it('revoca el acceso de inmediato si el usuario fue desactivado', async () => {
        const req = reqConSesion({
            id: 9, email: 'baja@x.cl', rol: 'usuario', permisos: ['pedidos', 'pedidos.agregar'],
        });
        bdDevuelve({
            id: 9, email: 'baja@x.cl', rol: 'usuario', permisos: ['pedidos', 'pedidos.agregar'], activo: false,
        });

        const r = await ejecutar(requireAnyPerm('pedidos.agregar', 'pedidos'), req);

        expect(r.nextCalled).toBe(false);
        expect(r.res.statusCode).toBe(401);
    });

    it('responde 401 sin sesión válida', async () => {
        const r = await ejecutar(requireAnyPerm('pedidos.agregar', 'pedidos'), { headers: {} });

        expect(r.nextCalled).toBe(false);
        expect(r.res.statusCode).toBe(401);
        expect(db.query).not.toHaveBeenCalled();
    });

    it('si la BD falla, conserva el snapshot de la sesión en vez de cortar el acceso', async () => {
        const req = reqConSesion({
            id: 11, email: 'ok@x.cl', rol: 'usuario', permisos: ['pedidos', 'pedidos.agregar'],
        });
        db.query = vi.fn().mockRejectedValue(new Error('connection refused'));

        const r = await ejecutar(requireAnyPerm('pedidos.agregar', 'pedidos'), req);

        expect(r.nextCalled).toBe(true);
        expect(req.user.permisos).toEqual(['pedidos', 'pedidos.agregar']);
    });

    it('resuelve el usuario una sola vez por request aunque haya varios middlewares', async () => {
        const req = reqConSesion({
            id: 12, email: 'admin@x.cl', rol: 'admin', permisos: ['usuarios'],
        });
        const query = bdDevuelve({
            id: 12, email: 'admin@x.cl', rol: 'admin', permisos: ['usuarios'], activo: true,
        });

        const r1 = await ejecutar(requireAnyPerm('pedidos.agregar'), req);
        const r2 = await ejecutar(requireAdmin, req);

        expect(r1.nextCalled).toBe(true);
        expect(r2.nextCalled).toBe(true);
        expect(query).toHaveBeenCalledTimes(1);
    });

    it('requireAuth expone el usuario vigente de la BD', async () => {
        const req = reqConSesion({
            id: 13, email: 'v@x.cl', rol: 'usuario', area: 'ventas', permisos: [],
        });
        bdDevuelve({
            id: 13, nombre: 'Vendedor', email: 'v@x.cl', rol: 'usuario', area: 'ventas',
            permisos: ['pedidos'], activo: true,
        });

        const r = await ejecutar(requireAuth, req);

        expect(r.nextCalled).toBe(true);
        expect(req.user.email).toBe('v@x.cl');
        expect(req.user.area).toBe('ventas');
    });
});
