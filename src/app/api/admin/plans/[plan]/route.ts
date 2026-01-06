import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import PlanConfigModel from '@/server/models/PlanConfigModel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PLANS = new Set(['basic', 'pro', 'business', 'enterprise']);

type DeleteResponse = { ok: true } | { error: string };

export async function DELETE(
    _request: Request,
    ctx: { params: Promise<{ plan: string }> }
): Promise<NextResponse<DeleteResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { plan: planRaw } = await ctx.params;
    const plan = planRaw?.trim().toLowerCase();
    if (!plan || !ALLOWED_PLANS.has(plan)) {
        return NextResponse.json({ error: 'План не найден' }, { status: 404 });
    }

    await dbConnect();
    await PlanConfigModel.deleteOne({ plan });

    return NextResponse.json({ ok: true });
}
