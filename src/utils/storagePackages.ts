import { Types } from 'mongoose';
import StoragePackageModel from '@/server/models/StoragePackageModel';
import { debitOrgWallet, withOrgWalletTransaction } from '@/utils/orgWallet';
import { getPlanConfig } from '@/utils/planConfig';
import Subscription from '@/server/models/SubscriptionModel';

const hoursInUtcMonth = (date: Date): number => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const start = Date.UTC(year, month, 1, 0, 0, 0);
    const end = Date.UTC(year, month + 1, 1, 0, 0, 0);
    return Math.round((end - start) / (1000 * 60 * 60));
};

const getMonthBounds = (date: Date): { start: Date; end: Date } => {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
    return { start, end };
};

export const listActivePackages = async (orgId: Types.ObjectId, at: Date = new Date()) => {
    return StoragePackageModel.find({
        orgId,
        status: 'active',
        periodStart: { $lte: at },
        periodEnd: { $gt: at },
    }).lean();
};

export const purchaseStoragePackage = async (
    orgId: Types.ObjectId,
    options?: { quantity?: number; at?: Date }
) => {
    const at = options?.at ?? new Date();
    const subscription = await Subscription.findOne({ orgId }).lean();
    const plan = (subscription?.plan as 'basic' | 'pro' | 'business' | 'enterprise' | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const packageGb = planConfig.storagePackageGb ?? 0;
    const packagePrice = planConfig.storagePackageRubMonthly ?? 0;
    const quantity = Math.max(1, options?.quantity ?? 1);

    if (packageGb <= 0 || packagePrice <= 0) {
        throw new Error('PACKAGE_NOT_AVAILABLE');
    }

    const hoursTotal = hoursInUtcMonth(at);
    const monthEnd = getMonthBounds(at).end;
    const hoursLeft = Math.max(1, Math.ceil((monthEnd.getTime() - at.getTime()) / (1000 * 60 * 60)));
    const proratedPrice = (packagePrice * hoursLeft) / hoursTotal;
    const totalAmount = proratedPrice * quantity;
    const { start, end } = getMonthBounds(at);

    return withOrgWalletTransaction(async (session) => {
        const debit = await debitOrgWallet({
            orgId,
            amount: totalAmount,
            source: 'storage_package',
            meta: {
                packageGb,
                priceRubMonthly: packagePrice,
                quantity,
                periodStart: start.toISOString(),
                periodEnd: end.toISOString(),
            },
            session,
        });
        if (!debit.ok) {
            return { ok: false, reason: 'insufficient_funds' };
        }

        const packages = await StoragePackageModel.insertMany(
            Array.from({ length: quantity }).map(() => ({
                orgId,
                packageGb,
                priceRubMonthly: packagePrice,
                periodStart: start,
                periodEnd: end,
                status: 'active',
                autoRenew: true,
            })),
            { session }
        );

        return { ok: true, packages, charged: totalAmount };
    });
};
