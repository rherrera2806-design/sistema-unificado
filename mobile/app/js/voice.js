// Comandos de voz para VitroFlow Planta.
// "Registrar 5 del pedido 111836" → { pedido: '111836', item: 1, cantidad: 5 }
//
// Nativo: plugin @capacitor-community/speech-recognition (Android/iOS).
// Navegador: Web Speech API (Chrome) como respaldo para pruebas.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/** Escucha un comando y devuelve el texto, o null si se canceló. */
export async function escuchar() {
    if (Capacitor.isNativePlatform()) {
        const { available } = await SpeechRecognition.available().catch(() => ({ available: false }));
        if (!available) throw new Error('Este dispositivo no soporta reconocimiento de voz');
        const perm = await SpeechRecognition.requestPermissions().catch(() => null);
        if (perm && perm.speechRecognition !== 'granted') {
            throw Object.assign(new Error('Permiso de micrófono denegado. Actívalo en Ajustes → VitroFlow Planta → Permisos.'), { name: 'NotAllowedError' });
        }
        const res = await SpeechRecognition.start({
            language: 'es-CL',
            maxResults: 3,
            partialResults: false,
            popup: false,
            prompt: 'Di: registrar 5 del pedido 111836'
        });
        return (res && res.matches && res.matches[0]) || null;
    }
    return escucharWeb();
}

function escucharWeb() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw new Error('Este navegador no soporta comandos de voz (usa la app)');
    return new Promise((resolve, reject) => {
        const rec = new SR();
        rec.lang = 'es-CL';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 3;
        let resultado = null;
        rec.onresult = (e) => {
            const alt = e.results && e.results[0] ? e.results[0][0] : null;
            resultado = alt ? alt.transcript : null;
        };
        rec.onerror = (e) => {
            const msg = e.error === 'not-allowed' ? 'Permiso de micrófono denegado'
                : e.error === 'no-speech' ? 'No se escuchó nada. Intenta de nuevo.'
                    : 'Error al escuchar (' + e.error + ')';
            reject(new Error(msg));
        };
        rec.onend = () => resolve(resultado);
        try { rec.start(); } catch (err) { reject(err); }
    });
}

// Palabras numéricas frecuentes en comandos ("cinco del pedido...").
// 'un/una' NO se traduce: es ambiguo como artículo ("un pedido").
const PALABRAS_NUM = {
    uno: '1', dos: '2', tres: '3', cuatro: '4', cinco: '5', seis: '6', siete: '7',
    ocho: '8', nueve: '9', diez: '10', once: '11', doce: '12', trece: '13',
    catorce: '14', quince: '15', dieciseis: '16', dieciséis: '16', diecisiete: '17',
    dieciocho: '18', diecinueve: '19', veinte: '20', treinta: '30', cuarenta: '40',
    cincuenta: '50', sesenta: '60', setenta: '70', ochenta: '80', noventa: '90',
    cien: '100'
};

/**
 * Parsea un comando hablado. Acepta variantes:
 *   "registrar 5 del pedido 111836"
 *   "registrar cinco unidades del pedido 111836 item 2"
 *   "pedido 111836 cantidad 3"
 * Devuelve { pedido, item, cantidad } o null si no se entiende.
 */
export function parseComandoVoz(texto) {
    let t = ' ' + String(texto || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' '; // sin tildes
    // palabras numéricas → dígitos
    t = t.replace(/\b(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiete|dieciocho|diecinueve|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)\b/g,
        (m) => PALABRAS_NUM[m] || m);

    const pedidoM = t.match(/pedido\s*(?:numero\s*|nro\.?\s*|n\s*)?(\d+)/);
    const itemM = t.match(/item\s*(\d+)/);
    if (!pedidoM) return null;

    // Cantidad = primer número que no sea el del pedido ni el del item
    let resto = t
        .replace(/pedido\s*(?:numero\s*|nro\.?\s*|n\s*)?\d+/g, ' ')
        .replace(/item\s*\d+/g, ' ')
        .replace(/(registrar|anotar|agregar|cantidad|unidades|unidad|piezas|pieza|vidrios|vidrio|planchas|plancha|del|de|la|el|para|en)\b/g, ' ');
    const cantM = resto.match(/(\d+)/);

    return {
        pedido: pedidoM[1],
        item: itemM ? Number(itemM[1]) || 1 : 1,
        cantidad: cantM ? Number(cantM[1]) || 1 : 1
    };
}
