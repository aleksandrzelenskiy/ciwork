// app/api/tasks/public/route.ts
import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/server/db/mongoose';
import TaskModel from '@/server/models/TaskModel';
import ApplicationModel from '@/server/models/ApplicationModel';
import { GetUserContext } from '@/server-actions/user-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseNumber(value: string | null): number | undefined {
    if (!value) return undefined;
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
}

function escapeRegExp(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();
    const minBudget = parseNumber(searchParams.get('minBudget'));
    const maxBudget = parseNumber(searchParams.get('maxBudget'));
    const status = (searchParams.get('status') || '').trim();
    const regionCode = (searchParams.get('region') || '').trim();
    const limit = Math.min(parseNumber(searchParams.get('limit')) ?? 50, 100);

    const context = await GetUserContext();
    const currentUserId =
        context.success && context.data?.user?._id ? context.data.user._id.toString() : null;

    try {
        await dbConnect();
    } catch (error) {
        console.error('DB connection error', error);
        return NextResponse.json({ error: 'DB connection failed' }, { status: 500 });
    }

    const matchStage: Record<string, unknown> = {
        visibility: 'public',
    };

    if (status) {
        matchStage.publicStatus = status;
    } else {
        matchStage.publicStatus = { $in: ['open', 'in_review'] };
    }

    if (minBudget !== undefined || maxBudget !== undefined) {
        matchStage.budget = {};
        if (minBudget !== undefined) {
            (matchStage.budget as Record<string, number>).$gte = minBudget;
        }
        if (maxBudget !== undefined) {
            (matchStage.budget as Record<string, number>).$lte = maxBudget;
        }
    }

    if (q) {
        const regex = new RegExp(escapeRegExp(q), 'i');
        matchStage.$or = [
            { taskName: regex },
            { taskDescription: regex },
            { publicDescription: regex },
            { bsNumber: regex },
        ];
    }

    const pipeline: mongoose.PipelineStage[] = [
        { $match: matchStage },
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
                project: { $arrayElemAt: ['$projectDoc', 0] },
                org: { $arrayElemAt: ['$orgDoc', 0] },
            },
        },
    ];

    if (regionCode) {
        pipeline.push({ $match: { 'project.regionCode': regionCode } });
    }

    pipeline.push(
        {
            $addFields: {
                orgSlug: { $ifNull: ['$org.orgSlug', '$orgSlug'] },
                orgName: { $ifNull: ['$org.name', '$orgName'] },
            },
        },
        {
            $project: {
                projectDoc: 0,
                orgDoc: 0,
                org: 0,
            },
        },
        { $sort: { createdAt: -1 } },
        { $limit: limit }
    );

    try {
        const tasks = await TaskModel.aggregate(pipeline);

        if (!currentUserId || tasks.length === 0) {
            return NextResponse.json({ tasks });
        }

        const userObjectId = new mongoose.Types.ObjectId(currentUserId);
        const taskIds = tasks.map((task: { _id: mongoose.Types.ObjectId }) => task._id);

        const myApplications = await ApplicationModel.find({
            taskId: { $in: taskIds },
            contractorId: userObjectId,
        })
            .select('_id taskId status proposedBudget coverMessage etaDays')
            .lean();

        const appMap = new Map<
            string,
            {
                _id: string;
                taskId: string;
                status: string;
                proposedBudget?: number;
                coverMessage?: string;
                etaDays?: number;
            }
        >();

        myApplications.forEach((app) => {
            appMap.set(app.taskId.toString(), {
                _id: app._id.toString(),
                taskId: app.taskId.toString(),
                status: app.status,
                proposedBudget: app.proposedBudget,
                coverMessage: app.coverMessage,
                etaDays: app.etaDays,
            });
        });

        const enriched = tasks.map((task: { _id: mongoose.Types.ObjectId }) => ({
            ...task,
            myApplication: appMap.get(task._id.toString()) || null,
        }));

        return NextResponse.json({ tasks: enriched });
    } catch (error) {
        console.error('Failed to load public tasks', error);
        return NextResponse.json({ error: 'Failed to load tasks' }, { status: 500 });
    }
}
