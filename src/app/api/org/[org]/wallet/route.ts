import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import { requireOrgRole } from '@/app/utils/permissions';
import OrgWalletModel from '@/app/models/OrgWalletModel';
import { ensureOrgWallet } from '@/utils/orgWallet';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WalletResponse =
    | { wallet: { balance: number; currency: string } }
    | { error: string };

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<WalletResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const wallet = await OrgWalletModel.findOne({ orgId: org._id }).lean();
        if (!wallet) {
            const created = await ensureOrgWallet(org._id);
            return NextResponse.json({
                wallet: { balance: created.wallet.balance ?? 0, currency: created.wallet.currency ?? 'RUB' },
            });
        }

        return NextResponse.json({
            wallet: { balance: wallet.balance ?? 0, currency: wallet.currency ?? 'RUB' },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
