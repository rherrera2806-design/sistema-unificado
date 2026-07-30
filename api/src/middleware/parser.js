const zlib = require('zlib');
const { MAX_BODY_SIZE } = require('../config/constants');

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        req.on('data', chunk => {
            size += chunk.length;
            if (size > MAX_BODY_SIZE) {
                reject(new Error('Body too large'));
                req.destroy();
                return;
            }
            body += chunk;
        });
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch(e) { resolve({}); }
        });
        req.on('error', () => resolve({}));
    });
}

function json(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

function parseQuery(url) {
    const idx = url.indexOf('?');
    if (idx === -1) return { path: url, query: {} };
    const qs = url.substring(idx + 1);
    const query = {};
    qs.split('&').forEach(p => {
        const [k, v] = p.split('=').map(decodeURIComponent);
        query[k] = v;
    });
    return { path: url.substring(0, idx), query };
}

function compressAndSend(res, content, headers) {
    const acceptEncoding = res.req?.headers?.['accept-encoding'] || '';
    const textTypes = ['.html', '.css', '.js', '.json', '.svg'];
    const ext = headers['Content-Type'] ? '.' + headers['Content-Type'].split('/')[1]?.split(';')[0] : '';
    
    if (textTypes.some(t => headers['Content-Type']?.includes(t)) && acceptEncoding.includes('gzip')) {
        zlib.gzip(content, (err, compressed) => {
            if (!err && compressed.length < content.length) {
                headers['Content-Encoding'] = 'gzip';
                headers['Content-Length'] = compressed.length;
                res.writeHead(200, headers);
                res.end(compressed);
            } else {
                headers['Content-Length'] = content.length;
                res.writeHead(200, headers);
                res.end(content);
            }
        });
    } else {
        headers['Content-Length'] = content.length;
        res.writeHead(200, headers);
        res.end(content);
    }
}

module.exports = { parseBody, json, parseQuery, compressAndSend };
