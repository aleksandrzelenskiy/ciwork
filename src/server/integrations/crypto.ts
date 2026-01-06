import 'server-only';

import crypto from 'node:crypto';
import { requireEnv } from '@/config/env';

const RAW_KEY = requireEnv('INTEGRATIONS_ENCRYPTION_KEY', 'INTEGRATIONS_ENCRYPTION_KEY');
const KEY = crypto.createHash('sha256').update(RAW_KEY).digest();

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;

export function encryptString(value: string): string {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv(ALGO, KEY, iv);
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
    const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
    return plaintext.toString('utf8');
}
