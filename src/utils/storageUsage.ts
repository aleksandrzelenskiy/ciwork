import { Types } from 'mongoose';
import StorageUsageModel from '@/server/models/StorageUsageModel';
import StorageBillingModel from '@/server/models/StorageBillingModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import { debitOrgWallet, ensureOrgWallet, withOrgWalletTransaction } from '@/utils/orgWallet';

export type OrgId = Types.ObjectId | string;

export const GB_BYTES = 1024 * 1024 * 1024;
export const FREE_STORAGE_GB = 5;
export const OVERAGE_RUB_PER_GB_MONTH = 50;

type StorageAccess = {
    bytesUsed: number;
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

const computeOverageGb = (bytesUsed: number): number => {
    const overBytes = Math.max(0, bytesUsed - FREE_STORAGE_GB * GB_BYTES);
    return overBytes > 0 ? Math.ceil(overBytes / GB_BYTES) : 0;
};

const computeHourlyCharge = (overageGb: number, date: Date): number => {
    if (overageGb <= 0) return 0;
    const monthlyRate = OVERAGE_RUB_PER_GB_MONTH;
    const hours = hoursInUtcMonth(date);
    return (overageGb * monthlyRate) / hours;
};

export const ensureStorageUsage = async (orgId: OrgId) => {
    const orgObjectId = toObjectId(orgId);
    if (!orgObjectId) throw new Error('INVALID_ORG_ID');
    const existing = await StorageUsageModel.findOne({ orgId: orgObjectId });
    if (existing) return existing;
    return StorageUsageModel.create({ orgId: orgObjectId, bytesUsed: 0 });
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
    const [usage, walletDoc] = await Promise.all([
        ensureStorageUsage(orgObjectId),
        ensureOrgWallet(orgObjectId).then((res) => res.wallet),
    ]);
    const bytesUsed = usage.bytesUsed ?? 0;
    const overageGb = computeOverageGb(bytesUsed);
    const hourlyCharge = computeHourlyCharge(overageGb, at);
    const walletBalance = walletDoc.balance ?? 0;
    const readOnly =
        usage.readOnly ||
        (overageGb > 0 && walletBalance < hourlyCharge);
    const readOnlyReason = readOnly
        ? usage.readOnlyReason || 'Недостаточно средств для оплаты хранения'
        : undefined;
    return {
        bytesUsed,
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
        const usage = await ensureStorageUsage(orgObjectId);
        const bytesUsed = usage.bytesUsed ?? 0;
        const overageGb = computeOverageGb(bytesUsed);
        const hourlyCharge = computeHourlyCharge(overageGb, now);

        if (overageGb <= 0 || hourlyCharge <= 0) {
            await setReadOnlyState(orgObjectId, false);
            return { ok: true, skipped: true };
        }

        const walletDoc = await OrgWalletModel.findOne({ orgId: orgObjectId }).session(session);
        const walletBalance = walletDoc?.balance ?? 0;

        if (walletBalance < hourlyCharge) {
            await setReadOnlyState(orgObjectId, true, 'Недостаточно средств для оплаты хранения');
            return { ok: false, skipped: true, reason: 'insufficient_funds' };
        }

        const debitResult = await debitOrgWallet({
            orgId: orgObjectId,
            amount: hourlyCharge,
            meta: {
                period,
                hourKey,
                overageGb,
                bytesUsed,
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
