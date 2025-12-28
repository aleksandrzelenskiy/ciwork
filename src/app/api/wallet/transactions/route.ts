// src/app/api/wallet/transactions/route.ts
import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import WalletTransactionModel from '@/server/models/WalletTransactionModel';
import { ensureWalletWithBonus } from '@/utils/wallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const limitRaw = Number(searchParams.get('limit') ?? '20');
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 50) : 20;

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connect error', error);
        return NextResponse.json({ error: 'Ошибка подключения к базе' }, { status: 500 });
    }

    const ctx = await GetUserContext();
    if (!ctx.success || !ctx.data) {
        return NextResponse.json({ error: 'Требуется авторизация' }, { status: 401 });
    }

    const user = ctx.data.user;
    if (user.profileType !== 'contractor') {
        return NextResponse.json({ error: 'Недоступно для вашего профиля' }, { status: 403 });
    }

    const contractorId = new Types.ObjectId(user._id);

    try {
        const { wallet } = await ensureWalletWithBonus(contractorId);

        const transactions = await WalletTransactionModel.find(
            { contractorId },
            { amount: 1, type: 1, source: 1, balanceAfter: 1, bonusBalanceAfter: 1, createdAt: 1 }
        )
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        return NextResponse.json({
            wallet: {
                balance: wallet.balance ?? 0,
                bonusBalance: wallet.bonusBalance ?? 0,
                currency: wallet.currency ?? 'RUB',
                total: (wallet.balance ?? 0) + (wallet.bonusBalance ?? 0),
            },
            transactions: transactions.map((tx) => ({
                id: tx._id?.toString?.() ?? '',
                amount: tx.amount,
                type: tx.type,
                source: tx.source,
                balanceAfter: tx.balanceAfter,
                bonusBalanceAfter: tx.bonusBalanceAfter,
                createdAt: tx.createdAt,
            })),
        });
    } catch (error) {
        console.error('Failed to load transactions', error);
        return NextResponse.json({ error: 'Не удалось получить транзакции' }, { status: 500 });
    }
}
