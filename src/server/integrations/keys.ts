import 'server-only';

import crypto from 'node:crypto';

export type ApiKeyMaterial = {
    keyId: string;
    keySecret: string;
    keySalt: string;
    keyHash: string;
};

export function generateApiKey(): ApiKeyMaterial {
    const keyId = `ik_${crypto.randomBytes(6).toString('hex')}`;
    const keySecret = crypto.randomBytes(32).toString('base64url');
    const keySalt = crypto.randomBytes(16).toString('hex');
    const keyHash = crypto.scryptSync(keySecret, keySalt, 64).toString('hex');
    return { keyId, keySecret, keySalt, keyHash };
}

export function verifyApiKey(secret: string, salt: string, expectedHash: string): boolean {
    const actual = crypto.scryptSync(secret, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
}
