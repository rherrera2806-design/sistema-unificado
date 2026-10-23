// Escaneo de códigos para VitroFlow Planta.
//
// Flujo nativo (app Android/iOS):
//   1. scan()          → interfaz lista de ML Kit (Google), la mejor experiencia.
//   2. startScan()     → ML Kit embebido con overlay propio: respaldo cuando el
//                        dispositivo no tiene el módulo de Google (sin GMS).
// Flujo web (pruebas en navegador):
//   getUserMedia + BarcodeDetector/jsQR — el mismo motor de la web de taller.
//
// Devuelve el texto del código leído, o null si el usuario canceló.
import { Capacitor } from '@capacitor/core';
import { BarcodeScanner, BarcodeFormat, LensFacing } from '@capacitor-mlkit/barcode-scanning';
import jsQR from 'jsqr';

const FORMATOS = [BarcodeFormat.QrCode, BarcodeFormat.DataMatrix, BarcodeFormat.Code128, BarcodeFormat.Ean13];

export async function scanCode() {
    if (Capacitor.isNativePlatform()) return scanNative();
    return scanWeb();
}

// ============================ NATIVO ============================

async function scanNative() {
    const { supported } = await BarcodeScanner.isSupported().catch(() => ({ supported: false }));
    if (!supported) throw new Error('Este dispositivo no tiene cámara disponible');

    const perm = await BarcodeScanner.requestPermissions().catch(() => null);
    if (perm && perm.camera !== 'granted') {
        throw Object.assign(new Error('Permiso de cámara denegado. Actívalo en Ajustes → VitroFlow Planta → Permisos.'), { name: 'NotAllowedError' });
    }

    // 1) Interfaz lista de Google (rápida, con auto-zoom)
    try {
        if (Capacitor.getPlatform() === 'android') {
            const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable().catch(() => ({ available: true }));
            if (!available) {
                // El módulo se instala desde Google Play Services; si falla, cae
                // al escáner embebido más abajo.
                await BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => { });
            }
        }
        const result = await BarcodeScanner.scan({ formats: FORMATOS, autoZoom: true });
        const code = result && result.barcodes && result.barcodes[0];
        return code ? code.rawValue : null;
    } catch (err) {
        const msg = String((err && err.message) || err);
        if (/cancel|cancell?ed/i.test(msg)) return null;
        // 2) Respaldo: ML Kit embebido con overlay propio (no requiere GMS)
        return scanNativeEmbedded();
    }
}

/**
 * Overlay de escaneo propio sobre la cámara nativa (startScan renderiza la
 * cámara detrás del WebView). Resuelve con el texto o null al cancelar.
 */
function scanNativeEmbedded() {
    return new Promise((resolve, reject) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:transparent;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:24px';
        overlay.innerHTML = `
            <div style="position:absolute;top:calc(20px + env(safe-area-inset-top));left:0;right:0;text-align:center;color:#fff;font-size:14px;font-weight:600;text-shadow:0 1px 6px rgba(0,0,0,.7)">
                Apunta al QR de la etiqueta
            </div>
            <div style="width:min(72vw,300px);height:min(72vw,300px);position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border:3px solid rgba(255,255,255,.9);border-radius:18px;box-shadow:0 0 0 2000px rgba(15,23,42,.45)"></div>
            <div style="display:flex;gap:10px;width:100%;max-width:420px">
                <button id="scanTorch" style="flex:1;padding:14px;border-radius:12px;border:none;background:rgba(255,255,255,.22);color:#fff;font-size:14px;font-weight:700">🔦 Luz</button>
                <button id="scanCancel" style="flex:2;padding:14px;border-radius:12px;border:none;background:#fff;color:#0f172a;font-size:14px;font-weight:700">Cancelar</button>
            </div>`;
        document.body.appendChild(overlay);

        let listo = false;
        const cleanup = async () => {
            try { await BarcodeScanner.removeAllListeners(); } catch (_) { }
            try { await BarcodeScanner.stopScan(); } catch (_) { }
            overlay.remove();
        };
        const finish = (valor) => {
            if (listo) return;
            listo = true;
            cleanup().then(() => resolve(valor));
        };

        overlay.querySelector('#scanCancel').addEventListener('click', () => finish(null));
        overlay.querySelector('#scanTorch').addEventListener('click', () => {
            BarcodeScanner.toggleTorch().catch(() => { });
        });

        BarcodeScanner.addListener('barcodesScanned', (event) => {
            const code = event && event.barcodes && event.barcodes[0];
            if (code && code.rawValue) finish(code.rawValue);
        }).catch(() => { });
        BarcodeScanner.addListener('scanError', (event) => {
            if (listo) return;
            listo = true;
            const msg = String((event && event.message) || 'Error al escanear');
            cleanup().then(() => reject(new Error(msg)));
        }).catch(() => { });

        BarcodeScanner.startScan({ formats: FORMATOS, lensFacing: LensFacing.Back }).catch((err) => {
            if (listo) return;
            listo = true;
            cleanup().then(() => reject(err instanceof Error ? err : new Error('No se pudo abrir la cámara')));
        });
    });
}

// ============================ WEB (pruebas) ============================

async function scanWeb() {
    const stream = await openCamera();
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:500;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px';
        overlay.innerHTML = `
            <video autoplay muted playsinline style="width:100%;max-width:520px;border-radius:14px;background:#000"></video>
            <p style="color:#cbd5e1;font-size:12.5px;margin:12px 0 0;text-align:center">Apunta al QR de la etiqueta (modo pruebas del navegador)</p>
            <button id="scanCancel" style="margin-top:14px;padding:13px 26px;border-radius:12px;border:none;background:#fff;color:#0f172a;font-size:14px;font-weight:700">Cancelar</button>`;
        document.body.appendChild(overlay);

        const video = overlay.querySelector('video');
        video.srcObject = stream;
        video.play().catch(() => { });

        const detector = typeof BarcodeDetector !== 'undefined' ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        let listo = false;

        const cleanup = (valor) => {
            if (listo) return;
            listo = true;
            try { stream.getTracks().forEach(t => t.stop()); } catch (_) { }
            overlay.remove();
            resolve(valor);
        };
        overlay.querySelector('#scanCancel').addEventListener('click', () => cleanup(null));

        const tick = async () => {
            if (listo) return;
            try {
                let crudo = null;
                if (detector && video.videoWidth > 0) {
                    const codes = await detector.detect(video);
                    if (codes && codes.length) crudo = codes[0].rawValue;
                } else if (video.videoWidth > 0) {
                    const escala = Math.min(1, 1024 / video.videoWidth);
                    canvas.width = Math.max(1, Math.round(video.videoWidth * escala));
                    canvas.height = Math.max(1, Math.round(video.videoHeight * escala));
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const code = jsQR(img.data, canvas.width, canvas.height);
                    if (code && code.data) crudo = code.data;
                }
                if (crudo) { cleanup(crudo); return; }
            } catch (_) { }
            setTimeout(tick, 250);
        };
        setTimeout(tick, 250);
    });
}

async function openCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
            return await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        } catch (err) {
            if (err && ['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(err.name)) {
                return await navigator.mediaDevices.getUserMedia({ video: true });
            }
            throw err;
        }
    }
    throw new Error('Este navegador no permite usar la cámara');
}
