import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import MembershipModel from '@/server/models/MembershipModel';
import NotificationModel from '@/server/models/NotificationModel';
import UserModel from '@/server/models/UserModel';
import WalletModel from '@/server/models/WalletModel';
import WalletTransactionModel from '@/server/models/WalletTransactionModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DeleteResponse =
    | { ok: true; clerkDeleted: true }
    | { error: string };

const toErrorMessage = (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback;

export async function DELETE(
    _request: Request,
    ctx: { params: Promise<{ userId: string }> }
): Promise<NextResponse<DeleteResponse>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId: userRaw } = await ctx.params;
    const clerkUserId = userRaw?.trim();
    if (!clerkUserId) {
        return NextResponse.json({ error: 'User not specified' }, { status: 400 });
    }

    await dbConnect();
    const user = await UserModel.findOne({ clerkUserId }).lean<{ _id: unknown; email?: string }>();
    if (!user?._id) {
        return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const normalizedEmail = user.email?.toLowerCase().trim();

    try {
        const client = await clerkClient();
        await client.users.deleteUser(clerkUserId);
    } catch (error) {
        return NextResponse.json(
            { error: toErrorMessage(error, 'Не удалось удалить пользователя в Clerk') },
            { status: 502 }
        );
    }

    try {
        await Promise.all([
            WalletModel.deleteMany({ contractorId: user._id }),
            WalletTransactionModel.deleteMany({ contractorId: user._id }),
            NotificationModel.deleteMany({ recipientUserId: user._id }),
            normalizedEmail
                ? MembershipModel.deleteMany({ userEmail: normalizedEmail })
                : Promise.resolve(),
        ]);

        await UserModel.deleteOne({ _id: user._id });
    } catch (error) {
        return NextResponse.json(
            { error: toErrorMessage(error, 'Не удалось удалить пользователя в базе данных') },
            { status: 500 }
        );
    }

    return NextResponse.json({ ok: true, clerkDeleted: true });
}
