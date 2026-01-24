import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import dbConnect from '@/server/db/mongoose';
import { requireOrgRole } from '@/server/org/permissions';
import BillingUsageModel from '@/server/models/BillingUsageModel';
import TaskModel from '@/server/models/TaskModel';
import { getBillingPeriod, getUsageSnapshot, loadPlanForOrg } from '@/utils/billingLimits';

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
        const tasksPeriod = getBillingPeriod(now);
        const publicPeriod = getBillingPeriod(now);

        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

        const [{ limits }, tasksUsage, publicUsage, tasksCount] = await Promise.all([
            loadPlanForOrg(org._id),
            getUsageSnapshot(org._id, tasksPeriod),
            getUsageSnapshot(org._id, publicPeriod),
            TaskModel.countDocuments({ orgId: org._id, createdAt: { $gte: monthStart, $lt: monthEnd } }),
        ]);

        const snapshotTasksUsed = tasksUsage?.tasksUsed ?? 0;
        const resolvedTasksUsed = Math.max(snapshotTasksUsed, tasksCount);
        if (!tasksUsage || resolvedTasksUsed !== snapshotTasksUsed) {
            await BillingUsageModel.findOneAndUpdate(
                { orgId: org._id, period: tasksPeriod },
                {
                    $set: { tasksUsed: resolvedTasksUsed, updatedAt: new Date() },
                    $setOnInsert: {
                        projectsUsed: 0,
                        publicationsUsed: 0,
                        seatsUsed: 0,
                    },
                },
                { upsert: true }
            );
        }

        return NextResponse.json({
            usage: {
                tasksUsed: resolvedTasksUsed,
                publicTasksUsed: publicUsage?.publicationsUsed ?? 0,
                tasksLimit: limits.tasksMonth,
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
