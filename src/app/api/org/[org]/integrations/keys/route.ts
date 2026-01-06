import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import { getOrgBySlug } from '@/server/org/permissions';
import IntegrationApiKeyModel from '@/server/models/IntegrationApiKeyModel';
import ProjectModel from '@/server/models/ProjectModel';
import { generateApiKey } from '@/server/integrations/keys';
import { GetCurrentUserFromMongoDB } from '@/server-actions/users';

type CreateKeyBody = {
    scopes?: string[];
    projectId?: string;
};

function normalizeScopes(scopes: unknown): string[] {
    if (!Array.isArray(scopes)) return ['tasks:read'];
    const filtered = scopes.filter((scope) => typeof scope === 'string' && scope.trim());
    return filtered.length ? Array.from(new Set(filtered)) : ['tasks:read'];
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

export async function POST(
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const current = await GetCurrentUserFromMongoDB();
        if (!current.success) {
            return NextResponse.json({ error: 'Auth required' }, { status: 401 });
        }
        if (current.data.platformRole !== 'super_admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { org: orgSlugRaw } = await ctx.params;
        const orgSlug = orgSlugRaw?.trim().toLowerCase();
        if (!orgSlug) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

        const org = await getOrgBySlug(orgSlug);

        const body = (await req.json().catch(() => ({}))) as CreateKeyBody;
        const scopes = normalizeScopes(body.scopes);
        const projectId = await resolveProjectId(body.projectId, org._id);

        const keyMaterial = generateApiKey();
        await IntegrationApiKeyModel.create({
            orgId: org._id,
            projectId: projectId ?? undefined,
            keyId: keyMaterial.keyId,
            keyHash: keyMaterial.keyHash,
            keySalt: keyMaterial.keySalt,
            scopes,
            status: 'active',
        });

        return NextResponse.json(
            {
                keyId: keyMaterial.keyId,
                keySecret: keyMaterial.keySecret,
                scopes,
                projectId: projectId?.toString() ?? null,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Failed to create integration API key:', error);
        return NextResponse.json({ error: 'Failed to create key' }, { status: 500 });
    }
}
