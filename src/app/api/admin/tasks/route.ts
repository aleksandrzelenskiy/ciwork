// src/app/api/admin/tasks/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AdminTask = {
    _id: string;
    taskId: string;
    taskName: string;
    status?: string;
    priority?: string;
    dueDate?: string;
    createdAt?: string;
    bsNumber?: string;
    totalCost?: number;
    executorName?: string;
    executorEmail?: string;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    projectId?: string;
    projectKey?: string;
    projectName?: string;
    projectOperator?: string;
    projectRegionCode?: string;
};

type ResponsePayload = { tasks: AdminTask[] };

export async function GET(): Promise<NextResponse<ResponsePayload>> {
    const userContext = await GetUserContext();
    if (!userContext.success || !userContext.data?.isSuperAdmin) {
        return NextResponse.json({ tasks: [] }, { status: 403 });
    }

    await dbConnect();

    const tasks = await TaskModel.aggregate([
        {
            $lookup: {
                from: 'projects',
                localField: 'projectId',
                foreignField: '_id',
                as: 'projectDoc',
            },
        },
        {
            $lookup: {
                from: 'organizations',
                localField: 'orgId',
                foreignField: '_id',
                as: 'orgDoc',
            },
        },
        {
            $addFields: {
                projectKey: { $arrayElemAt: ['$projectDoc.key', 0] },
                projectName: { $arrayElemAt: ['$projectDoc.name', 0] },
                projectOperator: { $arrayElemAt: ['$projectDoc.operator', 0] },
                projectRegionCode: { $arrayElemAt: ['$projectDoc.regionCode', 0] },
                orgName: { $arrayElemAt: ['$orgDoc.name', 0] },
                orgSlug: { $arrayElemAt: ['$orgDoc.orgSlug', 0] },
            },
        },
        {
            $project: {
                projectDoc: 0,
                orgDoc: 0,
            },
        },
        {
            $sort: { createdAt: -1 },
        },
    ]);

    return NextResponse.json({ tasks });
}
