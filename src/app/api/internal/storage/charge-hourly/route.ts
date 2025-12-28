import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { chargeHourlyOverage } from '@/utils/storageUsage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    const secret = process.env.BILLING_CRON_SECRET;
    const provided = request.headers.get('x-cron-secret');
    if (!secret || provided !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    const results = await chargeHourlyOverage(new Date());
    return NextResponse.json({ ok: true, processed: results.length, results });
}
