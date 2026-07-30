const crypto = require('crypto');
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_BUCKET_NAME, R2_PUBLIC_URL, r2Delete } = require('../config/r2');

const buildSigningKey = (dateStamp) => {
    const kDate = crypto.createHmac('sha256', `AWS4${R2_SECRET_ACCESS_KEY}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update('auto').digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
};

const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';

const generatePresignPost = (fileName) => {
    const key = `pedidos/${fileName}`;
    const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const expires = 3600;
    const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`;

    const policy = JSON.stringify({
        expiration: new Date(now.getTime() + expires * 1000).toISOString(),
        conditions: [
            { bucket: R2_BUCKET_NAME },
            ['eq', '$key', key],
            { 'Content-Type': 'application/pdf' },
            ['content-length-range', 1, 52428800]
        ]
    });
    const policyBase64 = Buffer.from(policy).toString('base64');
    const signingKey = buildSigningKey(dateStamp);
    const signature = crypto.createHmac('sha256', signingKey).update(policyBase64).digest('base64');

    return {
        url: `https://${host}/`,
        key,
        publicUrl: `${R2_PUBLIC_URL}/${key}`,
        AWSAccessKeyId: R2_ACCESS_KEY_ID,
        policy: policyBase64,
        signature,
        'Content-Type': 'application/pdf'
    };
};

const generatePresignPut = (fileName) => {
    const key = `pedidos/${fileName}`;
    const host = `${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.substring(0, 8);
    const expires = 3600;
    const credential = `${R2_ACCESS_KEY_ID}/${dateStamp}/auto/s3/aws4_request`;
    const canonicalUri = '/' + key.split('/').map(p => encodeURIComponent(p)).join('/');
    const canonicalRequest = `PUT\n${canonicalUri}\n\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
    const canonicalRequestHash = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${dateStamp}/auto/s3/aws4_request\n${canonicalRequestHash}`;
    const signingKey = buildSigningKey(dateStamp);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const queryParams = [
        'X-Amz-Algorithm=AWS4-HMAC-SHA256',
        `X-Amz-Credential=${encodeURIComponent(credential)}`,
        `X-Amz-Date=${amzDate}`,
        `X-Amz-Expires=${expires}`,
        'X-Amz-SignedHeaders=host',
        `X-Amz-Signature=${signature}`
    ].join('&');

    return {
        url: `https://${host}/${key}`,
        key,
        publicUrl: `${R2_PUBLIC_URL}/${key}`,
        queryParams
    };
};

const getPublicUrl = (key) => ({ url: `${R2_PUBLIC_URL}/${key}` });

const deleteFile = async (key) => {
    if (!R2_ACCESS_KEY_ID) throw new Error('R2 no configurado');
    const ok = await r2Delete(key);
    if (!ok) throw new Error('Error al eliminar archivo');
    return { ok: true };
};

module.exports = { generatePresignPost, generatePresignPut, getPublicUrl, deleteFile };
