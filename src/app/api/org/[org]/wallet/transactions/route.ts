import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/utils/mongoose';
import { requireOrgRole } from '@/app/utils/permissions';
import OrgWalletTransactionModel from '@/app/models/OrgWalletTransactionModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WalletTxResponse =
    | { transactions: Array<{
        id: string;
        amount: number;
        type: string;
        source: string;
        balanceAfter: number;
        createdAt: string;
        meta?: Record<string, unknown>;
      }> }
    | { error: string };

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<WalletTxResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);
        const rows = await OrgWalletTransactionModel.find({ orgId: org._id })
            .sort({ createdAt: -1 })
            .limit(30)
            .lean();

        const transactions = rows.map((row) => ({
            id: String(row._id),
            amount: row.amount,
            type: row.type,
            source: row.source,
            balanceAfter: row.balanceAfter,
            createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
            meta: row.meta ?? undefined,
        }));

        return NextResponse.json({ transactions });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
