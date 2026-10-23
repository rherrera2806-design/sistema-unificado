// Comandos de voz para VitroFlow Planta.
//
// El usuario habla POR CAMPOS: "pedido: ciento doce mil ciento cuarenta y dos,
// item: 1, cantidad: 1". El parser CORTA el texto en los marcadores
// (pedido / item / cantidad) y encasilla lo dicho en cada campo.
// Entiende dígitos (112142, 112.142) y números hablados en español
// ("ciento doce mil ciento cuarenta y dos" → 112142).
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
            prompt: 'Di: pedido, item y cantidad'
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

// ==================== NÚMEROS HABLADOS EN ESPAÑOL ====================

const UNIDADES = {
    uno: 1, un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
    siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
    catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
    diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23,
    veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27,
    veintiocho: 28, veintinueve: 29
};
const DECENAS = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const CENTENAS = {
    cien: 100, ciento: 100, doscientos: 200, doscientas: 200, trescientos: 300,
    trescientas: 300, cuatrocientos: 400, cuatrocientas: 400, quinientos: 500,
    quinientas: 500, seiscientos: 600, seiscientas: 600, setecientos: 700,
    setecientas: 700, ochocientos: 800, ochocientas: 800, novecientos: 900,
    novecientas: 900
};

function esPalabraNumero(p) {
    return p in UNIDADES || p in DECENAS || p in CENTENAS
        || p === 'mil' || p === 'millon' || p === 'millones' || p === 'y';
}

/**
 * Convierte un número escrito en palabras a dígitos.
 * "ciento doce mil ciento cuarenta y dos" → 112142. Devuelve null si la
 * frase no es (enteramente) un número.
 */
export function palabrasANumero(txt) {
    const palabras = String(txt || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\by\b/g, ' ')
        .split(/\s+/).map(p => p.replace(/[^a-z]/g, '')).filter(Boolean);
    if (!palabras.length) return null;

    let total = 0, actual = 0, ok = false;
    for (const p of palabras) {
        if (p === 'y') continue;
        if (p === 'mil') { total += (actual || 1) * 1000; actual = 0; ok = true; continue; }
        if (p === 'millon') { total += (actual || 1) * 1000000; actual = 0; ok = true; continue; }
        if (p === 'millones') { ok = true; continue; }
        if (p in UNIDADES) { actual += UNIDADES[p]; ok = true; continue; }
        if (p in DECENAS) { actual += DECENAS[p]; ok = true; continue; }
        if (p in CENTENAS) { actual += CENTENAS[p]; ok = true; continue; }
        return null; // palabra que no es número → no aplica
    }
    return ok ? total + actual : null;
}

/**
 * Extrae EL número de un segmento de texto: primero dígitos (112142 o
 * 112.142 con separador de miles) y, si no hay, la mayor corrida de palabras
 * numéricas ("ciento doce mil ciento cuarenta y dos").
 */
export function numeroDeSegmento(seg) {
    const t = ' ' + String(seg || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';

    // 1) Dígitos: unir separadores de miles ("112.142" / "112,142" → 112142)
    let unido = t;
    for (let i = 0; i < 4; i++) {
        const nuevo = unido.replace(/(\d)[.,\s](\d{3})(?!\d)/g, '$1$2');
        if (nuevo === unido) break;
        unido = nuevo;
    }
    const d = unido.match(/\d+/);
    if (d) return Number(d[0]);

    // 2) Palabras numéricas: la mayor corrida consecutiva
    const palabras = t.split(/\s+/).map(p => p.replace(/[^a-z0-9]/g, '')).filter(Boolean);
    let mejor = null, run = [];
    const cerrarRun = () => {
        if (mejor === null && run.length) {
            const n = palabrasANumero(run.join(' '));
            if (n !== null && n > 0) mejor = n;
        }
        run = [];
    };
    for (const p of palabras) {
        if (esPalabraNumero(p)) run.push(p);
        else cerrarRun();
    }
    cerrarRun();
    return mejor;
}

// ==================== PARSER DE COMANDO ====================

const MARCADORES = [
    { campo: 'pedido', re: /\bpedido\b/ },
    { campo: 'item', re: /\bitem\b/ },
    { campo: 'cantidad', re: /\b(cantidad|cantidades|unidades|unidad|piezas|pieza|vidrios|vidrio|planchas|plancha)\b/ }
];

/**
 * Parsea un comando hablado POR CAMPOS. Acepta:
 *   "pedido: ciento doce mil ciento cuarenta y dos, item: 1, cantidad: 1"
 *   "pedido 112.142 item 2 cantidad 5"
 *   "registrar 5 del pedido 111836"   (cantidad sin marcador, al inicio)
 *   "pedido 111836"                   (item y cantidad = 1)
 * Devuelve { pedido, item, cantidad } o null si no se entiende.
 */
export function parseComandoVoz(texto) {
    let t = ' ' + String(texto || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ').trim() + ' ';

    // Cortar el texto en los marcadores de campo (pedido / item / cantidad)
    const marcas = [];
    for (const m of MARCADORES) {
        const match = m.re.exec(t);
        if (match) marcas.push({ campo: m.campo, ini: match.index, fin: match.index + match[0].length });
    }
    if (!marcas.some(m => m.campo === 'pedido')) return null; // sin pedido no hay comando
    marcas.sort((a, b) => a.ini - b.ini);

    const campos = { pedido: null, item: null, cantidad: null };
    // Segmentos: de cada marcador al siguiente (y el texto previo al primero
    // se toma como "cantidad" para soportar "registrar 5 del pedido ...")
    for (let i = 0; i < marcas.length; i++) {
        const desde = marcas[i].fin;
        const hasta = i + 1 < marcas.length ? marcas[i + 1].ini : t.length;
        campos[marcas[i].campo] = numeroDeSegmento(t.slice(desde, hasta));
    }
    if (campos.cantidad == null && marcas[0].ini > 0) {
        campos.cantidad = numeroDeSegmento(t.slice(0, marcas[0].ini));
    }

    return {
        pedido: String(campos.pedido != null ? campos.pedido : ''),
        item: campos.item != null && campos.item > 0 ? campos.item : 1,
        cantidad: campos.cantidad != null && campos.cantidad > 0 ? campos.cantidad : 1
    };
}
