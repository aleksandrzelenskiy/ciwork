import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import UserModel from '@/server/models/UserModel';
import WalletModel from '@/server/models/WalletModel';
import { GetUserContext } from '@/server-actions/user-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminUserDTO = {
    clerkUserId: string;
    name?: string;
    email?: string;
    role?: string;
    profilePic?: string;
    walletBalance?: number;
    walletCurrency?: string;
};

type ResponsePayload = {
    users: AdminUserDTO[];
};

export async function GET(): Promise<NextResponse<ResponsePayload>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ users: [] }, { status: 403 });
    }

    await dbConnect();
    const users = await UserModel.find(
        {},
        {
            name: 1,
            email: 1,
            profilePic: 1,
            clerkUserId: 1,
            platformRole: 1,
        }
    ).lean();
    const userIds = users.map((user) => user._id);
    const wallets = await WalletModel.find({ contractorId: { $in: userIds } }).lean();
    const walletMap = new Map<string, typeof wallets[number]>();
    wallets.forEach((wallet) => {
        if (wallet.contractorId) {
            walletMap.set(String(wallet.contractorId), wallet);
        }
    });

    const result: AdminUserDTO[] = users.map((user) => {
        const wallet = walletMap.get(String(user._id));
        return {
            clerkUserId: user.clerkUserId,
            name: user.name,
            email: user.email,
            role: user.platformRole,
            profilePic: user.profilePic,
            walletBalance: wallet?.balance ?? 0,
            walletCurrency: wallet?.currency ?? 'RUB',
        };
    });

    return NextResponse.json({ users: result });
}
