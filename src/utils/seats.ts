// src/app/utils/seats.ts
import { Types } from 'mongoose';
import Membership from '@/server/models/MembershipModel';
import { loadPlanForOrg } from '@/utils/billingLimits';

export type OrgId = Types.ObjectId | string;

export type SeatCheckResult = {
    ok: boolean;
    limit: number;
    used: number;
};

/**
 * Проверяет, можно ли активировать ещё одного участника.
 * Основано на подписке org: seats vs активные участники.
 */
export async function ensureSeatAvailable(orgId: OrgId): Promise<SeatCheckResult> {
    const { limits } = await loadPlanForOrg(orgId);
    const limit = typeof limits.seats === 'number' ? limits.seats : Number.POSITIVE_INFINITY;
    const used = await Membership.countDocuments({ orgId, status: 'active' });
    return { ok: used < limit, limit, used };
}
