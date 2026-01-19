import { NextRequest, NextResponse } from 'next/server';
import { GetUserContext } from '@/server-actions/user-context';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import WalletModel from '@/server/models/WalletModel';
import WalletTransactionModel from '@/server/models/WalletTransactionModel';
import { ensureWalletWithBonus } from '@/utils/wallet';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatchBody = {
    balance?: number;
    delta?: number;
};

type PatchResponse =
    | { ok: true; balance: number; bonusBalance: number; totalBalance: number; currency: string }
    | { error: string };

export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ userId: string }> }
): Promise<NextResponse<PatchResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId: userRaw } = await ctx.params;
    const clerkUserId = userRaw?.trim();
    if (!clerkUserId) {
        return NextResponse.json({ error: 'User not specified' }, { status: 400 });
    }

    await dbConnect();
    const user = await UserModel.findOne({ clerkUserId }).lean<{ _id: Types.ObjectId }>();
    if (!user) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const hasBalance = typeof body.balance === 'number' && Number.isFinite(body.balance);
    const hasDelta = typeof body.delta === 'number' && Number.isFinite(body.delta);

    if (!hasBalance && !hasDelta) {
        return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const { wallet } = await ensureWalletWithBonus(user._id);
    const currentBalance = wallet.balance ?? 0;
    const nextBalance = hasBalance ? body.balance! : currentBalance + (body.delta ?? 0);
    const delta = nextBalance - currentBalance;

    const updated = await WalletModel.findOneAndUpdate(
        { _id: wallet._id },
        { $set: { balance: nextBalance, updatedAt: new Date() } },
        { new: true }
    ).lean();

    if (!updated) {
        return NextResponse.json({ error: 'Не удалось обновить баланс' }, { status: 500 });
    }

    if (delta !== 0) {
        await WalletTransactionModel.create({
            walletId: updated._id,
            contractorId: user._id,
            amount: Math.abs(delta),
            type: delta >= 0 ? 'credit' : 'debit',
            source: 'manual_adjustment',
            balanceAfter: updated.balance ?? 0,
            bonusBalanceAfter: updated.bonusBalance ?? 0,
            meta: {
                updatedByEmail: context.data.user?.email ?? null,
            },
        });
    }

    return NextResponse.json({
        ok: true,
        balance: updated.balance ?? 0,
        bonusBalance: updated.bonusBalance ?? 0,
        totalBalance: (updated.balance ?? 0) + (updated.bonusBalance ?? 0),
        currency: updated.currency ?? 'RUB',
    });
}
