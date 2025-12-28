import { NextRequest, NextResponse } from 'next/server';
import { GetUserContext } from '@/server-actions/user-context';
import dbConnect from '@/server/db/mongoose';
import Organization from '@/server/models/OrganizationModel';
import OrgWalletModel from '@/server/models/OrgWalletModel';
import OrgWalletTransactionModel from '@/server/models/OrgWalletTransactionModel';
import { ensureOrgWallet } from '@/utils/orgWallet';
import { Types } from 'mongoose';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatchBody = {
    balance?: number;
    delta?: number;
};

type PatchResponse =
    | { ok: true; balance: number; currency: string }
    | { error: string };

export async function PATCH(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<PatchResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { org: orgRaw } = await ctx.params;
    const orgSlug = orgRaw?.trim().toLowerCase();
    if (!orgSlug) {
        return NextResponse.json({ error: 'Org not specified' }, { status: 400 });
    }

    await dbConnect();
    const organization = await Organization.findOne({ orgSlug }).lean<{ _id: Types.ObjectId }>();
    if (!organization) {
        return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
    }

    const body = (await request.json().catch(() => ({}))) as PatchBody;
    const hasBalance = typeof body.balance === 'number' && Number.isFinite(body.balance);
    const hasDelta = typeof body.delta === 'number' && Number.isFinite(body.delta);

    if (!hasBalance && !hasDelta) {
        return NextResponse.json({ error: 'Некорректные параметры' }, { status: 400 });
    }

    const { wallet } = await ensureOrgWallet(organization._id);
    const currentBalance = wallet.balance ?? 0;
    const nextBalance = hasBalance ? body.balance! : currentBalance + (body.delta ?? 0);
    const delta = nextBalance - currentBalance;

    const updated = await OrgWalletModel.findOneAndUpdate(
        { _id: wallet._id },
        { $set: { balance: nextBalance, updatedAt: new Date() } },
        { new: true }
    ).lean();

    if (!updated) {
        return NextResponse.json({ error: 'Не удалось обновить баланс' }, { status: 500 });
    }

    if (delta !== 0) {
        await OrgWalletTransactionModel.create({
            orgId: organization._id,
            amount: Math.abs(delta),
            type: delta >= 0 ? 'credit' : 'debit',
            source: 'manual',
            balanceAfter: updated.balance,
            meta: {
                updatedByEmail: context.data.user?.email ?? null,
            },
        });
    }

    return NextResponse.json({
        ok: true,
        balance: updated.balance ?? 0,
        currency: updated.currency ?? 'RUB',
    });
}
