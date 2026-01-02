import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { getAllPlanConfigs, ensurePlanConfigs } from '@/utils/planConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    await dbConnect();
    await ensurePlanConfigs();
    const plans = await getAllPlanConfigs();
    return NextResponse.json({ plans });
}
