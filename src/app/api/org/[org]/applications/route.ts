// src/app/api/org/[org]/applications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { Types } from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import ApplicationModel from '@/server/models/ApplicationModel';
import TaskModel from '@/server/models/TaskModel';
import ProjectModel from '@/server/models/ProjectModel';
import { requireOrgRole } from '@/server/org/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ApplicationDTO = {
    _id: string;
    taskId: string;
    taskName: string;
    bsNumber?: string;
    projectKey?: string;
    publicStatus?: string;
    visibility?: string;
    proposedBudget: number;
    contractorName?: string;
    contractorEmail?: string;
    status: string;
    createdAt?: string;
};

type GetApplicationsResponse = { applications: ApplicationDTO[] } | { error: string };

export async function GET(
    _request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<GetApplicationsResponse>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager', 'viewer']);

        const apps = await ApplicationModel.aggregate([
            { $match: { orgId: org._id } },
            { $sort: { createdAt: -1 } },
            { $limit: 50 },
            {
                $lookup: {
                    from: TaskModel.collection.name,
                    localField: 'taskId',
                    foreignField: '_id',
                    as: 'task',
                },
            },
            {
                $addFields: {
                    task: { $arrayElemAt: ['$task', 0] },
                },
            },
            {
                $lookup: {
                    from: ProjectModel.collection.name,
                    localField: 'task.projectId',
                    foreignField: '_id',
                    as: 'project',
                },
            },
            {
                $addFields: {
                    project: { $arrayElemAt: ['$project', 0] },
                },
            },
            {
                $project: {
                    taskId: '$task._id',
                    taskName: '$task.taskName',
                    bsNumber: '$task.bsNumber',
                    publicStatus: '$task.publicStatus',
                    visibility: '$task.visibility',
                    projectKey: '$project.key',
                    proposedBudget: 1,
                    contractorName: 1,
                    contractorEmail: 1,
                    status: 1,
                    createdAt: 1,
                },
            },
        ]);

        const applications: ApplicationDTO[] = apps.map((a) => ({
            _id: String(a._id),
            taskId: String(a.taskId),
            taskName: a.taskName ?? 'Задача',
            bsNumber: a.bsNumber ?? undefined,
            publicStatus: a.publicStatus,
            visibility: a.visibility,
            projectKey: a.projectKey,
            proposedBudget: a.proposedBudget,
            contractorName: a.contractorName,
            contractorEmail: a.contractorEmail,
            status: a.status,
            createdAt: a.createdAt ? new Date(a.createdAt).toISOString() : undefined,
        }));

        return NextResponse.json({ applications });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Server error';
        const status = msg === 'Недостаточно прав' ? 403 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}

type DeleteApplicationBody = { applicationId?: string };

export async function DELETE(
    request: NextRequest,
    ctx: { params: Promise<{ org: string }> }
): Promise<NextResponse<{ ok: true } | { error: string }>> {
    try {
        await dbConnect();
        const { org: orgSlug } = await ctx.params;

        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (!email) return NextResponse.json({ error: 'Auth required' }, { status: 401 });

        const { org } = await requireOrgRole(orgSlug, email, ['owner', 'org_admin', 'manager']);

        const body = (await request.json().catch(() => null)) as DeleteApplicationBody | null;
        const appId = body?.applicationId;
        if (!appId || !Types.ObjectId.isValid(appId)) {
            return NextResponse.json({ error: 'Некорректный идентификатор отклика' }, { status: 400 });
        }

        const app = await ApplicationModel.findOne({ _id: appId, orgId: org._id });
        if (!app) {
            return NextResponse.json({ error: 'Отклик не найден' }, { status: 404 });
        }

        const task = app.taskId ? await TaskModel.findById(app.taskId).lean() : null;

        await ApplicationModel.deleteOne({ _id: app._id });

        if (task?._id) {
            const update: Record<string, unknown> = {};
            const nextCount =
                typeof task.applicationCount === 'number'
                    ? Math.max(0, task.applicationCount - 1)
                    : 0;
            update.$set = { applicationCount: nextCount };
            if (task.acceptedApplicationId === String(app._id)) {
                update.$unset = { acceptedApplicationId: '' };
            }
            if (Object.keys(update).length > 0) {
                await TaskModel.updateOne({ _id: task._id }, update);
            }
        }

        return NextResponse.json({ ok: true });
    } catch (e) {
        const msg = e instanceof Error ? e.message : 'Server error';
        const status = msg === 'Недостаточно прав' ? 403 : 500;
        return NextResponse.json({ error: msg }, { status });
    }
}
