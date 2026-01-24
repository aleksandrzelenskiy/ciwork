import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import { GetUserContext } from '@/server-actions/user-context';
import PlanConfigModel from '@/server/models/PlanConfigModel';
import { ensurePlanConfigs, getAllPlanConfigs } from '@/utils/planConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PatchBody = {
    plan: 'basic' | 'pro' | 'business' | 'enterprise';
    title?: string;
    priceRubMonthly?: number;
    projectsLimit?: number | null;
    seatsLimit?: number | null;
    tasksMonthLimit?: number | null;
    publicTasksMonthlyLimit?: number | null;
    storageIncludedGb?: number | null;
    storageOverageRubPerGbMonth?: number;
    storagePackageGb?: number | null;
    storagePackageRubMonthly?: number | null;
    features?: string[];
};

export async function GET() {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    await dbConnect();
    await ensurePlanConfigs();
    const plans = await getAllPlanConfigs();
    return NextResponse.json({ plans });
}

export async function PATCH(request: NextRequest) {
    const context = await GetUserContext();
    if (!context.success || !context.data?.isSuperAdmin) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    await dbConnect();
    await ensurePlanConfigs();

    const body = (await request.json().catch(() => null)) as PatchBody | null;
    if (!body?.plan) {
        return NextResponse.json({ error: 'Plan is required' }, { status: 400 });
    }

    const update = {
        ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
        ...(typeof body.priceRubMonthly === 'number' ? { priceRubMonthly: body.priceRubMonthly } : {}),
        ...('projectsLimit' in body ? { projectsLimit: body.projectsLimit } : {}),
        ...('seatsLimit' in body ? { seatsLimit: body.seatsLimit } : {}),
        ...('tasksMonthLimit' in body ? { tasksMonthLimit: body.tasksMonthLimit } : {}),
        ...('publicTasksMonthlyLimit' in body ? { publicTasksMonthlyLimit: body.publicTasksMonthlyLimit } : {}),
        ...('storageIncludedGb' in body ? { storageIncludedGb: body.storageIncludedGb } : {}),
        ...(typeof body.storageOverageRubPerGbMonth === 'number'
            ? { storageOverageRubPerGbMonth: body.storageOverageRubPerGbMonth }
            : {}),
        ...('storagePackageGb' in body ? { storagePackageGb: body.storagePackageGb } : {}),
        ...('storagePackageRubMonthly' in body ? { storagePackageRubMonthly: body.storagePackageRubMonthly } : {}),
        ...(Array.isArray(body.features) ? { features: body.features.filter(Boolean) } : {}),
    };

    const saved = await PlanConfigModel.findOneAndUpdate(
        { plan: body.plan },
        { $set: update },
        { new: true, upsert: true }
    ).lean();

    if (!saved) {
        return NextResponse.json({ error: 'Не удалось обновить тариф' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, plan: saved });
}
