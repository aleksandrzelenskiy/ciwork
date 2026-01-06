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
    | { ok: true; clerkDeleted: boolean; clerkError?: string }
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

    await Promise.all([
        WalletModel.deleteMany({ contractorId: user._id }),
        WalletTransactionModel.deleteMany({ contractorId: user._id }),
        NotificationModel.deleteMany({ recipientUserId: user._id }),
        normalizedEmail ? MembershipModel.deleteMany({ userEmail: normalizedEmail }) : Promise.resolve(),
    ]);

    await UserModel.deleteOne({ _id: user._id });

    let clerkDeleted = false;
    let clerkError: string | undefined;

    try {
        const client = await clerkClient();
        await client.users.deleteUser(clerkUserId);
        clerkDeleted = true;
    } catch (error) {
        clerkError = toErrorMessage(error, 'Не удалось удалить пользователя в Clerk');
    }

    return NextResponse.json({ ok: true, clerkDeleted, clerkError });
}
