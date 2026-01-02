// src/app/api/org/[org]/projects/route.ts

import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Project from '@/server/models/ProjectModel';
import Membership from '@/server/models/MembershipModel';
import { consumeUsageSlot } from '@/utils/billingLimits';
import { requireOrgRole } from '@/server/org/permissions';
import { RUSSIAN_REGIONS } from '@/app/utils/regions';
import { OPERATORS } from '@/app/utils/operators';
import { ensureSubscriptionWriteAccess } from '@/utils/subscriptionBilling';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function toHttpError(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Организация не найдена|Org not found/i.test(msg)) return NextResponse.json({ error: 'Org not found' }, { status: 404 });
    if (/Нет членства|Недостаточно прав|Forbidden/i.test(msg)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
}

type ProjectDTO = {
    _id: string;
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    managerEmail?: string | null;
    regionCode: string;
    operator: string;
};

type ProjectsResponse = { projects: ProjectDTO[] } | { error: string };
type CreateProjectBody = {
    name: string;
    key: string;
    description?: string;
    regionCode: string;
    operator: string;
    managers?: string[];
};
type CreateProjectResponse = { ok: true; project: ProjectDTO } | { error: string };

// Lean-тип для документов проекта
interface ProjectLean {
    _id: string | { toString(): string };
    name: string;
    key: string;
    description?: string;
    managers?: string[];
    regionCode: string;
    operator: string;
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeEmailsArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return [];
    const result: string[] = [];
    value.forEach((item) => {
        if (typeof item !== 'string') return;
        const normalized = item.trim().toLowerCase();
        if (normalized && !result.includes(normalized)) {
            result.push(normalized);
        }
    });
    return result;
};

async function resolveManagerEmails(
    orgId: unknown,
    candidates: string[],
    fallbackEmail: string
): Promise<string[]> {
    const normalized = candidates.length > 0 ? candidates : [fallbackEmail];
    const rows = await Membership.find(
        { orgId, userEmail: { $in: normalized }, status: 'active' },
        { userEmail: 1 }
    ).lean<{ userEmail: string }[]>();
    const allowed = rows.map((row) => row.userEmail);
    if (allowed.length === 0) {
        return [fallbackEmail];
    }
    return allowed;
}

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<ProjectsResponse>> {
    try {
        await dbConnect();

        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgDoc, membership } = await requireOrgRole(
            orgSlug,
            email,
            ['owner', 'org_admin', 'manager', 'executor', 'viewer']
        );

        const role = membership.role;
        if (!['owner', 'org_admin', 'manager'].includes(role)) {
            return NextResponse.json({ error: 'Недостаточно прав' }, { status: 404 });
        }

        const normalizedManagerEmail = membership.userEmail?.trim().toLowerCase();
        const projectFilter: Record<string, unknown> = { orgId: orgDoc._id };

        if (role === 'manager' && normalizedManagerEmail) {
            projectFilter.managers = {
                $regex: new RegExp(`^${escapeRegex(normalizedManagerEmail)}$`, 'i'),
            };
        }

        const rows = await Project.find(
            projectFilter,
            { name: 1, key: 1, description: 1, managers: 1, regionCode: 1, operator: 1 }
        ).lean<ProjectLean[]>();

        const projects: ProjectDTO[] = rows.map((p: ProjectLean) => {
            const managers = Array.isArray(p.managers) ? p.managers : [];
            return {
                _id: typeof p._id === 'string' ? p._id : p._id.toString(),
                name: p.name,
                key: p.key,
                description: p.description,
                managers,
                managerEmail: managers[0] ?? null,
                regionCode: p.regionCode,
                operator: p.operator,
            };
        });

        return NextResponse.json({ projects });
    } catch (e) {
        return toHttpError(e);
    }
}

export async function POST(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<CreateProjectResponse>> {
    try {
        await dbConnect();

        const { org } = await ctx.params;
        const orgSlug = org?.trim().toLowerCase();

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress?.trim().toLowerCase();
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org: orgDoc } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const access = await ensureSubscriptionWriteAccess(orgDoc._id);
        if (!access.ok) {
            return NextResponse.json(
                {
                    error: access.reason || 'Недостаточно средств для оплаты подписки',
                    graceAvailable: access.graceAvailable,
                    graceUntil: access.graceUntil ? access.graceUntil.toISOString() : null,
                },
                { status: 402 }
            );
        }

        const body = (await request.json()) as CreateProjectBody;
        const name = body?.name?.trim();
        const key = body?.key?.trim();
        const isValidRegion = RUSSIAN_REGIONS.some((region) => region.code === body.regionCode);
        const isValidOperator = OPERATORS.some((operator) => operator.value === body.operator);

        if (!name || !key || !isValidRegion || !isValidOperator) {
            return NextResponse.json({ error: 'Укажите name, key, regionCode и operator' }, { status: 400 });
        }

        const normalizedManagers = normalizeEmailsArray(body.managers);
        const managerEmails = await resolveManagerEmails(orgDoc._id, normalizedManagers, email);

        const session = await mongoose.startSession();
        let project: ProjectDTO | null = null;
        let limitError: string | null = null;

        try {
            await session.withTransaction(async () => {
                const limit = await consumeUsageSlot(orgDoc._id, 'projects', { session });
                if (!limit.ok) {
                    const limitValue = Number.isFinite(limit.limit ?? null) ? limit.limit : '∞';
                    limitError =
                        limit.reason ||
                        `Достигнут лимит проектов: ${limit.used}/${limitValue}`;
                    throw new Error('LIMIT_REACHED');
                }

                const [created] = await Project.create(
                    [
                        {
                            orgId: orgDoc._id,
                            name,
                            key: key.toUpperCase(),
                            description: body?.description,
                            managers: managerEmails,
                            createdByEmail: email,
                            regionCode: body.regionCode,
                            operator: body.operator,
                        },
                    ],
                    { session }
                );

                const createdManagers: string[] = Array.isArray(
                    (created as { managers?: unknown }).managers
                )
                    ? ((created as { managers?: unknown }).managers as string[])
                    : [email];

                project = {
                    _id: String(created._id),
                    name: created.name,
                    key: created.key,
                    description: created.description,
                    managers: createdManagers,
                    managerEmail: createdManagers[0] ?? email,
                    regionCode: created.regionCode,
                    operator: created.operator,
                };
            });
        } catch (e) {
            if ((e as Error).message === 'LIMIT_REACHED') {
                return NextResponse.json(
                    { error: limitError ?? 'Лимит проектов исчерпан' },
                    { status: 402 }
                );
            }
            return toHttpError(e);
        } finally {
            await session.endSession();
        }

        if (!project) {
            return NextResponse.json({ error: 'Не удалось создать проект' }, { status: 500 });
        }

        return NextResponse.json({ ok: true, project });
    } catch (e) {
        return toHttpError(e);
    }
}
