// src/utils/wallet.ts
import mongoose, { type ClientSession, Types } from 'mongoose';
import WalletModel, { type Wallet } from '@/server/models/WalletModel';
import WalletTransactionModel from '@/server/models/WalletTransactionModel';

export const SIGNUP_BONUS_RUB = 1000;
export const BID_COST_RUB = 50;

type EnsureWalletResult = {
    wallet: Wallet;
    created: boolean;
};

export type BidDebitResult =
    | {
        ok: true;
        wallet: Wallet;
        debitedFromBonus: number;
        debitedFromBalance: number;
    }
    | {
        ok: false;
        wallet: Wallet;
        available: number;
        error: string;
    };

const withSession = (query: { session?: ClientSession }, session?: ClientSession) =>
    session ? { ...query, session } : query;

export const ensureWalletWithBonus = async (
    contractorId: Types.ObjectId,
    session?: ClientSession
): Promise<EnsureWalletResult> => {
    const existingQuery = WalletModel.findOne({ contractorId });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (existing) {
        return { wallet: existing, created: false };
    }

    try {
        const [created] = await WalletModel.create(
            [
                {
                    contractorId,
                    balance: 0,
                    bonusBalance: SIGNUP_BONUS_RUB,
                    currency: 'RUB',
                },
            ],
            withSession({}, session)
        );

        await WalletTransactionModel.create(
            [
                {
                    walletId: created._id,
                    contractorId,
                    amount: SIGNUP_BONUS_RUB,
                    type: 'credit',
                    source: 'signup_bonus',
                    balanceAfter: created.balance,
                    bonusBalanceAfter: created.bonusBalance,
                    meta: { reason: 'signup_bonus' },
                },
            ],
            withSession({}, session)
        );

        return { wallet: created, created: true };
    } catch (error) {
        const dupQuery = WalletModel.findOne({ contractorId });
        if (session) dupQuery.session(session);
        const dup = await dupQuery;
        if (dup) {
            return { wallet: dup, created: false };
        }
        throw error;
    }
};

export const debitForBid = async (params: {
    contractorId: Types.ObjectId;
    taskId: Types.ObjectId;
    applicationId?: Types.ObjectId;
    session?: ClientSession;
}): Promise<BidDebitResult> => {
    const { contractorId, taskId, applicationId, session } = params;
    const { wallet } = await ensureWalletWithBonus(contractorId, session);

    const available = (wallet.balance ?? 0) + (wallet.bonusBalance ?? 0);
    if (available < BID_COST_RUB) {
        return {
            ok: false,
            wallet,
            available,
            error: 'Недостаточно средств: пополните кошелёк или дождитесь начислений',
        };
    }

    const fromBonus = Math.min(wallet.bonusBalance ?? 0, BID_COST_RUB);
    const fromBalance = BID_COST_RUB - fromBonus;

    const updated = await WalletModel.findOneAndUpdate(
        {
            _id: wallet._id,
            bonusBalance: { $gte: fromBonus },
            balance: { $gte: fromBalance },
        },
        {
            $inc: {
                bonusBalance: -fromBonus,
                balance: -fromBalance,
            },
            $set: { updatedAt: new Date() },
        },
        { new: true, session }
    );

    if (!updated) {
        return {
            ok: false,
            wallet,
            available,
            error: 'Недостаточно средств: пополните кошелёк или дождитесь начислений',
        };
    }

    await WalletTransactionModel.create(
        [
            {
                walletId: updated._id,
                contractorId,
                amount: BID_COST_RUB,
                type: 'debit',
                source: 'bid',
                balanceAfter: updated.balance,
                bonusBalanceAfter: updated.bonusBalance,
                meta: {
                    taskId: taskId.toString(),
                    applicationId: applicationId?.toString(),
                },
            },
        ],
        withSession({}, session)
    );

    return {
        ok: true,
        wallet: updated,
        debitedFromBonus: fromBonus,
        debitedFromBalance: fromBalance,
    };
};

/**
 * Удобный помощник для единичных списаний вне общих транзакций.
 */
export const chargeBid = async (params: {
    contractorId: Types.ObjectId;
    taskId: Types.ObjectId;
    applicationId?: Types.ObjectId;
}): Promise<BidDebitResult> => {
    const session = await mongoose.startSession();
    let result: BidDebitResult | null = null;
    try {
        await session.withTransaction(async () => {
            result = await debitForBid({ ...params, session });
            if (!result.ok) {
                throw new Error(result.error);
            }
        });
    } catch (error) {
        if (result) return result;
        throw error;
    } finally {
        await session.endSession();
    }

    if (!result) {
        throw new Error('DEBIT_RESULT_MISSING');
    }

    return result;
};
