// Lógica compartida portada desde web/public/taller/index.html (parseQR y
// sugerencia de turno) para que la app y la web lean igual los códigos.

/**
 * Parsea el contenido de un QR. Acepta:
 *  - "VF:PEDIDO|ITEM" (QR del programa impreso)
 *  - Etiqueta Optiway "SAP|FECHA|OV-10ITEM|M2"
 *  - Un número de pedido simple
 *  - URL con ?qr=...
 * Devuelve { pedido, item } o null.
 */
export function parseQR(texto) {
    const t = String(texto || '').trim();
    const mUrl = t.match(/[?&]qr=([^&]+)/);
    if (mUrl) {
        try { return parseQR(decodeURIComponent(mUrl[1])); } catch (_) { }
    }
    let m = t.match(/^VF:([^|]+)\|(\d+)$/i);
    if (m) return { pedido: m[1].trim(), item: Number(m[2]) || 1 };
    const partes = t.split('|');
    if (partes.length >= 3) {
        // Optiway: campo 3 = "OV-10ITEM" (se tolera prefijo literal "OV-")
        const campo = (partes[2] || '').trim().replace(/^OV[-_]?/i, '');
        m = campo.match(/^(\d+)-10(\d+)$/);
        if (m) return { pedido: m[1], item: Number(m[2]) || 1 };
        m = campo.match(/^(\d+)-(\d+)$/);
        if (m) return { pedido: m[1], item: Number(m[2]) || 1 };
    }
    if (/^\d{4,}$/.test(t)) return { pedido: t, item: 1 };
    return null;
}

/**
 * Sugiere el turno ('dia' | 'noche' | 'extra') según las ventanas horarias
 * configuradas del mes (GET /api/taller/horarios). Sin configuración:
 * 06:00-22:00 día, resto noche.
 */
export function getTurnoSugerido(horariosTurnos) {
    const ahora = new Date();
    const anio = ahora.getFullYear();
    const mes = ahora.getMonth() + 1;
    const cfg = (horariosTurnos || []).filter(h => Number(h.anio) === anio && Number(h.mes) === mes);
    if (cfg.length) {
        for (let atras = 0; atras <= 1; atras++) {
            const d = new Date(ahora.getTime() - atras * 86400000);
            const diaSemana = d.getDay();
            for (const h of cfg) {
                if (Number(h.dia_semana) !== diaSemana || !h.hora_inicio || !h.hora_fin) continue;
                const [hi, mi] = String(h.hora_inicio).split(':').map(Number);
                const [hf, mf] = String(h.hora_fin).split(':').map(Number);
                const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate(), hi, mi);
                const fin = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (h.dia_siguiente ? 1 : 0), hf, mf);
                if (fin > ini && ahora >= ini && ahora < fin) return h.turno;
            }
        }
        return 'extra';
    }
    const hora = ahora.getHours();
    return (hora >= 6 && hora < 22) ? 'dia' : 'noche';
}
