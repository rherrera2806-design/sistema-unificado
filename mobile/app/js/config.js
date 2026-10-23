// Configuración de la app. La URL del servidor se puede cambiar en la pantalla
// de login (botón "Servidor"), por ejemplo para apuntar a un ambiente de pruebas.
export const DEFAULT_API = 'https://vitroflow.up.railway.app';

export function getApiBase() {
    return localStorage.getItem('vf_api') || DEFAULT_API;
}

export function setApiBase(url) {
    const limpio = String(url || '').trim().replace(/\/+$/, '');
    if (limpio) localStorage.setItem('vf_api', limpio);
}
