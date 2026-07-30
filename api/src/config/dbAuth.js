const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const hashPassword = (password) => bcrypt.hashSync(password, BCRYPT_ROUNDS);

const verifyPassword = (password, hash) => {
    if (!hash) return false;
    if (hash.length === 64 && /^[a-f0-9]+$/.test(hash)) {
        const sha256 = crypto.createHash('sha256').update(password).digest('hex');
        if (sha256 === hash) {
            const newHash = bcrypt.hashSync(password, BCRYPT_ROUNDS);
            return { migrated: true, newHash };
        }
        return false;
    }
    return bcrypt.compareSync(password, hash);
};

module.exports = { hashPassword, verifyPassword };
