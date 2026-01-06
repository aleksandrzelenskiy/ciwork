import 'server-only';

import crypto from 'node:crypto';
import { requireEnv } from '@/config/env';

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
let cachedKey: Buffer | null = null;

function getKey(): Buffer {
    if (!cachedKey) {
        const rawKey = requireEnv('INTEGRATIONS_ENCRYPTION_KEY', 'INTEGRATIONS_ENCRYPTION_KEY');
        cachedKey = crypto.createHash('sha256').update(rawKey).digest();
    }
    return cachedKey;
}

export function encryptString(value: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
        iv.toString('base64'),
        tag.toString('base64'),
        ciphertext.toString('base64'),
    ].join('.');
}

export function decryptString(payload: string): string {
    const parts = payload.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload');
    }
    const [ivRaw, tagRaw, dataRaw] = parts;
    const iv = Buffer.from(ivRaw, 'base64');
    const tag = Buffer.from(tagRaw, 'base64');
    const data = Buffer.from(dataRaw, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
}
