import crypto from 'node:crypto';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

type InitiatorAccessPayload = {
    taskId: string;
    email: string;
    exp: number;
};

const getSecret = () =>
    process.env.REPORT_ACCESS_SECRET ||
    process.env.NOTIFICATIONS_SOCKET_SECRET ||
    process.env.CLERK_SECRET_KEY ||
    'dev-report-access-secret';

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const normalizeTaskId = (value: string) => value.trim().toUpperCase();

const encode = (payload: InitiatorAccessPayload) =>
    Buffer.from(JSON.stringify(payload)).toString('base64url');

const decode = (value: string): InitiatorAccessPayload | null => {
    try {
        const raw = Buffer.from(value, 'base64url').toString('utf8');
        return JSON.parse(raw) as InitiatorAccessPayload;
    } catch {
        return null;
    }
};

export const signInitiatorAccessToken = (params: {
    taskId: string;
    email: string;
    ttlMs?: number;
}): string => {
    const payload: InitiatorAccessPayload = {
        taskId: normalizeTaskId(params.taskId),
        email: normalizeEmail(params.email),
        exp: Date.now() + (params.ttlMs ?? TOKEN_TTL_MS),
    };
    const encoded = encode(payload);
    const hmac = crypto.createHmac('sha256', getSecret());
    hmac.update(encoded);
    const signature = hmac.digest('base64url');
    return `${encoded}.${signature}`;
};

export const verifyInitiatorAccessToken = (
    token: string
): InitiatorAccessPayload | null => {
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
    if (!payload || !payload.taskId || !payload.email) {
        return null;
    }
    if (!Number.isFinite(payload.exp) || payload.exp < Date.now()) {
        return null;
    }
    return {
        taskId: normalizeTaskId(payload.taskId),
        email: normalizeEmail(payload.email),
        exp: payload.exp,
    };
};
