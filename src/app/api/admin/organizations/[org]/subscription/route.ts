// src/app/api/admin/organizations/[org]/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GetUserContext } from '@/server-actions/user-context';
import dbConnect from '@/utils/mongoose';
import Organization from '@/app/models/OrganizationModel';
import Subscription from '@/app/models/SubscriptionModel';
import { resolvePlanLimits } from '@/utils/billingLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRIAL_DURATION_DAYS = 10;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type SubStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type AdminSubscriptionDTO = {
    orgSlug: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: string | null;
    periodEnd?: string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: string;
};

type PatchBody = Partial<{
    plan: Plan;
    status: SubStatus;
    seats: number;
    projectsLimit: number;
    publicTasksLimit: number;
    boostCredits: number;
    storageLimitGb: number;
    periodStart: string | null;
    periodEnd: string | null;
    note: string;
}>;

type PatchResponse = { ok: true; subscription: AdminSubscriptionDTO } | { error: string };

const parseDateOrNull = (value: string | null | undefined): Date | null => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const toISO = (value?: Date | string | null): string | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

const clampTrialWindow = (
    rawStart: Date | null | undefined,
    rawEnd: Date | null | undefined
): { start: Date; end: Date } => {
    const now = new Date();
    const start = rawStart && !Number.isNaN(rawStart.getTime()) ? rawStart : now;
    const defaultEnd = new Date(start.getTime() + TRIAL_DURATION_MS);
    if (!rawEnd || Number.isNaN(rawEnd.getTime())) {
        return { start, end: defaultEnd };
    }
    const maxEnd = new Date(start.getTime() + TRIAL_DURATION_MS);
    const end = rawEnd.getTime() > maxEnd.getTime() ? maxEnd : rawEnd;
    return { start, end };
};

export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<PatchResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!context.data.user?.email) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { org: orgRaw } = await ctx.params;
    const orgSlug = orgRaw?.trim().toLowerCase();
    if (!orgSlug) {
        return NextResponse.json({ error: 'Org not specified' }, { status: 400 });
    }

    await dbConnect();
    const organization = await Organization.findOne({ orgSlug });
    if (!organization) {
        return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
    }

    const existingSubscription = await Subscription.findOne({ orgId: organization._id }).lean();
    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const parsedPeriodStart = 'periodStart' in body ? parseDateOrNull(body.periodStart ?? null) : undefined;
    const parsedPeriodEnd = 'periodEnd' in body ? parseDateOrNull(body.periodEnd ?? null) : undefined;

    const currentPlan = (existingSubscription?.plan as Plan | undefined) ?? 'basic';
    const nextPlan = body.plan ?? currentPlan;
    const planChanged = !existingSubscription || (body.plan ? body.plan !== currentPlan : false);

    const limitOverrides = planChanged
        ? {
              seats: 'seats' in body ? body.seats : undefined,
              projectsLimit: 'projectsLimit' in body ? body.projectsLimit : undefined,
              publicTasksLimit: 'publicTasksLimit' in body ? body.publicTasksLimit : undefined,
          }
        : {
              seats: 'seats' in body ? body.seats : existingSubscription?.seats,
              projectsLimit: 'projectsLimit' in body ? body.projectsLimit : existingSubscription?.projectsLimit,
              publicTasksLimit: 'publicTasksLimit' in body ? body.publicTasksLimit : existingSubscription?.publicTasksLimit,
          };

    const resolvedLimits = resolvePlanLimits(nextPlan, limitOverrides);
    const shouldUpdateLimits =
        planChanged ||
        'seats' in body ||
        'projectsLimit' in body ||
        'publicTasksLimit' in body;

    const update: Partial<{
        plan: Plan;
        status: SubStatus;
        seats?: number;
        projectsLimit?: number;
        publicTasksLimit?: number;
        boostCredits?: number;
        storageLimitGb?: number;
        periodStart?: Date | null;
        periodEnd?: Date | null;
        note?: string;
        updatedByEmail: string;
        updatedAt: Date;
    }> = {
        ...('plan' in body || !existingSubscription ? { plan: nextPlan } : {}),
        ...('status' in body ? { status: body.status } : {}),
        ...(shouldUpdateLimits
            ? {
                  seats: resolvedLimits.seats ?? undefined,
                  projectsLimit: resolvedLimits.projects ?? undefined,
                  publicTasksLimit: resolvedLimits.publications ?? undefined,
              }
            : {}),
        ...('boostCredits' in body ? { boostCredits: body.boostCredits } : {}),
        ...('storageLimitGb' in body ? { storageLimitGb: body.storageLimitGb } : {}),
        ...('periodStart' in body ? { periodStart: parsedPeriodStart ?? null } : {}),
        ...('periodEnd' in body ? { periodEnd: parsedPeriodEnd ?? null } : {}),
        ...('note' in body ? { note: body.note } : {}),
        updatedByEmail: context.data.user.email,
        updatedAt: new Date(),
    };

    if (body.status === 'trial') {
        const { start, end } = clampTrialWindow(parsedPeriodStart ?? null, parsedPeriodEnd ?? null);
        update.periodStart = start;
        update.periodEnd = end;
    }

    const saved = await Subscription.findOneAndUpdate(
        { orgId: organization._id },
        { $set: update },
        { upsert: true, new: true }
    ).lean();

    if (!saved) {
        return NextResponse.json({ error: 'Не удалось обновить подписку' }, { status: 500 });
    }

    const subscription: AdminSubscriptionDTO = {
        orgSlug: organization.orgSlug,
        plan: saved.plan as Plan,
        status: saved.status as SubStatus,
        seats: saved.seats,
        projectsLimit: saved.projectsLimit,
        publicTasksLimit: saved.publicTasksLimit,
        boostCredits: saved.boostCredits,
        storageLimitGb: saved.storageLimitGb,
        periodStart: toISO(saved.periodStart),
        periodEnd: toISO(saved.periodEnd),
        note: saved.note,
        updatedByEmail: saved.updatedByEmail,
        updatedAt: toISO(saved.updatedAt ?? saved.createdAt) ?? new Date().toISOString(),
    };

    return NextResponse.json({ ok: true, subscription });
}
