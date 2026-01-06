import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import IntegrationModel from '@/server/models/IntegrationModel';
import ProjectModel from '@/server/models/ProjectModel';
import { encryptString } from '@/server/integrations/crypto';

type UpdateIntegrationBody = {
    name?: string;
    webhookUrl?: string;
    projectId?: string | null;
    status?: 'active' | 'paused';
    config?: Record<string, unknown>;
};

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
    rawProjectId: string | null | undefined,
    orgId: Types.ObjectId
): Promise<Types.ObjectId | null> {
    if (!rawProjectId) return null;
    if (!Types.ObjectId.isValid(rawProjectId)) return null;
    const project = await ProjectModel.findOne({ _id: rawProjectId, orgId })
        .select('_id')
        .lean<{ _id: Types.ObjectId }>();
    return project?._id ?? null;
}

export async function PATCH(
    req: NextRequest,
    ctx: { params: Promise<{ org: string; integrationId: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlugRaw, integrationId } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);
        if (!Types.ObjectId.isValid(integrationId)) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        const body = (await req.json().catch(() => ({}))) as UpdateIntegrationBody;

        const update: Record<string, unknown> = {};

        if (typeof body.status === 'string' && (body.status === 'active' || body.status === 'paused')) {
            update.status = body.status;
        }

        const name = normalizeString(body.name);
        if (typeof body.name === 'string') {
            update.name = name ?? '';
        }

        const webhookUrl = normalizeString(body.webhookUrl);
        if (typeof body.webhookUrl === 'string') {
            if (!webhookUrl || !isValidUrl(webhookUrl)) {
                return NextResponse.json({ error: 'Invalid webhookUrl' }, { status: 400 });
            }
            update.webhookUrl = webhookUrl;
        }

        if ('projectId' in body) {
            const projectId = await resolveProjectId(body.projectId ?? null, org._id);
            update.projectId = projectId ?? null;
        }

        if (body.config && typeof body.config === 'object') {
            update.config = encryptString(JSON.stringify(body.config));
        }

        const updated = await IntegrationModel.findOneAndUpdate(
            { _id: integrationId, orgId: org._id },
            { $set: update },
            { new: true }
        )
            .select('type name status webhookUrl projectId createdAt updatedAt')
            .lean();

        if (!updated) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        return NextResponse.json({ integration: updated });
    } catch (error) {
        console.error('Failed to update integration:', error);
        return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string; integrationId: string }> }
) {
    try {
        await dbConnect();
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgSlugRaw, integrationId } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);
        if (!Types.ObjectId.isValid(integrationId)) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        const deleted = await IntegrationModel.findOneAndDelete({
            _id: integrationId,
            orgId: org._id,
        }).lean();

        if (!deleted) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Failed to delete integration:', error);
        return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 });
    }
}
