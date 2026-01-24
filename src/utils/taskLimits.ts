import { type ClientSession, Types } from 'mongoose';
import { consumeUsageSlot, getBillingPeriod, getUsageSnapshot, loadPlanForOrg } from '@/utils/billingLimits';

export type OrgId = Types.ObjectId | string;

export type TaskMonthlyLimitResult = {
    ok: boolean;
    limit: number;
    used: number;
    reason?: string;
    period: string;
};

export const ensureMonthlyTaskSlot = async (
    orgId: OrgId,
    options?: { consume?: boolean; session?: ClientSession }
): Promise<TaskMonthlyLimitResult> => {
    const period = getBillingPeriod();
    if (options?.consume) {
        const consumed = await consumeUsageSlot(orgId, 'tasks', {
            session: options.session,
            period,
        });
        const limitNumber =
            typeof consumed.limit === 'number' ? consumed.limit : Number.POSITIVE_INFINITY;
        return {
            ok: consumed.ok,
            limit: limitNumber,
            used: consumed.used,
            period,
            reason:
                consumed.reason ||
                `Лимит задач на месяц исчерпан: ${consumed.used}/${Number.isFinite(limitNumber) ? limitNumber : '∞'}`,
        };
    }

    const { limits } = await loadPlanForOrg(orgId);
    const usage = await getUsageSnapshot(orgId, period);
    const limit = typeof limits.tasksMonth === 'number' ? limits.tasksMonth : Number.POSITIVE_INFINITY;
    const used = usage?.tasksUsed ?? 0;
    return {
        ok: used < limit,
        limit,
        used,
        period,
    };
};
