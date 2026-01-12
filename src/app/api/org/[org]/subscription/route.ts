// src/app/api/org/[org]/subscription/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import Subscription from '@/server/models/SubscriptionModel';
import { requireOrgRole } from '@/server/org/permissions';
import { changeSubscriptionPlan, ensureSubscriptionAccess, getPlanChangePreview, type PlanChangeTiming } from '@/utils/subscriptionBilling';
import { resolveEffectivePlanLimits, resolveEffectiveStorageLimit } from '@/utils/billingLimits';
import { getPlanConfig, type PlanConfigDTO } from '@/utils/planConfig';

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
    pendingPlan?: Plan | null;
    pendingPlanEffectiveAt?: ISODateString | null;
    status: SubStatus;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksWeeklyLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: ISODateString | null;
    periodEnd?: ISODateString | null;
    graceUntil?: ISODateString | null;
    graceUsedAt?: ISODateString | null;
    note?: string;
    updatedByEmail?: string;
    updatedAt: ISODateString;
};

type SubscriptionBillingDTO = {
    isActive: boolean;
    readOnly: boolean;
    reason?: string;
    graceUntil?: ISODateString | null;
    graceAvailable: boolean;
    priceRubMonthly: number;
};

type PaymentPreviewDTO = {
    charged: number;
    credited: number;
    pending: boolean;
    balance: number;
    required: number;
    available: number;
    willFail: boolean;
    effectiveAt?: ISODateString | null;
};

type GetSubResponse =
    | { subscription: SubscriptionDTO; billing: SubscriptionBillingDTO; paymentPreview?: PaymentPreviewDTO }
    | { error: string };

type PatchBody = Partial<
    Pick<
        SubscriptionDTO,
        'plan' | 'status' | 'seats' | 'projectsLimit' | 'publicTasksLimit' | 'tasksWeeklyLimit' | 'boostCredits' | 'storageLimitGb' | 'periodStart' | 'periodEnd' | 'note'
    >
> & {
    changeTiming?: PlanChangeTiming;
    cancelPending?: boolean;
};
type PatchSubResponse =
    | {
          ok: true;
          subscription: SubscriptionDTO;
          billing: SubscriptionBillingDTO;
          payment?: {
              charged: number;
              credited: number;
              balance?: number;
              pending: boolean;
          };
      }
    | {
          error: string;
          payment?: {
              required?: number;
              available?: number;
          };
      };

/** Lean-документ подписки, возвращаемый .lean() */
interface SubscriptionLean {
    plan: Plan;
    status: SubStatus;
    pendingPlan?: Plan;
    pendingPlanEffectiveAt?: Date | string | null;
    pendingPlanRequestedAt?: Date | string | null;
    seats?: number;
    projectsLimit?: number;
    publicTasksLimit?: number;
    tasksWeeklyLimit?: number;
    boostCredits?: number;
    storageLimitGb?: number;
    periodStart?: Date | string | null;
    periodEnd?: Date | string | null;
    graceUntil?: Date | string | null;
    graceUsedAt?: Date | string | null;
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
        pendingPlan: doc.pendingPlan ?? null,
        pendingPlanEffectiveAt: toISO(doc.pendingPlanEffectiveAt),
        status: doc.status,
        seats: doc.seats,
        projectsLimit: doc.projectsLimit,
        publicTasksLimit: doc.publicTasksLimit,
        tasksWeeklyLimit: doc.tasksWeeklyLimit,
        boostCredits: doc.boostCredits,
        storageLimitGb: doc.storageLimitGb,
        periodStart: toISO(doc.periodStart),
        periodEnd: toISO(doc.periodEnd),
        graceUntil: toISO(doc.graceUntil),
        graceUsedAt: toISO(doc.graceUsedAt),
        note: doc.note,
        updatedByEmail: doc.updatedByEmail,
        updatedAt: toISO(doc.updatedAt ?? doc.createdAt) ?? new Date().toISOString(),
    };
}

/** Фоллбек DTO, когда записи ещё нет */
function fallbackDTO(orgSlug: string, planConfig: PlanConfigDTO): SubscriptionDTO {
    const limits = resolveEffectivePlanLimits('basic', planConfig);
    const storageLimitGb = resolveEffectiveStorageLimit('basic', planConfig, undefined);
    return {
        orgSlug,
        plan: 'basic',
        pendingPlan: null,
        pendingPlanEffectiveAt: null,
        status: 'inactive',
        seats: limits.seats ?? undefined,
        projectsLimit: limits.projects ?? undefined,
        publicTasksLimit: limits.publications ?? undefined,
        tasksWeeklyLimit: limits.tasksWeekly ?? undefined,
        boostCredits: 0,
        storageLimitGb: storageLimitGb ?? undefined,
        periodStart: null,
        periodEnd: null,
        graceUntil: null,
        graceUsedAt: null,
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
    req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<GetSubResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'executor', 'viewer']);

        const [sub, access] = await Promise.all([
            Subscription.findOne({ orgId: org._id }).lean<SubscriptionLean>(),
            ensureSubscriptionAccess(org._id),
        ]);

        const previewPlan = req.nextUrl.searchParams.get('previewPlan');
        const previewTiming = req.nextUrl.searchParams.get('previewTiming');
        const shouldPreview =
            previewPlan === 'basic' || previewPlan === 'pro' || previewPlan === 'business' || previewPlan === 'enterprise';
        let paymentPreview: PaymentPreviewDTO | undefined;
        if (shouldPreview) {
            const preview = await getPlanChangePreview({
                orgId: org._id,
                nextPlan: previewPlan as Plan,
                timing: previewTiming === 'period_end' ? 'period_end' : 'immediate',
            });
            paymentPreview = {
                charged: preview.charged,
                credited: preview.credited,
                pending: preview.pending,
                balance: preview.balance,
                required: preview.required,
                available: preview.available,
                willFail: preview.willFail,
                effectiveAt: preview.effectiveAt ? preview.effectiveAt.toISOString() : null,
            };
        }
        if (!sub) {
            const planConfig = await getPlanConfig('basic');
            return NextResponse.json({
                subscription: fallbackDTO(org.orgSlug, planConfig),
                billing: {
                    isActive: access.ok,
                    readOnly: access.readOnly,
                    reason: access.reason,
                    graceUntil: toISO(access.graceUntil ?? null),
                    graceAvailable: access.graceAvailable,
                    priceRubMonthly: access.priceRubMonthly,
                },
                paymentPreview,
            });
        }

        const planConfig = await getPlanConfig(sub.plan);
        const limits = resolveEffectivePlanLimits(sub.plan, planConfig, {
            seats: sub.seats,
            projectsLimit: sub.projectsLimit,
            publicTasksLimit: sub.publicTasksLimit,
            tasksWeeklyLimit: sub.tasksWeeklyLimit,
        });
        const storageLimitGb = resolveEffectiveStorageLimit(sub.plan, planConfig, sub.storageLimitGb);
        const merged: SubscriptionLean = {
            ...sub,
            seats: limits.seats ?? undefined,
            projectsLimit: limits.projects ?? undefined,
            publicTasksLimit: limits.publications ?? undefined,
            tasksWeeklyLimit: limits.tasksWeekly ?? undefined,
            storageLimitGb: storageLimitGb ?? undefined,
        };

        return NextResponse.json({
            subscription: toSubscriptionDTO(merged, org.orgSlug),
            billing: {
                isActive: access.ok,
                readOnly: access.readOnly,
                reason: access.reason,
                graceUntil: toISO(access.graceUntil ?? null),
                graceAvailable: access.graceAvailable,
                priceRubMonthly: access.priceRubMonthly,
            },
            paymentPreview,
        });
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
            tasksWeeklyLimit?: number;
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
            ...('tasksWeeklyLimit' in body ? { tasksWeeklyLimit: body.tasksWeeklyLimit } : {}),
            ...('boostCredits' in body ? { boostCredits: body.boostCredits } : {}),
            ...('storageLimitGb' in body ? { storageLimitGb: body.storageLimitGb } : {}),
            ...('periodStart' in body ? { periodStart: parsedPeriodStart ?? null } : {}),
            ...('periodEnd' in body ? { periodEnd: parsedPeriodEnd ?? null } : {}),
            ...('note' in body ? { note: body.note } : {}),
            updatedByEmail: email,
            updatedAt: new Date(),
        };

        if (body.cancelPending) {
            await Subscription.updateOne(
                { orgId: org._id },
                { $set: { pendingPlan: undefined, pendingPlanEffectiveAt: undefined, pendingPlanRequestedAt: undefined } }
            );
        }

        let planChangeResult: {
            ok: boolean;
            charged?: number;
            credited?: number;
            pending?: boolean;
            balance?: number;
            required?: number;
            available?: number;
            reason?: string;
        } | null = null;
        const changeTiming: PlanChangeTiming =
            body.changeTiming === 'period_end' ? 'period_end' : 'immediate';

        if ('plan' in body && body.plan) {
            planChangeResult = await changeSubscriptionPlan({
                orgId: org._id,
                nextPlan: body.plan,
                timing: changeTiming,
            });
            if (!planChangeResult) {
                return NextResponse.json(
                    { error: 'Не удалось изменить план подписки' },
                    { status: 500 }
                );
            }
            if (!planChangeResult.ok) {
                return NextResponse.json(
                    {
                        error: 'Недостаточно средств для оплаты подписки',
                        payment: {
                            required: planChangeResult.required,
                            available: planChangeResult.available,
                        },
                    },
                    { status: 402 }
                );
            }

            if (changeTiming === 'immediate') {
                if (!('storageLimitGb' in body)) {
                    const planConfig = await getPlanConfig(body.plan);
                    update.storageLimitGb = planConfig.storageIncludedGb ?? undefined;
                }
                delete update.plan;
            } else {
                delete update.plan;
            }
            delete update.status;
        }

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

        let resolvedSubscription = saved;
        if (planChangeResult) {
            const refreshed = await Subscription.findOne({ orgId: org._id }).lean<SubscriptionLean>();
            if (refreshed) {
                resolvedSubscription = refreshed;
            }
        }

        const planConfig = await getPlanConfig(resolvedSubscription.plan);
        const limits = resolveEffectivePlanLimits(resolvedSubscription.plan, planConfig, {
            seats: resolvedSubscription.seats,
            projectsLimit: resolvedSubscription.projectsLimit,
            publicTasksLimit: resolvedSubscription.publicTasksLimit,
            tasksWeeklyLimit: resolvedSubscription.tasksWeeklyLimit,
        });
        const storageLimitGb = resolveEffectiveStorageLimit(
            resolvedSubscription.plan,
            planConfig,
            resolvedSubscription.storageLimitGb
        );
        const merged: SubscriptionLean = {
            ...resolvedSubscription,
            seats: limits.seats ?? undefined,
            projectsLimit: limits.projects ?? undefined,
            publicTasksLimit: limits.publications ?? undefined,
            tasksWeeklyLimit: limits.tasksWeekly ?? undefined,
            storageLimitGb: storageLimitGb ?? undefined,
        };

        const access = await ensureSubscriptionAccess(org._id);
        return NextResponse.json({
            ok: true,
            subscription: toSubscriptionDTO(merged, org.orgSlug),
            billing: {
                isActive: access.ok,
                readOnly: access.readOnly,
                reason: access.reason,
                graceUntil: toISO(access.graceUntil ?? null),
                graceAvailable: access.graceAvailable,
                priceRubMonthly: access.priceRubMonthly,
            },
            payment: planChangeResult
                ? {
                      charged: planChangeResult.charged ?? 0,
                      credited: planChangeResult.credited ?? 0,
                      balance: planChangeResult.balance,
                      pending: planChangeResult.pending ?? false,
                  }
                : undefined,
        });
    } catch (e: unknown) {
        return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
}
