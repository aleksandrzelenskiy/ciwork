import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Subscription from '@/server/models/SubscriptionModel';
import { chargeSubscriptionPeriod } from '@/utils/subscriptionBilling';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const secret = process.env.BILLING_CRON_SECRET;
    const provided = request.headers.get('x-cron-secret');
    if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const now = new Date();
    const subscriptions = await Subscription.find({
        plan: { $ne: 'basic' },
        status: { $in: ['active', 'past_due'] },
        periodEnd: { $lte: now },
    }).lean();

    const results = [];
    for (const sub of subscriptions) {
        if (!sub.orgId) continue;
        const result = await chargeSubscriptionPeriod(sub.orgId, now);
        results.push({ orgId: String(sub.orgId), ok: result.ok, charged: result.charged });
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
}
