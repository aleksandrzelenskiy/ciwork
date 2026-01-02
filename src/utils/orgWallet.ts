import mongoose, { type ClientSession, Types } from 'mongoose';
import OrgWalletModel, { type OrgWallet } from '@/server/models/OrgWalletModel';
import OrgWalletTransactionModel from '@/server/models/OrgWalletTransactionModel';

type EnsureOrgWalletResult = {
    wallet: OrgWallet;
    created: boolean;
};

const isTransactionNotSupportedError = (error: unknown): boolean => {
    const mongoError = error as { code?: number; codeName?: string; message?: string };
    return (
        mongoError?.code === 20 ||
        mongoError?.codeName === 'IllegalOperation' ||
        mongoError?.message?.includes?.(
            'Transaction numbers are only allowed on a replica set member or mongos'
        ) === true
    );
};

const withSession = (query: { session?: ClientSession }, session?: ClientSession) =>
    session ? { ...query, session } : query;

export const ensureOrgWallet = async (
    orgId: Types.ObjectId,
    session?: ClientSession
): Promise<EnsureOrgWalletResult> => {
    const existingQuery = OrgWalletModel.findOne({ orgId });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (existing) {
        return { wallet: existing, created: false };
    }

    try {
        const [created] = await OrgWalletModel.create(
            [
                {
                    orgId,
                    balance: 0,
                    currency: 'RUB',
                },
            ],
            withSession({}, session)
        );

        return { wallet: created, created: true };
    } catch (error) {
        const dupQuery = OrgWalletModel.findOne({ orgId });
        if (session) dupQuery.session(session);
        const dup = await dupQuery;
        if (dup) {
            return { wallet: dup, created: false };
        }
        throw error;
    }
};

export const creditOrgWallet = async (params: {
    orgId: Types.ObjectId;
    amount: number;
    source?: 'manual' | 'subscription';
    meta?: Record<string, unknown>;
    session?: ClientSession;
}) => {
    const { orgId, amount, meta, session, source } = params;
    const { wallet } = await ensureOrgWallet(orgId, session);
    const updated = await OrgWalletModel.findOneAndUpdate(
        { _id: wallet._id },
        { $inc: { balance: amount }, $set: { updatedAt: new Date() } },
        { new: true, session }
    );
    if (!updated) {
        throw new Error('ORG_WALLET_UPDATE_FAILED');
    }
    await OrgWalletTransactionModel.create(
        [
            {
                orgId,
                amount,
                type: 'credit',
                source: source ?? 'manual',
                balanceAfter: updated.balance,
                meta,
            },
        ],
        withSession({}, session)
    );
    return updated;
};

export const debitOrgWallet = async (params: {
    orgId: Types.ObjectId;
    amount: number;
    source?: 'storage_overage' | 'subscription' | 'storage_package';
    meta?: Record<string, unknown>;
    session?: ClientSession;
}) => {
    const { orgId, amount, meta, session, source } = params;
    const { wallet } = await ensureOrgWallet(orgId, session);
    if ((wallet.balance ?? 0) < amount) {
        return { ok: false, wallet, available: wallet.balance ?? 0 };
    }
    const updated = await OrgWalletModel.findOneAndUpdate(
        { _id: wallet._id, balance: { $gte: amount } },
        { $inc: { balance: -amount }, $set: { updatedAt: new Date() } },
        { new: true, session }
    );
    if (!updated) {
        return { ok: false, wallet, available: wallet.balance ?? 0 };
    }
    await OrgWalletTransactionModel.create(
        [
            {
                orgId,
                amount,
                type: 'debit',
                source: source ?? 'storage_overage',
                balanceAfter: updated.balance,
                meta,
            },
        ],
        withSession({}, session)
    );
    return { ok: true, wallet: updated };
};

export const withOrgWalletTransaction = async <T>(
    task: (session?: ClientSession) => Promise<T>
): Promise<T> => {
    const session = await mongoose.startSession();
    try {
        let result: T | null = null;
        try {
            await session.withTransaction(async () => {
                result = await task(session);
            });
        } catch (error) {
            if (!isTransactionNotSupportedError(error)) {
                throw error;
            }
            result = await task(undefined);
        }
        if (!result) throw new Error('ORG_WALLET_TX_MISSING');
        return result;
    } finally {
        await session.endSession();
    }
};
