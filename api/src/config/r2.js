const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'ordenes-venta';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-d70f793c9dc24a3fa46ef91fb4e0a45a.r2.dev';
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

function r2Sign(key, method, payloadHash) {
    const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const region = 'auto';
    const service = 's3';
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const canonicalUri = '/' + key.split('/').map(p => encodeURIComponent(p)).join('/');
    const canonicalRequest = `${method}\n${canonicalUri}\n\nhost:${host}\n\nhost\n${payloadHash}`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/${region}/${service}/aws4_request\n${canonicalRequestHash}`;
    const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
    return {
        url: `https://${host}${canonicalUri}`,
        host,
        authorization: `AWS4-HMAC-SHA256 Credential=${R2_ACCESS_KEY_ID}/${dateStamp}/${region}/${service}/aws4_request, SignedHeaders=host, Signature=${signature}`,
        amzDate,
        payloadHash,
    };
}

function r2CurlUpload(key, fileBuffer) {
    return new Promise((resolve, reject) => {
        const payloadHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        const signed = r2Sign(key, 'PUT', payloadHash);
        const tmpFile = path.join('/tmp', `r2_${Date.now()}.pdf`);
        fs.writeFileSync(tmpFile, fileBuffer);
        const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 30 --max-time 120 -k -X PUT -H 'Host: ${signed.host}' -H 'Content-Type: application/pdf' -H 'x-amz-content-sha256: ${signed.payloadHash}' -H 'x-amz-date: ${signed.amzDate}' -H 'Authorization: ${signed.authorization}' --data-binary @'${tmpFile}' '${signed.url}'`;
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            try { fs.unlinkSync(tmpFile); } catch(e) {}
            const status = parseInt((stdout || '').trim()) || 0;
            console.log('[R2] Curl exit:', err ? err.code : 'ok', 'status:', status, 'stderr:', (stderr || '').substring(0, 200));
            if (status >= 200 && status < 300) {
                resolve({ ok: true, status });
            } else if (err && status === 0) {
                reject(new Error('Curl fallo: ' + (stderr || err.message).substring(0, 100)));
            } else {
                reject(new Error('R2 respondio HTTP ' + status));
            }
        });
    });
}

function r2CurlDelete(key) {
    return new Promise((resolve) => {
        const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        const signed = r2Sign(key, 'DELETE', payloadHash);
        const cmd = `curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 30 -k -X DELETE -H 'Host: ${signed.host}' -H 'x-amz-content-sha256: ${signed.payloadHash}' -H 'x-amz-date: ${signed.amzDate}' -H 'Authorization: ${signed.authorization}' '${signed.url}'`;
        exec(cmd, { timeout: 30000 }, (err, stdout) => {
            try { resolve(parseInt((stdout || '').trim()) < 300); } catch(e) { resolve(false); }
        });
    });
}

async function r2Delete(key) {
    if (!R2_ACCESS_KEY_ID) return false;
    try { return await r2CurlDelete(key); }
    catch(e) { console.error('[R2] Delete error:', e.message); return false; }
}

module.exports = { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, r2Sign, r2CurlUpload, r2CurlDelete, r2Delete };
