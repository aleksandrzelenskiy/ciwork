import { Types, type ClientSession } from 'mongoose';
import Subscription, { type Subscription as SubscriptionDoc, type SubscriptionPlan } from '@/server/models/SubscriptionModel';
import { getPlanConfig } from '@/utils/planConfig';
import { creditOrgWallet, debitOrgWallet, ensureOrgWallet, withOrgWalletTransaction } from '@/utils/orgWallet';

export type SubscriptionAccess = {
    ok: boolean;
    plan: SubscriptionPlan;
    priceRubMonthly: number;
    status: 'active' | 'trial' | 'suspended' | 'past_due' | 'inactive';
    graceUntil?: Date | null;
    graceAvailable: boolean;
    readOnly: boolean;
    reason?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
};

const GRACE_HOURS = 72;

const parseDate = (value?: Date | string | null): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
};

const getPeriodBounds = (date: Date): { start: Date; end: Date } => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
    return { start, end };
};

const roundCurrency = (value: number) => Math.round(value * 100) / 100;

const isTrialActive = (sub: { status?: string; periodEnd?: Date | string | null }): boolean => {
    if (!sub || sub.status !== 'trial') return false;
    const end = parseDate(sub.periodEnd);
    if (!end) return false;
    return end.getTime() > Date.now();
};

const isGraceActive = (sub: { graceUntil?: Date | string | null }): boolean => {
    const grace = parseDate(sub.graceUntil);
    return Boolean(grace && grace.getTime() > Date.now());
};

const canStartGrace = (sub: { graceUsedAt?: Date | string | null }): boolean => {
    const lastUsed = parseDate(sub.graceUsedAt);
    if (!lastUsed) return true;
    const { start, end } = getPeriodBounds(new Date());
    return lastUsed.getTime() < start.getTime() || lastUsed.getTime() >= end.getTime();
};

const buildAccess = (params: {
    ok: boolean;
    plan: SubscriptionPlan;
    priceRubMonthly: number;
    status: SubscriptionAccess['status'];
    graceUntil?: Date | null;
    graceAvailable: boolean;
    readOnly: boolean;
    reason?: string;
    periodStart?: Date | null;
    periodEnd?: Date | null;
}): SubscriptionAccess => params;

export const ensureSubscriptionAccess = async (orgId: Types.ObjectId): Promise<SubscriptionAccess> => {
    const subscription = await Subscription.findOne({ orgId }).lean();
    const plan = (subscription?.plan as SubscriptionPlan | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const priceRubMonthly = planConfig.priceRubMonthly ?? 0;
    const status = (subscription?.status as SubscriptionAccess['status'] | undefined) ?? 'inactive';
    const graceUntil = parseDate(subscription?.graceUntil ?? null);
    const graceAvailable = canStartGrace(subscription ?? {});

    if (priceRubMonthly <= 0) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: 'active',
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription?.periodStart ?? null,
            periodEnd: subscription?.periodEnd ?? null,
        });
    }

    if (status === 'trial' && isTrialActive(subscription ?? {})) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: 'trial',
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription?.periodStart ?? null,
            periodEnd: subscription?.periodEnd ?? null,
        });
    }

    const activeGrace = isGraceActive(subscription ?? {});
    if (status === 'active' && subscription?.periodEnd) {
        const periodEnd = parseDate(subscription.periodEnd);
        if (periodEnd && periodEnd.getTime() > Date.now()) {
            return buildAccess({
                ok: true,
                plan,
                priceRubMonthly,
                status,
                graceUntil,
                graceAvailable,
                readOnly: false,
                periodStart: subscription.periodStart ?? null,
                periodEnd: subscription.periodEnd ?? null,
            });
        }
    }
    if (status === 'active' && !subscription?.periodEnd) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status,
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription?.periodStart ?? null,
            periodEnd: subscription?.periodEnd ?? null,
        });
    }

    if (activeGrace) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status,
            graceUntil,
            graceAvailable,
            readOnly: false,
            reason: 'Используется grace-период',
            periodStart: subscription?.periodStart ?? null,
            periodEnd: subscription?.periodEnd ?? null,
        });
    }

    return buildAccess({
        ok: false,
        plan,
        priceRubMonthly,
        status,
        graceUntil,
        graceAvailable,
        readOnly: true,
        reason: 'Недостаточно средств для оплаты подписки',
        periodStart: subscription?.periodStart ?? null,
        periodEnd: subscription?.periodEnd ?? null,
    });
};

export const ensureSubscriptionWriteAccess = async (orgId: Types.ObjectId): Promise<SubscriptionAccess> => {
    const subscription = await Subscription.findOne({ orgId });
    const plan = (subscription?.plan as SubscriptionPlan | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const priceRubMonthly = planConfig.priceRubMonthly ?? 0;
    const graceUntil = parseDate(subscription?.graceUntil ?? null);
    const graceAvailable = canStartGrace(subscription ?? {});

    if (!subscription) {
        return buildAccess({
            ok: false,
            plan,
            priceRubMonthly,
            status: 'inactive',
            graceUntil,
            graceAvailable,
            readOnly: true,
            reason: 'Подписка не настроена',
        });
    }

    if (priceRubMonthly <= 0) {
        subscription.status = 'active';
        await subscription.save();
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: 'active',
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription.periodStart ?? null,
            periodEnd: subscription.periodEnd ?? null,
        });
    }

    if (subscription.status === 'trial' && isTrialActive(subscription)) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: 'trial',
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription.periodStart ?? null,
            periodEnd: subscription.periodEnd ?? null,
        });
    }

    if (subscription.status === 'active') {
        const periodEnd = parseDate(subscription.periodEnd);
        if (periodEnd && periodEnd.getTime() <= Date.now()) {
            const charge = await chargeSubscriptionPeriod(orgId);
            if (charge.ok) {
                return buildAccess({
                    ok: true,
                    plan,
                    priceRubMonthly,
                    status: 'active',
                    graceUntil,
                    graceAvailable,
                    readOnly: false,
                    periodStart: charge.subscription.periodStart ?? null,
                    periodEnd: charge.subscription.periodEnd ?? null,
                });
            }
            return buildAccess({
                ok: false,
                plan,
                priceRubMonthly,
                status: 'past_due',
                graceUntil,
                graceAvailable,
                readOnly: true,
                reason: 'Недостаточно средств для оплаты подписки',
                periodStart: charge.subscription.periodStart ?? null,
                periodEnd: charge.subscription.periodEnd ?? null,
            });
        }
        if (!periodEnd) {
            return buildAccess({
                ok: true,
                plan,
                priceRubMonthly,
                status: 'active',
                graceUntil,
                graceAvailable,
                readOnly: false,
                periodStart: subscription.periodStart ?? null,
                periodEnd: subscription.periodEnd ?? null,
            });
        }
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: 'active',
            graceUntil,
            graceAvailable,
            readOnly: false,
            periodStart: subscription.periodStart ?? null,
            periodEnd: subscription.periodEnd ?? null,
        });
    }

    if (isGraceActive(subscription)) {
        return buildAccess({
            ok: true,
            plan,
            priceRubMonthly,
            status: subscription.status,
            graceUntil,
            graceAvailable,
            readOnly: false,
            reason: 'Используется grace-период',
            periodStart: subscription.periodStart ?? null,
            periodEnd: subscription.periodEnd ?? null,
        });
    }

    return buildAccess({
        ok: false,
        plan,
        priceRubMonthly,
        status: subscription.status,
        graceUntil,
        graceAvailable,
        readOnly: true,
        reason: 'Недостаточно средств для оплаты подписки',
        periodStart: subscription.periodStart ?? null,
        periodEnd: subscription.periodEnd ?? null,
    });
};

export const activateGracePeriod = async (orgId: Types.ObjectId) => {
    const subscription = await Subscription.findOne({ orgId });
    if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
    }
    if (isGraceActive(subscription)) {
        return subscription;
    }
    if (!canStartGrace(subscription)) {
        throw new Error('GRACE_ALREADY_USED');
    }
    subscription.graceUntil = new Date(Date.now() + GRACE_HOURS * 60 * 60 * 1000);
    subscription.graceUsedAt = new Date();
    await subscription.save();
    return subscription;
};

export const chargeSubscriptionPeriod = async (orgId: Types.ObjectId, now: Date = new Date()) => {
    const subscription = await Subscription.findOne({ orgId });
    if (!subscription) {
        throw new Error('SUBSCRIPTION_NOT_FOUND');
    }
    let pendingApplied = false;
    if (subscription.pendingPlan && subscription.pendingPlanEffectiveAt) {
        if (subscription.pendingPlanEffectiveAt.getTime() <= now.getTime()) {
            subscription.plan = subscription.pendingPlan as SubscriptionPlan;
            subscription.pendingPlan = undefined;
            subscription.pendingPlanEffectiveAt = undefined;
            subscription.pendingPlanRequestedAt = undefined;
            pendingApplied = true;
        }
    }

    const plan = (subscription.plan as SubscriptionPlan | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const priceRubMonthly = planConfig.priceRubMonthly ?? 0;
    const { start, end } = getPeriodBounds(now);
    if (pendingApplied) {
        subscription.storageLimitGb = planConfig.storageIncludedGb ?? undefined;
    }

    if (priceRubMonthly <= 0) {
        subscription.status = 'active';
        subscription.periodStart = start;
        subscription.periodEnd = end;
        await subscription.save();
        return { ok: true, subscription, charged: 0 };
    }

    return withOrgWalletTransaction(async (session) => {
        const { wallet } = await ensureOrgWallet(orgId, session);
        if ((wallet.balance ?? 0) < priceRubMonthly) {
            subscription.status = 'past_due';
            subscription.periodStart = start;
            subscription.periodEnd = end;
            await subscription.save({ session });
            return { ok: false, subscription, charged: 0 };
        }

        const debit = await debitOrgWallet({
            orgId,
            amount: priceRubMonthly,
            source: 'subscription',
            meta: { plan, periodStart: start.toISOString(), periodEnd: end.toISOString() },
            session,
        });
        if (!debit.ok) {
            subscription.status = 'past_due';
            subscription.periodStart = start;
            subscription.periodEnd = end;
            await subscription.save({ session });
            return { ok: false, subscription, charged: 0 };
        }
        subscription.status = 'active';
        subscription.periodStart = start;
        subscription.periodEnd = end;
        subscription.graceUntil = undefined;
        await subscription.save({ session });
        return { ok: true, subscription, charged: priceRubMonthly };
    });
};

export type PlanChangeTiming = 'immediate' | 'period_end';

export type PlanChangeResult = {
    ok: boolean;
    subscription: SubscriptionDoc;
    charged: number;
    credited: number;
    pending: boolean;
    reason?: 'insufficient_funds';
    balance?: number;
    required?: number;
    available?: number;
};

export type PlanChangePreview = {
    charged: number;
    credited: number;
    pending: boolean;
    balance: number;
    required: number;
    available: number;
    willFail: boolean;
    effectiveAt?: Date;
};

export const getPlanChangePreview = async (params: {
    orgId: Types.ObjectId;
    nextPlan: SubscriptionPlan;
    timing: PlanChangeTiming;
    now?: Date;
}): Promise<PlanChangePreview> => {
    const now = params.now ?? new Date();
    const subscription =
        (await Subscription.findOne({ orgId: params.orgId })) ??
        new Subscription({ orgId: params.orgId, plan: 'basic', status: 'inactive' });

    const currentPlan = (subscription.plan as SubscriptionPlan | undefined) ?? 'basic';
    const currentStatus = subscription.status ?? 'inactive';
    const currentPlanConfig = await getPlanConfig(currentPlan);
    const nextPlanConfig = await getPlanConfig(params.nextPlan);
    const currentPrice = currentPlanConfig.priceRubMonthly ?? 0;
    const nextPrice = nextPlanConfig.priceRubMonthly ?? 0;

    const periodStart = parseDate(subscription.periodStart ?? null);
    const periodEnd = parseDate(subscription.periodEnd ?? null);
    const hasActivePaidPeriod =
        currentStatus === 'active' &&
        currentPrice > 0 &&
        Boolean(periodStart && periodEnd && periodEnd.getTime() > now.getTime());

    const { wallet } = await ensureOrgWallet(params.orgId);
    const balance = wallet.balance ?? 0;

    if (params.timing === 'period_end') {
        const effectiveAt = periodEnd && periodEnd.getTime() > now.getTime()
            ? periodEnd
            : getPeriodBounds(now).end;
        return {
            charged: 0,
            credited: 0,
            pending: true,
            balance,
            required: 0,
            available: balance,
            willFail: false,
            effectiveAt,
        };
    }

    let chargeAmount = nextPrice;
    let creditAmount = 0;

    if (hasActivePaidPeriod && periodStart && periodEnd) {
        const totalMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
        const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
        const fraction = remainingMs / totalMs;
        const unusedValue = currentPrice * fraction;
        const newCost = nextPrice * fraction;
        const delta = roundCurrency(newCost - unusedValue);
        if (delta >= 0) {
            chargeAmount = delta;
            creditAmount = 0;
        } else {
            chargeAmount = 0;
            creditAmount = roundCurrency(-delta);
        }
    }

    return {
        charged: chargeAmount,
        credited: creditAmount,
        pending: false,
        balance,
        required: chargeAmount,
        available: balance,
        willFail: chargeAmount > balance,
    };
};

export const changeSubscriptionPlan = async (params: {
    orgId: Types.ObjectId;
    nextPlan: SubscriptionPlan;
    timing: PlanChangeTiming;
    now?: Date;
}): Promise<PlanChangeResult> => {
    const now = params.now ?? new Date();
    const subscription =
        (await Subscription.findOne({ orgId: params.orgId })) ??
        new Subscription({ orgId: params.orgId, plan: 'basic', status: 'inactive' });

    const currentPlan = (subscription.plan as SubscriptionPlan | undefined) ?? 'basic';
    const currentStatus = subscription.status ?? 'inactive';
    const currentPlanConfig = await getPlanConfig(currentPlan);
    const nextPlanConfig = await getPlanConfig(params.nextPlan);
    const currentPrice = currentPlanConfig.priceRubMonthly ?? 0;
    const nextPrice = nextPlanConfig.priceRubMonthly ?? 0;

    const periodStart = parseDate(subscription.periodStart ?? null);
    const periodEnd = parseDate(subscription.periodEnd ?? null);
    const hasActivePaidPeriod =
        currentStatus === 'active' &&
        currentPrice > 0 &&
        Boolean(periodStart && periodEnd && periodEnd.getTime() > now.getTime());

    if (params.timing === 'period_end') {
        const effectiveAt = periodEnd && periodEnd.getTime() > now.getTime()
            ? periodEnd
            : getPeriodBounds(now).end;
        if (effectiveAt.getTime() <= now.getTime()) {
            return changeSubscriptionPlan({ ...params, timing: 'immediate', now });
        }
        subscription.pendingPlan = params.nextPlan;
        subscription.pendingPlanEffectiveAt = effectiveAt;
        subscription.pendingPlanRequestedAt = now;
        await subscription.save();
        const { wallet } = await ensureOrgWallet(params.orgId);
        return {
            ok: true,
            subscription,
            charged: 0,
            credited: 0,
            pending: true,
            balance: wallet.balance ?? 0,
        };
    }

    let chargeAmount = nextPrice;
    let creditAmount = 0;

    if (hasActivePaidPeriod && periodStart && periodEnd) {
        const totalMs = Math.max(1, periodEnd.getTime() - periodStart.getTime());
        const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
        const fraction = remainingMs / totalMs;
        const unusedValue = currentPrice * fraction;
        const newCost = nextPrice * fraction;
        const delta = roundCurrency(newCost - unusedValue);
        if (delta >= 0) {
            chargeAmount = delta;
            creditAmount = 0;
        } else {
            chargeAmount = 0;
            creditAmount = roundCurrency(-delta);
        }
    }

    const { start, end } = hasActivePaidPeriod && periodStart && periodEnd
        ? { start: periodStart, end: periodEnd }
        : getPeriodBounds(now);

    const applySubscriptionUpdate = async (session?: ClientSession) => {
        subscription.plan = params.nextPlan;
        subscription.status = 'active';
        subscription.periodStart = start;
        subscription.periodEnd = end;
        subscription.pendingPlan = undefined;
        subscription.pendingPlanEffectiveAt = undefined;
        subscription.pendingPlanRequestedAt = undefined;
        subscription.graceUntil = undefined;
        await subscription.save(session ? { session } : undefined);
    };

    if (chargeAmount <= 0 && creditAmount <= 0) {
        await applySubscriptionUpdate();
        const { wallet } = await ensureOrgWallet(params.orgId);
        return {
            ok: true,
            subscription,
            charged: 0,
            credited: 0,
            pending: false,
            balance: wallet.balance ?? 0,
        };
    }

    return withOrgWalletTransaction(async (session) => {
        const { wallet } = await ensureOrgWallet(params.orgId, session);
        let balanceAfter: number = wallet.balance ?? 0;
        if (chargeAmount > 0) {
            const debit = await debitOrgWallet({
                orgId: params.orgId,
                amount: chargeAmount,
                source: 'subscription',
                meta: {
                    fromPlan: currentPlan,
                    toPlan: params.nextPlan,
                    chargeType: hasActivePaidPeriod ? 'proration' : 'full',
                    periodStart: start.toISOString(),
                    periodEnd: end.toISOString(),
                },
                session,
            });
            if (!debit.ok) {
                return {
                    ok: false,
                    subscription,
                    charged: 0,
                    credited: 0,
                    pending: false,
                    reason: 'insufficient_funds',
                    required: chargeAmount,
                    available: debit.available,
                };
            }
            balanceAfter = debit.wallet.balance ?? balanceAfter;
        }

        if (creditAmount > 0) {
            const credit = await creditOrgWallet({
                orgId: params.orgId,
                amount: creditAmount,
                source: 'subscription',
                meta: {
                    fromPlan: currentPlan,
                    toPlan: params.nextPlan,
                    creditType: 'proration',
                    periodStart: start.toISOString(),
                    periodEnd: end.toISOString(),
                },
                session,
            });
            balanceAfter = credit.balance ?? balanceAfter;
        }

        await applySubscriptionUpdate(session);
        return {
            ok: true,
            subscription,
            charged: chargeAmount,
            credited: creditAmount,
            pending: false,
            balance: balanceAfter,
        };
    });
};
