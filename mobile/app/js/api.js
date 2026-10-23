// Cliente API para la app. Autenticación con token Bearer (la cookie SameSite
// del navegador no viaja entre el WebView de la app y el API).
import { getApiBase } from './config.js';

const LS_TOKEN = 'vf_token';
const LS_USER = 'vf_user';

export function getToken() { return localStorage.getItem(LS_TOKEN); }
export function getUser() {
    try { return JSON.parse(localStorage.getItem(LS_USER) || 'null'); } catch (_) { return null; }
}
export function setSession(token, user) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
}
export function clearSession() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
}

export class ApiError extends Error {
    constructor(status, mensaje) { super(mensaje); this.status = status; }
}

/**
 * Llamada al API. Lanza ApiError con mensaje legible cuando falla.
 * @param {string} path  Ej: '/api/taller/estaciones'
 * @param {object} opts  { method, body, timeoutMs }
 */
export async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const user = getUser();
    if (user && user.email) headers['X-User-Email'] = user.email;

    let res;
    try {
        res = await fetch(getApiBase() + path, {
            method: opts.method || 'GET',
            headers,
            body: opts.body != null ? JSON.stringify(opts.body) : undefined,
        });
    } catch (e) {
        throw new ApiError(0, 'Sin conexión con el servidor. Revisa el internet del celular.');
    }

    if (res.status === 401) {
        clearSession();
        throw new ApiError(401, 'Sesión expirada. Vuelve a ingresar.');
    }
    if (!res.ok) {
        let msg = `Error ${res.status}`;
        try { const data = await res.json(); if (data && data.error) msg = data.error; } catch (_) { }
        throw new ApiError(res.status, msg);
    }
    if (res.status === 204) return null;
    try { return await res.json(); } catch (_) { return null; }
}

export async function login(email, password) {
    const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    if (!data || !data.token) throw new ApiError(0, 'Respuesta inválida del servidor');
    setSession(data.token, {
        id: data.id, nombre: data.nombre, email: data.email,
        rol: data.rol, permisos: data.permisos || []
    });
    return getUser();
}

export async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { }
    clearSession();
}
