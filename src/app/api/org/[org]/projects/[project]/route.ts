// src/app/api/org/[org]/projects/[project]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Project from '@/server/models/ProjectModel';
import { requireOrgRole } from '@/server/org/permissions';
import Membership from '@/server/models/MembershipModel';
import { Types } from 'mongoose';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import { syncProjectsUsage } from '@/utils/billingLimits';
import { deleteStoragePrefix } from '@/utils/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

const normalizeEmailsArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const emails: string[] = [];
    value.forEach((entry) => {
        if (typeof entry !== 'string') return;
        const normalized = entry.trim().toLowerCase();
        if (normalized && !emails.includes(normalized)) {
            emails.push(normalized);
        }
    });
    return emails;
};

async function resolveManagerEmails(
    orgId: Types.ObjectId,
    candidates: string[],
    fallbackEmail: string
): Promise<string[]> {
    const queryList = candidates.length > 0 ? candidates : [fallbackEmail];
    const rows = await Membership.find(
        { orgId, userEmail: { $in: queryList }, status: 'active' },
        { userEmail: 1 }
    ).lean<{ userEmail: string }[]>();
    const allowed = rows.map((row) => row.userEmail);
    if (allowed.length === 0) return [fallbackEmail];
    return allowed;
}

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    projectType: 'installation' | 'document';
    regionCode: string;
    operator: string;
    managers?: string[];
};

type UpdateBody = {
    name?: string;
    key?: string;
    description?: string;
    projectType?: 'installation' | 'document';
    regionCode?: string;
    operator?: string;
    managers?: string[];
};
type UpdateResponse = { ok: true; project: ProjectDTO } | { error: string };
type GetResponse = { ok: true; project: ProjectDTO } | { error: string };
type DeleteResponse = { ok: true } | { error: string };

type ProjectLean = {
    _id: Types.ObjectId | string;
    name: string;
    key: string;
    description?: string;
    projectType?: 'installation' | 'document';
    regionCode: string;
    operator: string;
    managers?: string[];
};

const normalizeProjectType = (value?: string | null): 'installation' | 'document' | undefined => {
    if (!value) return undefined;
    if (value === 'construction') return 'installation';
    if (value === 'installation' || value === 'document') return value;
    return undefined;
};

function getProjectMatch(projectRef: string, orgId: Types.ObjectId) {
    const isId = Types.ObjectId.isValid(projectRef);
    return isId
        ? { _id: projectRef, orgId }
        : { key: String(projectRef).toUpperCase().trim(), orgId };
}

function toProjectDto(doc: ProjectLean): ProjectDTO {
    return {
        _id: String(doc._id),
        name: doc.name,
        key: doc.key,
        description: doc.description,
        projectType: normalizeProjectType(doc.projectType) ?? 'installation',
        regionCode: doc.regionCode,
        operator: doc.operator,
        managers: Array.isArray(doc.managers) ? doc.managers : undefined,
    };
}

/**
 * GET /api/org/:org/projects/:project — получить проект (любой член организации)
 */
export async function GET(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<GetResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org, membership } = await requireOrgRole(orgSlug, email, [
            'owner',
            'org_admin',
            'manager',
            'executor',
            'viewer',
        ]);

        const match = getProjectMatch(project, org._id);
        const found = await Project.findOne(match).lean<ProjectLean | null>();

        if (!found) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        const role = membership.role;
        if (!['owner', 'org_admin', 'manager'].includes(role)) {
            return NextResponse.json({ error: 'Недостаточно прав' }, { status: 404 });
        }

        if (role === 'manager') {
            const normalizedEmail = membership.userEmail?.trim().toLowerCase() ?? '';
            const managers = Array.isArray(found.managers) ? found.managers : [];
            const managesProject = managers.some(
                (m) => typeof m === 'string' && m.trim().toLowerCase() === normalizedEmail
            );

            if (!managesProject) {
                return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
            }
        }

        return NextResponse.json({ ok: true, project: toProjectDto(found) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

/**
 * PATCH /api/org/:org/projects/:project — обновить проект (owner/org_admin/manager)
 * :project — либо ObjectId, либо ключ проекта (key),
 */
export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<UpdateResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const body = (await request.json()) as UpdateBody;
        const update: Record<string, unknown> = {};

        if (typeof body.name === 'string') update.name = body.name.trim();
        if (typeof body.key === 'string') update.key = body.key.trim().toUpperCase(); // нормализуем KEY
        if (typeof body.description === 'string') update.description = body.description;
        if (typeof body.projectType === 'string') {
            const normalizedType = normalizeProjectType(body.projectType);
            if (!normalizedType) {
                return NextResponse.json({ error: 'Некорректный тип проекта' }, { status: 400 });
            }
            update.projectType = normalizedType;
        }

        if (typeof body.regionCode === 'string') {
            if (!RUSSIAN_REGIONS.some((region) => region.code === body.regionCode)) {
                return NextResponse.json({ error: 'Некорректный регион' }, { status: 400 });
            }
            update.regionCode = body.regionCode;
        }

        if (typeof body.operator === 'string') {
            if (!OPERATORS.some((operator) => operator.value === body.operator)) {
                return NextResponse.json({ error: 'Некорректный оператор' }, { status: 400 });
            }
            update.operator = body.operator;
        }

        if (Array.isArray(body.managers)) {
            const normalizedManagers = normalizeEmailsArray(body.managers);
            update.managers = await resolveManagerEmails(org._id, normalizedManagers, email);
        }

        if (Object.keys(update).length === 0) {
            return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
        }

        // --- главная смена логики поиска проекта ---
        const match = getProjectMatch(project, org._id);

        const updated = await Project.findOneAndUpdate(match, { $set: update }, { new: true }).lean<ProjectLean | null>();

        if (!updated) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        return NextResponse.json({ ok: true, project: toProjectDto(updated) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

/**
 * DELETE /api/org/:org/projects/:project — удалить проект (owner/org_admin/manager)
 * :project — либо ObjectId, либо ключ проекта (key)
 */
export async function DELETE(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string; project: string }> }
): Promise<NextResponse<DeleteResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug, project } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        // права (manager и выше)
        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const match = getProjectMatch(project, org._id);

        const deleted = await Project.findOneAndDelete(match).lean();

        if (!deleted) {
            return NextResponse.json({ error: 'Проект не найден' }, { status: 404 });
        }

        try {
            if (org.orgSlug && deleted.key) {
                const projectPrefix = `uploads/${org.orgSlug}/${deleted.key}/`;
                await deleteStoragePrefix(projectPrefix);
            }
        } catch (storageError) {
            console.warn('Failed to delete project storage folder', storageError);
        }

        try {
            await syncProjectsUsage(org._id);
        } catch (syncError) {
            console.warn('Failed to sync project usage after delete', syncError);
        }

        return NextResponse.json({ ok: true });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
