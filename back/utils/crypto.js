const crypto = require('crypto');
const keyCrypt = 'c8f94947fd2ad692190034fe745edbe6dea5fa2d585635aed45527e68d52fb9f';
const keyBuffer = Buffer.from(keyCrypt, 'hex'); 

function encriptar(text) {
    const iv = crypto.randomBytes(12);
    var cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv)
    var crypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, crypted]).toString('base64');
}

function decrypt(passEncrypted) {
    const data = Buffer.from(passEncrypted, 'base64');
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    var decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

module.exports.decrypt = decrypt
module.exports.encriptar = encriptar