import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import IntegrationModel, { type IntegrationType } from '@/server/models/IntegrationModel';
import ProjectModel from '@/server/models/ProjectModel';
import { encryptString } from '@/server/integrations/crypto';
import crypto from 'node:crypto';

type IntegrationConfig = Record<string, unknown>;

type CreateIntegrationBody = {
    type?: IntegrationType;
    name?: string;
    webhookUrl?: string;
    projectId?: string;
    config?: IntegrationConfig;
};

const ALLOWED_TYPES = new Set<IntegrationType>([
    'google_sheets',
    'telegram',
    'erp_1c',
]);

function normalizeString(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
}

function isValidUrl(value: string): boolean {
    try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
        return false;
    }
}

async function resolveProjectId(
    rawProjectId: string | undefined,
    orgId: Types.ObjectId
): Promise<Types.ObjectId | null> {
    if (!rawProjectId || !Types.ObjectId.isValid(rawProjectId)) return null;
    const project = await ProjectModel.findOne({ _id: rawProjectId, orgId })
        .select('_id')
        .lean<{ _id: Types.ObjectId }>();
    return project?._id ?? null;
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlugRaw } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);
        const items = await IntegrationModel.find({ orgId: org._id })
            .select('type name status webhookUrl projectId createdAt updatedAt')
            .lean();

        return NextResponse.json({ integrations: items });
    } catch (error) {
        console.error('Failed to load integrations:', error);
        return NextResponse.json({ error: 'Failed to load integrations' }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlugRaw } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);

        const body = (await req.json().catch(() => ({}))) as CreateIntegrationBody;
        const type = body.type;
        if (!type || !ALLOWED_TYPES.has(type)) {
            return NextResponse.json({ error: 'Invalid integration type' }, { status: 400 });
        }

        const webhookUrl = normalizeString(body.webhookUrl);
        if (!webhookUrl || !isValidUrl(webhookUrl)) {
            return NextResponse.json({ error: 'Invalid webhookUrl' }, { status: 400 });
        }

        const projectId = await resolveProjectId(body.projectId, org._id);
        const name = normalizeString(body.name) ?? '';
        const config = body.config ?? {};

        const webhookSecret = crypto.randomBytes(32).toString('base64url');
        const encryptedSecret = encryptString(webhookSecret);
        const encryptedConfig = encryptString(JSON.stringify(config));

        const integration = await IntegrationModel.create({
            orgId: org._id,
            projectId: projectId ?? undefined,
            type,
            name,
            webhookUrl,
            webhookSecret: encryptedSecret,
            config: encryptedConfig,
            status: 'active',
        });

        return NextResponse.json(
            {
                integrationId: integration._id.toString(),
                webhookSecret,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create integration:', error);
        return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 });
    }
}
