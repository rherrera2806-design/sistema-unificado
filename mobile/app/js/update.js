// Detección y aplicación de actualizaciones para la app nativa (APK).
//
// El servidor publica /planta/version.json con la versión del APK disponible.
// La app lo compara con la versión instalada y, si hay algo nuevo, la UI ofrece
// "Actualizar ahora": la descarga se hace DENTRO de la app (una sola descarga,
// con progreso) y al terminar se abre el instalador de Android — que instala
// encima del actual (misma firma) sin perder datos.
//
// OJO: no usar el navegador para la descarga. Abrir la URL del APK desde el
// WebView/Custom Tab generaba descargas repetidas según el navegador.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { getApiBase } from './config.js';

/** Versión instalada real (versionName / versionCode del APK). */
export async function getLocalVersion() {
    try {
        const info = await App.getInfo();
        return { versionName: String(info.version || ''), versionCode: Number(info.build) || 0 };
    } catch (_) {
        return null;
    }
}

/**
 * Devuelve la versión remota si es más nueva que la instalada, o null si no
 * hay actualización (o si estamos en navegador, donde siempre se sirve la última).
 */
export async function checkForUpdate() {
    if (!Capacitor.isNativePlatform()) return null;
    const local = await getLocalVersion();
    if (!local) return null;
    try {
        const res = await fetch(`${getApiBase()}/planta/version.json?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        const remoto = await res.json();
        if (remoto && Number(remoto.versionCode) > local.versionCode) {
            return { ...remoto, versionLocal: local.versionName };
        }
    } catch (_) { }
    return null;
}

/**
 * Descarga el APK dentro de la app y abre el instalador de Android.
 * @param {string} url  Ruta o URL del APK.
 * @param {(pct:number)=>void} onProgress  Avance 0-100 (puede llegar null si
 *        el servidor no informa tamaño).
 */
export async function descargarEInstalar(url, onProgress) {
    const full = /^https?:/i.test(url) ? url : getApiBase() + url;

    if (!Capacitor.isNativePlatform()) {
        // En navegador (pruebas): descarga normal
        window.location.href = full;
        return;
    }

    const nombre = `VitroFlow-Planta-${Date.now()}.apk`;
    let handle = null;
    try {
        handle = await Filesystem.addListener('progress', (p) => {
            if (!onProgress || !p || p.url !== full) return;
            const total = Number(p.contentLength) || 0;
            if (total > 0) onProgress(Math.min(100, Math.round((Number(p.bytes) / total) * 100)));
        });
        await Filesystem.downloadFile({
            url: full,
            path: nombre,
            directory: Directory.Cache,
            progress: true,
            recursive: true
        });
        const { uri } = await Filesystem.getUri({ path: nombre, directory: Directory.Cache });
        await FileOpener.open({
            filePath: uri,
            contentType: 'application/vnd.android.package-archive',
            openWithDefault: true
        });
    } finally {
        if (handle && typeof handle.remove === 'function') { try { handle.remove(); } catch (_) { } }
    }
}
