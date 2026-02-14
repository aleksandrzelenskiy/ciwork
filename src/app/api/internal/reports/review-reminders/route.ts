import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { sendPendingReportReviewReminders } from '@/server/reports/review-reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const secret =
        process.env.STORAGE_RECONCILE_CRON_SECRET ??
        process.env.BILLING_CRON_SECRET;
    const provided = request.headers.get('x-cron-secret');
    if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const stats = await sendPendingReportReviewReminders(new Date());
    return NextResponse.json({ ok: true, ...stats });
}
