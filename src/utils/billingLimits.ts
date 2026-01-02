// src/utils/billingLimits.ts
import type { ClientSession } from 'mongoose';
import { Types } from 'mongoose';
import Subscription, { type SubscriptionPlan } from '@/server/models/SubscriptionModel';
import BillingUsageModel, { type BillingPeriod, type BillingUsage } from '@/server/models/BillingUsageModel';
import { getPlanConfig } from '@/utils/planConfig';

export type OrgId = Types.ObjectId | string;

export type PlanLimits = {
    projects: number | null;
    seats: number | null;
    publications: number | null;
    tasksWeekly: number | null;
};

type UsageKind = 'projects' | 'publications' | 'tasks';

type UsageField = 'projectsUsed' | 'publicationsUsed' | 'tasksUsed';
type LimitField = keyof PlanLimits;

export type LimitCheckResult = {
    ok: boolean;
    limit: number | null;
    used: number;
    plan: SubscriptionPlan;
    reason?: string;
};

const USAGE_FIELD_MAP: Record<UsageKind, UsageField> = {
    projects: 'projectsUsed',
    publications: 'publicationsUsed',
    tasks: 'tasksUsed',
};

const LIMIT_FIELD_MAP: Record<UsageKind, LimitField> = {
    projects: 'projects',
    publications: 'publications',
    tasks: 'tasksWeekly',
};

const normalizeLimit = (value?: number | null): number | null => {
    if (typeof value !== 'number') return null;
    if (!Number.isFinite(value) || value < 0) return null;
    return value;
};

export const getBillingPeriod = (date: Date = new Date()): BillingPeriod => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const getIsoWeek = (date: Date) => {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNumber = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return { year: target.getUTCFullYear(), week: weekNo };
};

export const getWeeklyPeriod = (date: Date = new Date()): BillingPeriod => {
    const { year, week } = getIsoWeek(date);
    const weekStr = String(week).padStart(2, '0');
    return `${year}-W${weekStr}`;
};

export const resolvePlanLimits = (
    plan: SubscriptionPlan,
    overrides?: {
        seats?: number | null;
        projectsLimit?: number | null;
        publicTasksLimit?: number | null;
        tasksWeeklyLimit?: number | null;
    }
): PlanLimits => {
    if (plan === 'enterprise') {
        return {
            projects: normalizeLimit(overrides?.projectsLimit),
            seats: normalizeLimit(overrides?.seats),
            publications: normalizeLimit(overrides?.publicTasksLimit),
            tasksWeekly: normalizeLimit(overrides?.tasksWeeklyLimit),
        };
    }

    return {
        projects: normalizeLimit(overrides?.projectsLimit),
        seats: normalizeLimit(overrides?.seats),
        publications: normalizeLimit(overrides?.publicTasksLimit),
        tasksWeekly: normalizeLimit(overrides?.tasksWeeklyLimit),
    };
};

export const loadPlanForOrg = async (
    orgId: OrgId
): Promise<{ plan: SubscriptionPlan; limits: PlanLimits }> => {
    const sub = await Subscription.findOne({ orgId }).lean();
    const plan = (sub?.plan as SubscriptionPlan | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const limits = resolvePlanLimits(plan, {
        seats: sub?.seats ?? planConfig.seatsLimit ?? undefined,
        projectsLimit: sub?.projectsLimit ?? planConfig.projectsLimit ?? undefined,
        publicTasksLimit: sub?.publicTasksLimit ?? planConfig.publicTasksMonthlyLimit ?? undefined,
        tasksWeeklyLimit: sub?.tasksWeeklyLimit ?? planConfig.tasksWeeklyLimit ?? undefined,
    });

    const resolvedLimits: PlanLimits = {
        projects: limits.projects ?? planConfig.projectsLimit ?? null,
        seats: limits.seats ?? planConfig.seatsLimit ?? null,
        publications: limits.publications ?? planConfig.publicTasksMonthlyLimit ?? null,
        tasksWeekly: limits.tasksWeekly ?? planConfig.tasksWeeklyLimit ?? null,
    };

    return { plan, limits: resolvedLimits };
};

const buildExceeded = (limit: number | null, used: number, plan: SubscriptionPlan, reason: string): LimitCheckResult => ({
    ok: false,
    limit,
    used,
    plan,
    reason,
});

const isDuplicateKeyError = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false;
    return error.message.includes('E11000') || error.name === 'MongoServerError';
};

/**
 * Проверяет и атомарно бронирует слот по лимиту (проект или публикация).
 * Возвращает обновлённое значение usage за текущий календарный месяц.
 */
export const consumeUsageSlot = async (
    orgId: OrgId,
    kind: UsageKind,
    options?: { session?: ClientSession; period?: BillingPeriod }
): Promise<LimitCheckResult> => {
    const orgObjectId =
        orgId instanceof Types.ObjectId
            ? orgId
            : Types.ObjectId.isValid(orgId)
                ? new Types.ObjectId(orgId)
                : null;

    if (!orgObjectId) {
        return buildExceeded(
            null,
            0,
            'basic',
            'Некорректный идентификатор организации'
        );
    }

    const { plan, limits } = await loadPlanForOrg(orgId);
    const limitValue = limits[LIMIT_FIELD_MAP[kind]];
    const usageField = USAGE_FIELD_MAP[kind];
    const now = new Date();
    const period =
        options?.period ??
        (kind === 'tasks' ? getWeeklyPeriod(now) : getBillingPeriod(now));

    const session = options?.session;
    const existingQuery = BillingUsageModel.findOne({ orgId, period });
    if (session) existingQuery.session(session);
    const existing = await existingQuery.lean();
    const currentUsed = (existing?.[usageField] as number | undefined) ?? 0;

    if (typeof limitValue === 'number' && currentUsed >= limitValue) {
        return buildExceeded(
            limitValue,
            currentUsed,
            plan,
            `Лимит исчерпан: ${currentUsed}/${limitValue}`
        );
    }

    let usageDoc: BillingUsage | null = null;

    try {
        if (existing) {
            usageDoc = await BillingUsageModel.findOneAndUpdate(
                {
                    _id: existing._id,
                    ...(typeof limitValue === 'number' ? { [usageField]: { $lt: limitValue } } : {}),
                },
                {
                    $inc: { [usageField]: 1 },
                    $set: { updatedAt: now },
                },
                {
                    new: true,
                    ...(session ? { session } : {}),
                }
            );
        } else {
            const initial: Record<UsageField, number> = {
                projectsUsed: 0,
                publicationsUsed: 0,
                tasksUsed: 0,
            };
            initial[usageField] = 1;

            const created = await BillingUsageModel.create(
                [
                    {
                        orgId: orgObjectId,
                        period,
                        ...initial,
                    },
                ],
                session ? { session } : undefined
            );
            usageDoc = created[0] ?? null;
        }
    } catch (error) {
        if (!isDuplicateKeyError(error)) {
            throw error;
        }

        const retryQuery = BillingUsageModel.findOne({ orgId, period });
        if (session) retryQuery.session(session);
        const retry = await retryQuery.lean();
        const retryUsed = (retry?.[usageField] as number | undefined) ?? 0;
        if (!retry) {
            throw error;
        }
        if (typeof limitValue === 'number' && retryUsed >= limitValue) {
            return buildExceeded(
                limitValue,
                retryUsed,
                plan,
                `Лимит исчерпан: ${retryUsed}/${limitValue}`
            );
        }

        usageDoc = await BillingUsageModel.findOneAndUpdate(
            {
                _id: retry._id,
                ...(typeof limitValue === 'number' ? { [usageField]: { $lt: limitValue } } : {}),
            },
            {
                $inc: { [usageField]: 1 },
                $set: { updatedAt: now },
            },
            {
                new: true,
                ...(session ? { session } : {}),
            }
        );
    }

    if (!usageDoc) {
        return buildExceeded(
            typeof limitValue === 'number' ? limitValue : null,
            currentUsed,
            plan,
            'Лимит исчерпан'
        );
    }

    const used = (usageDoc?.[usageField] as number | undefined) ?? currentUsed + 1;

    return {
        ok: true,
        plan,
        limit: typeof limitValue === 'number' ? limitValue : null,
        used,
    };
};

/**
 * Возвращает снапшот usage за месяц без инкремента.
 */
export const getUsageSnapshot = async (
    orgId: OrgId,
    period: BillingPeriod = getBillingPeriod()
) => {
    const usage = await BillingUsageModel.findOne({ orgId, period }).lean();
    return usage ?? null;
};
