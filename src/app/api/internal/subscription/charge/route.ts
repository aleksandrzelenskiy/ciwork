import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import Subscription from '@/server/models/SubscriptionModel';
import { chargeSubscriptionPeriod } from '@/utils/subscriptionBilling';
import { notifyExpiringSubscriptions } from '@/server/subscription/expiringNotifications';

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
    let notifySummary = { scanned: 0, notified: 0 };
    try {
        notifySummary = await notifyExpiringSubscriptions(now);
    } catch (error) {
        console.error('Failed to notify expiring subscriptions', error);
    }
    const subscriptions = await Subscription.find({
        $or: [
            {
                plan: { $ne: 'basic' },
                status: { $in: ['active', 'past_due'] },
                periodEnd: { $lte: now },
            },
            {
                pendingPlan: { $exists: true, $ne: null },
                pendingPlanEffectiveAt: { $lte: now },
            },
        ],
    }).lean();

    const results = [];
    for (const sub of subscriptions) {
        if (!sub.orgId) continue;
        const result = await chargeSubscriptionPeriod(sub.orgId, now);
        results.push({ orgId: String(sub.orgId), ok: result.ok, charged: result.charged });
    }

    return NextResponse.json({
        ok: true,
        processed: results.length,
        results,
        notifications: notifySummary,
    });
}
