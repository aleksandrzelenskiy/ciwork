import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import { activateGracePeriod, ensureSubscriptionAccess } from '@/utils/subscriptionBilling';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
) {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin']);
        await activateGracePeriod(org._id);

        const access = await ensureSubscriptionAccess(org._id);
        return NextResponse.json({
            ok: true,
            billing: {
                isActive: access.ok,
                readOnly: access.readOnly,
                reason: access.reason,
                graceUntil: access.graceUntil ? access.graceUntil.toISOString() : null,
                graceAvailable: access.graceAvailable,
                priceRubMonthly: access.priceRubMonthly,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        if (message === 'GRACE_ALREADY_USED') {
            return NextResponse.json({ error: 'Grace уже использован в этом месяце' }, { status: 400 });
        }
        if (message === 'SUBSCRIPTION_NOT_FOUND') {
            return NextResponse.json({ error: 'Подписка не найдена' }, { status: 404 });
        }
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
