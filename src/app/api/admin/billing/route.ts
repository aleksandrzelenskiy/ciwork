import { NextRequest, NextResponse } from 'next/server';
import { GetUserContext } from '@/server-actions/user-context';
import dbConnect from '@/server/db/mongoose';
import { getBillingConfig, updateBillingConfig } from '@/utils/billingConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BillingConfigResponse =
    | { config: { taskPublishCostRub: number; bidCostRub: number } }
    | { error: string };

export async function GET(): Promise<NextResponse<BillingConfigResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();
    const config = await getBillingConfig();
    return NextResponse.json({ config });
}

export async function PATCH(request: NextRequest): Promise<NextResponse<BillingConfigResponse>> {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await dbConnect();
    const body = (await request.json().catch(() => ({}))) as Partial<{
        taskPublishCostRub: number;
        bidCostRub: number;
    }>;

    try {
        const config = await updateBillingConfig(body);
        return NextResponse.json({ config });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Не удалось сохранить настройки' },
            { status: 500 }
        );
    }
}
