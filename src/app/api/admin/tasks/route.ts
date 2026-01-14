// src/app/api/admin/tasks/route.ts
import { NextResponse } from 'next/server';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import { GetUserContext } from '@/server-actions/user-context';
import UserModel from '@/server/models/UserModel';

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
    authorId?: string;
    authorName?: string;
    authorEmail?: string;
    authorClerkUserId?: string;
    initiatorName?: string;
    initiatorEmail?: string;
    initiatorClerkUserId?: string;
    executorId?: string;
    executorName?: string;
    executorEmail?: string;
    executorClerkUserId?: string;
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

    const clerkIds = new Set<string>();
    const emails = new Set<string>();
    tasks.forEach((task) => {
        if (typeof task.authorId === 'string' && task.authorId) {
            clerkIds.add(task.authorId);
        }
        if (typeof task.executorId === 'string' && task.executorId) {
            clerkIds.add(task.executorId);
        }
        if (typeof task.authorEmail === 'string' && task.authorEmail) {
            emails.add(task.authorEmail.toLowerCase());
        }
        if (typeof task.executorEmail === 'string' && task.executorEmail) {
            emails.add(task.executorEmail.toLowerCase());
        }
        if (typeof task.initiatorEmail === 'string' && task.initiatorEmail) {
            emails.add(task.initiatorEmail.toLowerCase());
        }
    });

    const [usersByClerk, usersByEmail] = await Promise.all([
        clerkIds.size > 0
            ? UserModel.find({ clerkUserId: { $in: Array.from(clerkIds) } })
                  .select('clerkUserId name email')
                  .lean()
            : [],
        emails.size > 0
            ? UserModel.find({ email: { $in: Array.from(emails) } })
                  .select('clerkUserId name email')
                  .lean()
            : [],
    ]);

    const byClerkId = new Map(
        usersByClerk.map((user) => [
            user.clerkUserId,
            {
                clerkUserId: user.clerkUserId,
                name: user.name?.trim(),
                email: user.email?.trim(),
            },
        ])
    );
    const byEmail = new Map(
        usersByEmail.map((user) => [
            user.email?.trim().toLowerCase(),
            {
                clerkUserId: user.clerkUserId,
                name: user.name?.trim(),
                email: user.email?.trim(),
            },
        ])
    );

    const normalizedTasks: AdminTask[] = tasks.map((task) => {
        const authorProfile =
            (typeof task.authorId === 'string' && task.authorId
                ? byClerkId.get(task.authorId)
                : undefined) ||
            (typeof task.authorEmail === 'string' && task.authorEmail
                ? byEmail.get(task.authorEmail.toLowerCase())
                : undefined);
        const executorProfile =
            (typeof task.executorId === 'string' && task.executorId
                ? byClerkId.get(task.executorId)
                : undefined) ||
            (typeof task.executorEmail === 'string' && task.executorEmail
                ? byEmail.get(task.executorEmail.toLowerCase())
                : undefined);
        const initiatorProfile =
            typeof task.initiatorEmail === 'string' && task.initiatorEmail
                ? byEmail.get(task.initiatorEmail.toLowerCase())
                : undefined;

        return {
            ...task,
            authorClerkUserId:
                authorProfile?.clerkUserId ||
                (typeof task.authorId === 'string' ? task.authorId : undefined),
            authorName: authorProfile?.name || task.authorName || task.authorEmail,
            authorEmail: authorProfile?.email || task.authorEmail,
            executorClerkUserId:
                executorProfile?.clerkUserId ||
                (typeof task.executorId === 'string' ? task.executorId : undefined),
            executorName: executorProfile?.name || task.executorName || task.executorEmail,
            executorEmail: executorProfile?.email || task.executorEmail,
            initiatorClerkUserId: initiatorProfile?.clerkUserId,
            initiatorName: initiatorProfile?.name || task.initiatorName || task.initiatorEmail,
            initiatorEmail: initiatorProfile?.email || task.initiatorEmail,
        };
    });

    return NextResponse.json({ tasks: normalizedTasks });
}
