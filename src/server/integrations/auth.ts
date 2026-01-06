import 'server-only';

import IntegrationApiKeyModel, { type IntegrationApiKey } from '@/server/models/IntegrationApiKeyModel';
import { verifyApiKey } from '@/server/integrations/keys';
import dbConnect from '@/server/db/mongoose';

type AuthResult =
    | { ok: true; key: IntegrationApiKey }
    | { ok: false; error: string; status: number };

const HEADER_KEY_ID = 'x-task-key-id';
const HEADER_KEY_SECRET = 'x-task-key';

function normalizeHeader(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
}

export async function requireIntegrationKey(
    headers: Headers,
    requiredScopes: string[]
): Promise<AuthResult> {
    await dbConnect();

    const keyId = normalizeHeader(headers.get(HEADER_KEY_ID));
    const keySecret = normalizeHeader(headers.get(HEADER_KEY_SECRET));

    if (!keyId || !keySecret) {
        return { ok: false, error: 'Missing API key', status: 401 };
    }

    const keyDoc = await IntegrationApiKeyModel.findOne({
        keyId,
        status: 'active',
    }).lean<IntegrationApiKey>();

    if (!keyDoc) {
        return { ok: false, error: 'Invalid API key', status: 401 };
    }

    if (!verifyApiKey(keySecret, keyDoc.keySalt, keyDoc.keyHash)) {
        return { ok: false, error: 'Invalid API key', status: 401 };
    }

    const scopes = Array.isArray(keyDoc.scopes) ? keyDoc.scopes : [];
    const missing = requiredScopes.find((scope) => !scopes.includes(scope));
    if (missing) {
        return { ok: false, error: 'Insufficient scope', status: 403 };
    }

    await IntegrationApiKeyModel.updateOne(
        { _id: keyDoc._id },
        { $set: { lastUsedAt: new Date() } }
    );

    return { ok: true, key: keyDoc };
}
