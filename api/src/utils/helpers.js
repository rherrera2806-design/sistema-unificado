function sanitizeString(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>]/g, '').trim();
}

function validateRut(rut) {
    rut = rut.replace(/[^0-9kK]/g, '').toUpperCase();
    if (rut.length < 2) return false;
    const body = rut.slice(0, -1);
    const dv = rut.slice(-1);
    if (!/^\d+$/.test(body)) return false;
    let sum = 0, mul = 2;
    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * mul;
        mul = mul === 7 ? 2 : mul + 1;
    }
    const res = 11 - (sum % 11);
    const expected = res === 11 ? '0' : res === 10 ? 'K' : String(res);
    return dv === expected;
}

function validatePatente(patente) {
    patente = patente.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (patente.length === 0) return true;
    return /^[A-Z]{2}\d{4}$/.test(patente) || /^[A-Z]{4}\d{2}$/.test(patente);
}

function sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
            sanitized[key] = sanitizeString(value);
        } else if (typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeObject(value);
        } else if (Array.isArray(value)) {
            sanitized[key] = value.map(v => typeof v === 'string' ? sanitizeString(v) : v);
        } else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password && password.length >= 6;
}

function logEvent(type, details) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${type}: ${JSON.stringify(details)}`);
}

module.exports = {
    sanitizeString,
    validateRut,
    validatePatente,
    sanitizeObject,
    validateEmail,
    validatePassword,
    logEvent
};
