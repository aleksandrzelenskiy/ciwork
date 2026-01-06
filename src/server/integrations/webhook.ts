import 'server-only';

import crypto from 'node:crypto';
import { Types } from 'mongoose';
import IntegrationModel, { type Integration } from '@/server/models/IntegrationModel';
import { buildTaskSyncPayload } from '@/server/integrations/taskPayload';
import { decryptString } from '@/server/integrations/crypto';
import dbConnect from '@/server/db/mongoose';

export type TaskEventType = 'task.created' | 'task.updated' | 'task.deleted';

type DispatchParams = {
    eventType: TaskEventType;
    task: unknown;
    orgId?: Types.ObjectId | string | null;
    projectId?: Types.ObjectId | string | null;
};

type IntegrationDelivery = {
    integrationId: string;
    ok: boolean;
    status?: number;
    error?: string;
};

function signPayload(secret: string, timestamp: string, body: string): string {
    return crypto
        .createHmac('sha256', secret)
        .update(`${timestamp}.${body}`)
        .digest('hex');
}

function safeDecrypt(value: string | undefined | null): string | null {
    if (!value) return null;
    try {
        return decryptString(value);
    } catch (error) {
        console.error('Failed to decrypt integration secret:', error);
        return null;
    }
}

function normalizeObjectId(value?: Types.ObjectId | string | null): string | null {
    if (!value) return null;
    if (value instanceof Types.ObjectId) return value.toString();
    const trimmed = String(value).trim();
    return trimmed.length ? trimmed : null;
}

async function postWebhook(
    integration: Integration,
    body: string,
    timestamp: string
): Promise<IntegrationDelivery> {
    const webhookUrl = integration.webhookUrl?.trim();
    if (!webhookUrl) {
        return {
            integrationId: integration._id.toString(),
            ok: false,
            error: 'Webhook URL missing',
        };
    }

    const secret = safeDecrypt(integration.webhookSecret);
    if (!secret) {
        return {
            integrationId: integration._id.toString(),
            ok: false,
            error: 'Webhook secret missing',
        };
    }

    const signature = signPayload(secret, timestamp, body);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-task-signature': signature,
                'x-task-timestamp': timestamp,
            },
            body,
            signal: controller.signal,
        });

        return {
            integrationId: integration._id.toString(),
            ok: response.ok,
            status: response.status,
            error: response.ok ? undefined : `HTTP ${response.status}`,
        };
    } catch (error) {
        return {
            integrationId: integration._id.toString(),
            ok: false,
            error: error instanceof Error ? error.message : 'Webhook error',
        };
    } finally {
        clearTimeout(timeout);
    }
}

export async function dispatchTaskEvent(params: DispatchParams): Promise<IntegrationDelivery[]> {
    await dbConnect();

    const orgId = normalizeObjectId(params.orgId);
    if (!orgId) return [];

    const projectId = normalizeObjectId(params.projectId);

    const query: Record<string, unknown> = {
        orgId,
        status: 'active',
    };
    if (projectId) {
        query.$or = [{ projectId }, { projectId: { $exists: false } }, { projectId: null }];
    }

    const integrations = await IntegrationModel.find(query).lean<Integration[]>();

    if (!integrations.length) return [];

    const payload = {
        eventId: crypto.randomUUID(),
        eventType: params.eventType,
        occurredAt: new Date().toISOString(),
        orgId,
        projectId,
        task: buildTaskSyncPayload(params.task),
    };

    const body = JSON.stringify(payload);
    const timestamp = Date.now().toString();

    const results = await Promise.all(
        integrations.map((integration) => postWebhook(integration, body, timestamp))
    );

    results.forEach((result) => {
        if (!result.ok) {
            console.error('Integration delivery failed:', result);
        }
    });

    return results;
}
