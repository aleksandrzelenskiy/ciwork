// src/server/socket/token.ts

import 'server-only';

import crypto from 'node:crypto';
import { getServerEnv } from '@/config/env';

const getSecret = () => {
    const env = getServerEnv();
    return (
        env.NOTIFICATIONS_SOCKET_SECRET ||
        env.CLERK_SECRET_KEY ||
        'dev-notifications-socket-secret'
    );
};

const TOKEN_TTL_MS = 1000 * 60 * 30; // 30 минут

type SocketTokenPayload = {
    userId: string;
    exp: number;
};

const encode = (payload: SocketTokenPayload) =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');

const decode = (value: string): SocketTokenPayload | null => {
    try {
        const raw = Buffer.from(value, 'base64url').toString('utf8');
        return JSON.parse(raw) as SocketTokenPayload;
    } catch {
        return null;
    }
};

export const signSocketToken = (userId: string): string => {
    const payload: SocketTokenPayload = {
        userId,
        exp: Date.now() + TOKEN_TTL_MS,
    };
    const encoded = encode(payload);
    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(encoded);
    const signature = hmac.digest('base64url');
    return `${encoded}.${signature}`;
};

export const verifySocketToken = (token: string): string | null => {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) {
        return null;
    }
    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(encodedPayload);
    const expectedSignature = hmac.digest('base64url');
    if (signature.length !== expectedSignature.length) {
        return null;
    }
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
        return null;
    }
    const payload = decode(encodedPayload);
    if (!payload || !payload.userId) {
        return null;
    }
    if (payload.exp < Date.now()) {
        return null;
    }
    return payload.userId;
};
