// src/app/api/org/[org]/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Subscription from '@/server/models/SubscriptionModel';
import { requireOrgRole } from '@/server/org/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TRIAL_DURATION_DAYS = 10;
const TRIAL_DURATION_MS = TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;

function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : 'Server error';
}

type Plan = 'basic' | 'pro' | 'business' | 'enterprise';
type SubStatus = 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';

type ISODateString = string;

type SubscriptionDTO = {
    orgSlug: string;
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: ISODateString | null;
    periodEnd?: ISODateString | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: ISODateString;
};

type GetSubResponse = { subscription: SubscriptionDTO } | { error: string };

type PatchBody = Partial<
    Pick<
        SubscriptionDTO,
        'plan' | 'status' | 'seats' | 'projectsLimit' | 'publicTasksLimit' | 'boostCredits' | 'storageLimitGb' | 'periodStart' | 'periodEnd' | 'note'
    >
>;
type PatchSubResponse = { ok: true; subscription: SubscriptionDTO } | { error: string };

/** Lean-документ подписки, возвращаемый .lean() */
interface SubscriptionLean {
    plan: Plan;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: Date | string | null;
    periodEnd?: Date | string | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt?: Date | string;
    createdAt?: Date | string;
}

/** Привести любую дату (Date | string | undefined | null) к ISO или null */
function toISO(d: Date | string | undefined | null): ISODateString | null {
    if (!d) return null;
    try {
        return (d instanceof Date ? d : new Date(d)).toISOString();
    } catch {
        return null;
    }
}

/** Маппер Lean -> DTO */
function toSubscriptionDTO(doc: SubscriptionLean, orgSlug: string): SubscriptionDTO {
    return {
        orgSlug,
        plan: doc.plan,
        status: doc.status,
        seats: doc.seats,
        projectsLimit: doc.projectsLimit,
        publicTasksLimit: doc.publicTasksLimit,
        boostCredits: doc.boostCredits,
        storageLimitGb: doc.storageLimitGb,
        periodStart: toISO(doc.periodStart),
        periodEnd: toISO(doc.periodEnd),
        note: doc.note,
        updatedByEmail: doc.updatedByEmail,
        updatedAt: toISO(doc.updatedAt ?? doc.createdAt) ?? new Date().toISOString(),
    };
}

/** Фоллбек DTO, когда записи ещё нет */
function fallbackDTO(orgSlug: string): SubscriptionDTO {
    return {
        orgSlug,
        plan: 'basic',
        status: 'inactive',
        seats: 5,
        projectsLimit: 1,
        publicTasksLimit: 5,
        boostCredits: 0,
        storageLimitGb: 10,
        periodStart: null,
        periodEnd: null,
        note: 'not configured',
        updatedAt: new Date().toISOString(),
    };
}

const parseDateOrNull = (value: Date | string | null | undefined): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
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

// GET /api/org/:org/subscription — получить подписку (видно любому члену)
export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<GetSubResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const sub = await Subscription.findOne({ orgId: org._id }).lean<SubscriptionLean>();
        if (!sub) return NextResponse.json({ subscription: fallbackDTO(org.orgSlug) });

        return NextResponse.json({ subscription: toSubscriptionDTO(sub, org.orgSlug) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}

// PATCH /api/org/:org/subscription — обновить подписку (owner/org_admin)
export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<PatchSubResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);

        const body = (await request.json()) as PatchBody;
        const parsedPeriodStart =
            'periodStart' in body ? parseDateOrNull(body.periodStart ?? null) : undefined;
        const parsedPeriodEnd =
            'periodEnd' in body ? parseDateOrNull(body.periodEnd ?? null) : undefined;

        /** Тип обновляемых полей в БД */
        type Updatable = {
            plan?: Plan;
            status?: SubStatus;
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
        };

        const update: Updatable = {
            ...('plan' in body ? { plan: body.plan } : {}),
            ...('status' in body ? { status: body.status } : {}),
            ...('seats' in body ? { seats: body.seats } : {}),
            ...('projectsLimit' in body ? { projectsLimit: body.projectsLimit } : {}),
            ...('publicTasksLimit' in body ? { publicTasksLimit: body.publicTasksLimit } : {}),
            ...('boostCredits' in body ? { boostCredits: body.boostCredits } : {}),
            ...('storageLimitGb' in body ? { storageLimitGb: body.storageLimitGb } : {}),
            ...('periodStart' in body ? { periodStart: parsedPeriodStart ?? null } : {}),
            ...('periodEnd' in body ? { periodEnd: parsedPeriodEnd ?? null } : {}),
            ...('note' in body ? { note: body.note } : {}),
            updatedByEmail: email,
            updatedAt: new Date(),
        };

        if (body.status === 'trial') {
            const { start, end } = clampTrialWindow(parsedPeriodStart ?? null, parsedPeriodEnd ?? null);
            update.periodStart = start;
            update.periodEnd = end;
        }

        const saved = await Subscription.findOneAndUpdate(
            { orgId: org._id },
            { $set: update },
            { upsert: true, new: true }
        ).lean<SubscriptionLean>();

        if (!saved) return NextResponse.json({ error: 'Не удалось обновить подписку' }, { status: 500 });

        return NextResponse.json({ ok: true, subscription: toSubscriptionDTO(saved, org.orgSlug) });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
