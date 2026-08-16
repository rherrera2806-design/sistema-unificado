const crypto = require('crypto');

const loginAttempts = new Map();
const RATE_LIMIT_MAX = 50;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000;

function checkRateLimit(ip) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    const recentAttempts = attempts.filter(t => now - t < RATE_LIMIT_WINDOW);
    loginAttempts.set(ip, recentAttempts);
    return recentAttempts.length < RATE_LIMIT_MAX;
}

function recordLoginAttempt(ip) {
    const attempts = loginAttempts.get(ip) || [];
    attempts.push(Date.now());
    loginAttempts.set(ip, attempts);
}

const globalRequests = new Map();
const GLOBAL_RATE_MAX = 100;
const GLOBAL_RATE_WINDOW = 60 * 1000;

function checkGlobalRateLimit(ip) {
    const now = Date.now();
    const requests = globalRequests.get(ip) || [];
    const recent = requests.filter(t => now - t < GLOBAL_RATE_WINDOW);
    globalRequests.set(ip, recent);
    return recent.length < GLOBAL_RATE_MAX;
}

setInterval(() => {
    const now = Date.now();
    for (const [ip, requests] of globalRequests) {
        const recent = requests.filter(t => now - t < GLOBAL_RATE_WINDOW);
        if (recent.length === 0) globalRequests.delete(ip);
        else globalRequests.set(ip, recent);
    }
}, 5 * 60 * 1000);

const sessions = new Map();
const SESSION_TTL = 24 * 60 * 60 * 1000;

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { user, createdAt: Date.now() });
    return token;
}

function getSession(token) {
    if (!token || !sessions.has(token)) return null;
    const session = sessions.get(token);
    if (Date.now() - session.createdAt > SESSION_TTL) {
        sessions.delete(token);
        return null;
    }
    return session.user;
}

function destroySession(token) {
    if (token) sessions.delete(token);
}

setInterval(() => {
    const now = Date.now();
    for (const [token, session] of sessions) {
        if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
    }
}, 60 * 60 * 1000);

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com data:; img-src 'self' data:; connect-src 'self' ws: wss:");
}

module.exports = {
    checkRateLimit,
    recordLoginAttempt,
    checkGlobalRateLimit,
    createSession,
    getSession,
    destroySession,
    setSecurityHeaders,
    SESSION_TTL
};
