// src/app/api/wallet/me/route.ts
import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import { ensureWalletWithBonus } from '@/utils/wallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
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

    try {
        const { wallet } = await ensureWalletWithBonus(new Types.ObjectId(user._id));
        const balance = Number(wallet.balance ?? 0);
        const bonusBalance = Number(wallet.bonusBalance ?? 0);
        return NextResponse.json({
            balance,
            bonusBalance,
            total: balance + bonusBalance,
            currency: wallet.currency ?? 'RUB',
        });
    } catch (error) {
        console.error('Failed to load wallet', error);
        return NextResponse.json({ error: 'Не удалось получить кошелёк' }, { status: 500 });
    }
}
