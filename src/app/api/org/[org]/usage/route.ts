import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import {
    getBillingPeriod,
    getWeeklyPeriod,
    getUsageSnapshot,
    loadPlanForOrg,
} from '@/utils/billingLimits';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type UsageDTO = {
    tasksUsed: number;
    publicTasksUsed: number;
    tasksLimit: number | null;
    publicTasksLimit: number | null;
    tasksPeriod: string;
    publicPeriod: string;
};

type UsageResponse = { usage: UsageDTO } | { error: string };

export async function GET(
    _req: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<UsageResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, [
            'owner',
            'org_admin',
            'manager',
            'executor',
            'viewer',
        ]);

        const now = new Date();
        const tasksPeriod = getWeeklyPeriod(now);
        const publicPeriod = getBillingPeriod(now);

        const [{ limits }, tasksUsage, publicUsage] = await Promise.all([
            loadPlanForOrg(org._id),
            getUsageSnapshot(org._id, tasksPeriod),
            getUsageSnapshot(org._id, publicPeriod),
        ]);

        return NextResponse.json({
            usage: {
                tasksUsed: tasksUsage?.tasksUsed ?? 0,
                publicTasksUsed: publicUsage?.publicationsUsed ?? 0,
                tasksLimit: limits.tasksWeekly,
                publicTasksLimit: limits.publications,
                tasksPeriod,
                publicPeriod,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
