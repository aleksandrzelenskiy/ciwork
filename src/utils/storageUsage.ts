import { Types } from 'mongoose';
import StorageUsageModel from '@/server/models/StorageUsageModel';
import StorageBillingModel from '@/server/models/StorageBillingModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import StoragePackageModel from '@/server/models/StoragePackageModel';
import Subscription from '@/server/models/SubscriptionModel';
import { getPlanConfig } from '@/utils/planConfig';
import { debitOrgWallet, ensureOrgWallet, withOrgWalletTransaction } from '@/utils/orgWallet';

export type OrgId = Types.ObjectId | string;

export const GB_BYTES = 1024 * 1024 * 1024;

type StorageAccess = {
    bytesUsed: number;
    includedGb: number;
    packageGb: number;
    overageGb: number;
    hourlyCharge: number;
    walletBalance: number;
    readOnly: boolean;
    readOnlyReason?: string;
};

const toObjectId = (orgId: OrgId): Types.ObjectId | null => {
    if (orgId instanceof Types.ObjectId) return orgId;
    return Types.ObjectId.isValid(orgId) ? new Types.ObjectId(orgId) : null;
};

const toPeriod = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

const toHourKey = (date: Date): string => {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    return `${year}-${month}-${day}-${hour}`;
};

const hoursInUtcMonth = (date: Date): number => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const start = Date.UTC(year, month, 1, 0, 0, 0);
    const end = Date.UTC(year, month + 1, 1, 0, 0, 0);
    return Math.round((end - start) / (1000 * 60 * 60));
};

const computeOverageGb = (bytesUsed: number, includedGb: number): number => {
    const overBytes = Math.max(0, bytesUsed - includedGb * GB_BYTES);
    return overBytes > 0 ? Math.ceil(overBytes / GB_BYTES) : 0;
};

const computeHourlyCharge = (overageGb: number, monthlyRate: number, date: Date): number => {
    if (overageGb <= 0) return 0;
    const hours = hoursInUtcMonth(date);
    return (overageGb * monthlyRate) / hours;
};

const loadStorageAllowance = async (orgId: Types.ObjectId, at: Date) => {
    const subscription = await Subscription.findOne({ orgId }).lean();
    const plan = (subscription?.plan as 'basic' | 'pro' | 'business' | 'enterprise' | undefined) ?? 'basic';
    const planConfig = await getPlanConfig(plan);
    const includedGbRaw =
        typeof subscription?.storageLimitGb === 'number'
            ? subscription.storageLimitGb
            : planConfig.storageIncludedGb;
    const includedGb = includedGbRaw === null || typeof includedGbRaw === 'undefined'
        ? Number.POSITIVE_INFINITY
        : Math.max(0, includedGbRaw ?? 0);
    const packages = await StoragePackageModel.find({
        orgId,
        status: 'active',
        periodStart: { $lte: at },
        periodEnd: { $gt: at },
    }).lean();
    const packageGb = packages.reduce((sum, pkg) => sum + (pkg.packageGb ?? 0), 0);
    return {
        includedGb,
        packageGb,
        overageRate: planConfig.storageOverageRubPerGbMonth ?? 0,
        plan,
    };
};

export const ensureStorageUsage = async (orgId: OrgId) => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');
    return StorageUsageModel.findOneAndUpdate(
        { orgId: orgObjectId },
        { $setOnInsert: { bytesUsed: 0 } },
        { new: true, upsert: true }
    );
};

export const recordStorageBytes = async (orgId: OrgId, bytesDelta: number) => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');
    return await StorageUsageModel.findOneAndUpdate(
        { orgId: orgObjectId },
        { $inc: { bytesUsed: Math.max(0, bytesDelta) }, $set: { updatedAt: new Date() } },
        { new: true, upsert: true }
    );
};

export const adjustStorageBytes = async (orgId: OrgId, bytesDelta: number) => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');
    const usage = await StorageUsageModel.findOneAndUpdate(
        { orgId: orgObjectId },
        { $inc: { bytesUsed: bytesDelta }, $set: { updatedAt: new Date() } },
        { new: true, upsert: true }
    );
    if (usage.bytesUsed < 0) {
        usage.bytesUsed = 0;
        await usage.save();
    }
    return usage;
};

export const getStorageAccess = async (orgId: OrgId, at: Date = new Date()): Promise<StorageAccess> => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');
    const [usage, walletDoc, allowance] = await Promise.all([
        ensureStorageUsage(orgObjectId),
        ensureOrgWallet(orgObjectId).then((res) => res.wallet),
        loadStorageAllowance(orgObjectId, at),
    ]);
    const bytesUsed = usage.bytesUsed ?? 0;
    const includedGb = allowance.includedGb + allowance.packageGb;
    const overageGb = computeOverageGb(bytesUsed, includedGb);
    const hourlyCharge = computeHourlyCharge(overageGb, allowance.overageRate, at);
    const walletBalance = walletDoc.balance ?? 0;
    const readOnly =
        usage.readOnly ||
        (overageGb > 0 && walletBalance < hourlyCharge);
    const readOnlyReason = readOnly
        ? usage.readOnlyReason || 'Недостаточно средств для оплаты хранения'
        : undefined;
    return {
        bytesUsed,
        includedGb,
        packageGb: allowance.packageGb,
        overageGb,
        hourlyCharge,
        walletBalance,
        readOnly,
        readOnlyReason,
    };
};

export const assertWritableStorage = async (orgId: OrgId) => {
    const access = await getStorageAccess(orgId);
    if (!access.readOnly) {
        return { ok: true, access };
    }
    const orgObjectId = toObjectId(orgId);
    if (orgObjectId) {
        await setReadOnlyState(orgObjectId, true, access.readOnlyReason);
    }
    return {
        ok: false,
        access,
        error: access.readOnlyReason || 'Хранилище доступно только для чтения',
    };
};

const setReadOnlyState = async (orgId: Types.ObjectId, readOnly: boolean, reason?: string) => {
    await StorageUsageModel.updateOne(
        { orgId },
        { $set: { readOnly, readOnlyReason: reason ?? null, updatedAt: new Date() } }
    ).exec();
};

export const chargeHourlyOverageForOrg = async (orgId: OrgId, now: Date = new Date()) => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');

    const hourKey = toHourKey(now);
    const period = toPeriod(now);

    const alreadyCharged = await StorageBillingModel.findOne({
        orgId: orgObjectId,
        hourKey,
    }).lean();
    if (alreadyCharged) {
        return { ok: true, skipped: true };
    }

    return withOrgWalletTransaction(async (session) => {
        const [usage, allowance] = await Promise.all([
            ensureStorageUsage(orgObjectId),
            loadStorageAllowance(orgObjectId, now),
        ]);
        const bytesUsed = usage.bytesUsed ?? 0;
        const includedGb = allowance.includedGb + allowance.packageGb;
        const overageGb = computeOverageGb(bytesUsed, includedGb);
        const hourlyCharge = computeHourlyCharge(overageGb, allowance.overageRate, now);

        if (overageGb <= 0 || hourlyCharge <= 0) {
            await setReadOnlyState(orgObjectId, false);
            return { ok: true, skipped: true };
        }

        const walletDoc = await OrgWalletModel.findOne({ orgId: orgObjectId }).session(session ?? null);
        const walletBalance = walletDoc?.balance ?? 0;

        if (walletBalance < hourlyCharge) {
            await setReadOnlyState(orgObjectId, true, 'Недостаточно средств для оплаты хранения');
            return { ok: false, skipped: true, reason: 'insufficient_funds' };
        }

        const debitResult = await debitOrgWallet({
            orgId: orgObjectId,
            amount: hourlyCharge,
            source: 'storage_overage',
            meta: {
                period,
                hourKey,
                overageGb,
                bytesUsed,
                includedGb,
            },
            session,
        });

        if (!debitResult.ok) {
            await setReadOnlyState(orgObjectId, true, 'Недостаточно средств для оплаты хранения');
            return { ok: false, skipped: true, reason: 'insufficient_funds' };
        }

        await StorageBillingModel.create(
            [
                {
                    orgId: orgObjectId,
                    period,
                    hourKey,
                    bytesSnapshot: bytesUsed,
                    gbBilled: overageGb,
                    amountRub: hourlyCharge,
                    chargedAt: now,
                },
            ],
            { session }
        );

        await setReadOnlyState(orgObjectId, false);

        return { ok: true, skipped: false };
    });
};

export const chargeHourlyOverage = async (now: Date = new Date()) => {
    const usages = await StorageUsageModel.find({}, { orgId: 1 }).lean();
    const results = [];
    for (const usage of usages) {
        if (!usage.orgId) continue;
        const result = await chargeHourlyOverageForOrg(usage.orgId, now);
        results.push({ orgId: String(usage.orgId), result });
    }
    return results;
};
