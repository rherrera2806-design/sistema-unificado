// Detección de actualizaciones para la app nativa (APK).
//
// El servidor publica /planta/version.json con la versión del APK disponible
// para descarga. La app lo compara con la versión instalada (la real, la del
// sistema Android/iOS) y, si hay algo nuevo, la UI ofrece "Actualizar ahora",
// que abre la descarga del APK: al confirmar, Android lo instala ENCIMA del
// actual (misma firma) sin perder datos.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
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

/** Abre la descarga del APK en el navegador del sistema. */
export async function openDownload(url) {
    const full = /^https?:/i.test(url) ? url : getApiBase() + url;
    try {
        await Browser.open({ url: full });
    } catch (_) {
        window.open(full, '_blank');
    }
}
